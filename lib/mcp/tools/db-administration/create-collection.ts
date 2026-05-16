// lib/mcp/tools/db-administration/create-collection.ts
// Testcases Done
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
} from "@/lib/utils/field-validation";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z.string().describe("Database name"),
	collection: z
		.string()
		.describe(
			"Collection name (letters, numbers, underscores, max 255 chars, no 'system.' prefix)",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	created: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection } = args as {
			database: string;
			collection: string;
		};

		// Validate database name
		const dbValidation = validateDatabaseName(database);
		if (!dbValidation.valid) {
			const errorResult = {
				database: "",
				collection: collection || "",
				created: false,
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
				created: false,
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

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;

		// Check database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		if (!dbList.databases.some((db) => db.name === database)) {
			await client.close();
			const errorResult = {
				database,
				collection,
				created: false,
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

		// Check collection doesn't exist
		const collections = await db.listCollections().toArray();
		if (collections.some((col) => col.name === collection)) {
			await client.close();
			const errorResult = {
				database,
				collection,
				created: false,
				message: `COLLECTION_EXISTS: Collection '${collection}' already exists`,
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

		// Create collection
		await db.createCollection(collection);

		await client.close();

		const result = {
			database,
			collection,
			created: true,
			message: `Collection '${collection}' created successfully in database '${database}'`,
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
			created: false,
			message: `CREATE_COLLECTION_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const createCollectionTool = {
	name: "create_collection",
	config: {
		title: "Create Collection",
		description:
			"[Database Administration] Create a new empty collection. Use 'add_fields' tool separately to define field schema, validation, and indexes.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Create Collection",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "write",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
