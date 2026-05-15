// lib/mcp/tools/add-date-field.ts
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
	updateCollectionValidator,
} from "@/lib/utils/field-validation";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z
		.string()
		.describe("Database name (e.g., 'e_commerce', 'my_app')"),
	collection: z
		.string()
		.describe("Collection name (e.g., 'users', 'products')"),
	name: z
		.string()
		.describe(
			"Field name (e.g., 'createdAt', 'updatedAt', 'expiresAt', 'birthDate', 'orderDate')",
		),
	required: z
		.boolean()
		.optional()
		.describe("Whether this field must be present in every document"),
	autoSet: z
		.boolean()
		.optional()
		.describe(
			"Automatically set to current date when document is CREATED. MCP will auto-set this on insert. (e.g., true for 'createdAt' field - set once, never changes). Cannot use with autoUpdate.",
		),
	autoUpdate: z
		.boolean()
		.optional()
		.describe(
			"Automatically update to current date whenever document is UPDATED. MCP will auto-set this on every update. (e.g., true for 'updatedAt' field - changes on every update). Cannot use with autoSet.",
		),
	unique: z
		.boolean()
		.optional()
		.describe(
			"Create a unique index on this field. (e.g., true = no two documents can have the same date)",
		),
	index: z
		.boolean()
		.optional()
		.describe(
			"Create an ascending index for faster queries. (e.g., true = optimize 'sort by date ascending')",
		),
	descendingIndex: z
		.boolean()
		.optional()
		.describe(
			"Create a descending index for 'newest first' queries. (e.g., true = optimize 'sort by newest')",
		),
	minDate: z
		.string()
		.optional()
		.describe("Minimum allowed date (YYYY-MM-DD). Example: '2020-01-01'"),
	maxDate: z
		.string()
		.optional()
		.describe("Maximum allowed date (YYYY-MM-DD). Example: '2030-12-31'"),
	expireAfterSeconds: z
		.number()
		.optional()
		.describe(
			"TTL index - auto-delete documents after N seconds. (e.g., 86400 = delete after 24 hours, 3600 = delete after 1 hour)",
		),
	description: z
		.string()
		.optional()
		.describe(
			"Human-readable description. (e.g., 'When the user account was created')",
		),
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
			autoSet,
			autoUpdate,
			unique,
			index,
			descendingIndex,
			minDate,
			maxDate,
			expireAfterSeconds,
			description,
		} = args as {
			database: string;
			collection: string;
			name: string;
			required?: boolean;
			autoSet?: boolean;
			autoUpdate?: boolean;
			unique?: boolean;
			index?: boolean;
			descendingIndex?: boolean;
			minDate?: string;
			maxDate?: string;
			expireAfterSeconds?: number;
			description?: string;
		};

		// Validate database name
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				field: name || "",
				added: false,
				message: "INVALID_DATABASE_NAME: Database name cannot be empty",
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
		if (!collection || collection.trim() === "") {
			const errorResult = {
				database,
				collection: "",
				field: name || "",
				added: false,
				message:
					"INVALID_COLLECTION_NAME: Collection name cannot be empty",
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

		// Validate autoSet and autoUpdate not both true
		if (autoSet && autoUpdate) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: autoSet and autoUpdate cannot both be true. Use autoSet for 'createdAt' (set once) and autoUpdate for 'updatedAt' (set on every update).",
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

		// Validate min/max date
		if (minDate && maxDate && minDate > maxDate) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: minDate cannot be greater than maxDate",
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

		// Validate expireAfterSeconds
		if (expireAfterSeconds !== undefined && expireAfterSeconds <= 0) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: expireAfterSeconds must be greater than 0",
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

		// Build description with auto behavior metadata
		let desc = description || `${name} field`;
		if (autoSet) desc += " [AUTO-SET ON INSERT]";
		if (autoUpdate) desc += " [AUTO-UPDATE ON UPDATE]";

		// Build date field definition (MongoDB $jsonSchema compatible)
		const fieldDef: Record<string, unknown> = {
			bsonType: "date",
			description: desc,
		};

		// MongoDB supports minimum/maximum for dates
		if (minDate) fieldDef.minimum = minDate;
		if (maxDate) fieldDef.maximum = maxDate;

		// Store auto behavior metadata (custom extension, not MongoDB native)
		if (autoSet) fieldDef.autoSet = true;
		if (autoUpdate) fieldDef.autoUpdate = true;

		// Update collection validator
		await updateCollectionValidator(
			db,
			collection,
			name,
			fieldDef,
			required,
		);

		// Create indexes
		if (unique) {
			try {
				await db
					.collection(collection)
					.createIndex(
						{ [name]: 1 },
						{ unique: true, background: true },
					);
			} catch {
				/* skip */
			}
		} else if (index) {
			try {
				await db
					.collection(collection)
					.createIndex({ [name]: 1 }, { background: true });
			} catch {
				/* skip */
			}
		} else if (descendingIndex) {
			try {
				await db
					.collection(collection)
					.createIndex({ [name]: -1 }, { background: true });
			} catch {
				/* skip */
			}
		}

		// Create TTL index
		if (expireAfterSeconds !== undefined) {
			try {
				await db
					.collection(collection)
					.createIndex(
						{ [name]: 1 },
						{ expireAfterSeconds, background: true },
					);
			} catch {
				/* skip */
			}
		}

		await client.close();

		let msg = `Date field '${name}' added successfully to '${collection}'`;
		if (autoSet) msg += " (auto-set on insert)";
		if (autoUpdate) msg += " (auto-update on update)";
		if (expireAfterSeconds !== undefined)
			msg += ` with TTL of ${expireAfterSeconds}s`;

		const result = {
			database,
			collection,
			field: name,
			added: true,
			message: msg,
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
export const addDateFieldTool = {
	name: "add_date_field",
	config: {
		title: "Add Date Field",
		description:
			"[Schema] Add a date field with auto-set/auto-update behavior.\n\n" +
			"AUTO BEHAVIOR (handled by MCP insert/update tools):\n" +
			"- autoSet: Automatically sets current date on INSERT only (for 'createdAt')\n" +
			"- autoUpdate: Automatically updates date on every UPDATE (for 'updatedAt')\n\n" +
			"MongoDB ENFORCED validations:\n" +
			"- minDate/maxDate: Date range limits\n" +
			"- required: Field must be present\n" +
			"- unique/index/descendingIndex: Indexes\n" +
			"- expireAfterSeconds: TTL auto-delete\n\n" +
			"EXAMPLES:\n" +
			"- Created date: name='createdAt', autoSet=true, index=true\n" +
			"- Updated date: name='updatedAt', autoUpdate=true, index=true\n" +
			"- Expiry: name='expiresAt', expireAfterSeconds=86400\n" +
			"- Birth date: name='birthDate', minDate='1900-01-01', maxDate='2024-01-01'",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Add Date Field",
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
