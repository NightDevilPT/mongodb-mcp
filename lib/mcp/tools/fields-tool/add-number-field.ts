// lib/mcp/tools/add-number-field.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "@/lib/utils/connection";
import {
	validateDatabaseName,
	validateCollectionName,
	buildFieldDef,
	updateCollectionValidator,
} from "@/lib/utils/field-validation";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z.string().describe("Database name"),
	collection: z.string().describe("Collection name"),
	name: z
		.string()
		.describe("Field name (e.g., 'age', 'price', 'quantity', 'score')"),
	required: z
		.boolean()
		.optional()
		.describe("Field is required in every document"),
	unique: z
		.boolean()
		.optional()
		.describe("Create unique index - no duplicate values"),
	min: z.number().optional().describe("Minimum value"),
	max: z.number().optional().describe("Maximum value"),
	default: z.number().optional().describe("Default value"),
	description: z
		.string()
		.optional()
		.describe("Field description for documentation"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	field: z.string(),
	added: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const {
			database,
			collection,
			name,
			required,
			unique,
			min,
			max,
			default: defVal,
			description,
		} = args as {
			database: string;
			collection: string;
			name: string;
			required?: boolean;
			unique?: boolean;
			min?: number;
			max?: number;
			default?: number;
			description?: string;
		};

		// Validate database name
		const dbValidation = validateDatabaseName(database);
		if (!dbValidation.valid) {
			const errorResult = {
				database: "",
				collection: collection || "",
				field: name || "",
				added: false,
				message: `INVALID_DATABASE_NAME: ${dbValidation.error}`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		// Validate collection name
		const colValidation = validateCollectionName(collection);
		if (!colValidation.valid) {
			const errorResult = {
				database,
				collection: "",
				field: name || "",
				added: false,
				message: `INVALID_COLLECTION_NAME: ${colValidation.error}`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		// Validate field name
		if (!name || name.trim() === "") {
			const errorResult = {
				database,
				collection,
				field: "",
				added: false,
				message: "INVALID_FIELD_NAME: Field name cannot be empty",
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		// Validate min/max
		if (min !== undefined && max !== undefined && min > max) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: min cannot be greater than max",
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;

		// Check if database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		const dbExists = dbList.databases.some((db) => db.name === database);

		if (!dbExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message: `DATABASE_NOT_FOUND: Database '${database}' does not exist`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		const db = client.db(database);

		// Check if collection exists
		const collections = await db.listCollections().toArray();
		const collectionExists = collections.some(
			(col) => col.name === collection,
		);

		if (!collectionExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		// Check if field already exists
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		if (
			collInfo.length > 0 &&
			(collInfo[0] as any).options?.validator?.$jsonSchema?.properties?.[
				name
			]
		) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message: `DUPLICATE_FIELD: Field '${name}' already exists`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(errorResult, null, 2),
					},
				],
				structuredContent: errorResult,
				isError: true,
			};
		}

		// Build field definition
		const fieldDef = buildFieldDef(name, "number", {
			min,
			max,
			description,
		});

		// Update collection validator
		await updateCollectionValidator(
			db,
			collection,
			name,
			fieldDef,
			required,
		);

		// Create unique index if requested
		if (unique) {
			try {
				await db
					.collection(collection)
					.createIndex(
						{ [name]: 1 },
						{ unique: true, background: true },
					);
			} catch {
				// Index creation failed
			}
		}

		await client.close();

		const result = {
			database,
			collection,
			field: name,
			added: true,
			message: `Field '${name}' (number) added successfully to '${collection}'`,
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(result, null, 2),
				},
			],
			structuredContent: result,
		};
	} catch (error) {
		if (client) await client.close();
		const errorResult = {
			database: (args as { database: string }).database || "",
			collection: (args as { collection: string }).collection || "",
			field: (args as { name: string }).name || "",
			added: false,
			message: `ADD_FIELD_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(errorResult, null, 2),
				},
			],
			structuredContent: errorResult,
			isError: true,
		};
	}
};

// ============================================================
// EXPORT
// ============================================================
export const addNumberFieldTool = {
	name: "add_number_field",
	config: {
		title: "Add Number Field",
		description:
			"[Schema] Add a number field to a collection with validation (min, max), required flag, unique index, and default value.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Add Number Field",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "schema",
			subcategory: "fields",
			operation: "write",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
