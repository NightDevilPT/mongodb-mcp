// lib/mcp/tools/drop-collection.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "@/lib/utils/connection";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z.string().describe("Database name"),
	collection: z.string().describe("Collection name to drop"),
	confirm: z
		.boolean()
		.describe("Confirmation toggle - must be true to proceed with drop"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	dropped: z.boolean(),
	message: z.string(),
};

// ============================================================
// VALIDATION
// ============================================================
const SYSTEM_PREFIX = "system.";

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, confirm } = args as {
			database: string;
			collection: string;
			confirm: boolean;
		};

		// Validate database name is not empty
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				dropped: false,
				message:
					"DROP_COLLECTION_FAILED: Database name cannot be empty",
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

		// Validate collection name is not empty
		if (!collection || collection.trim() === "") {
			const errorResult = {
				database,
				collection: "",
				dropped: false,
				message:
					"COLLECTION_NOT_FOUND: Collection name cannot be empty",
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

		// Validate confirmation toggle
		if (!confirm) {
			const errorResult = {
				database,
				collection,
				dropped: false,
				message:
					"CONFIRMATION_FAILED: Confirmation toggle must be checked (true) to drop collection",
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

		// Protect system collections
		if (collection.toLowerCase().startsWith(SYSTEM_PREFIX)) {
			const errorResult = {
				database,
				collection,
				dropped: false,
				message: `SYSTEM_COLLECTION_PROTECTED: Cannot drop system collection '${collection}'`,
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
				dropped: false,
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
				dropped: false,
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist in database '${database}'`,
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

		// Drop the collection
		await db.collection(collection).drop();

		await client.close();

		const result = {
			database,
			collection,
			dropped: true,
			message: `Collection '${collection}' dropped successfully from database '${database}'`,
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
			dropped: false,
			message: `DROP_COLLECTION_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const dropCollectionTool = {
	name: "drop_collection",
	config: {
		title: "Drop Collection",
		description:
			"[Database Administration] Delete a collection permanently. Confirmation toggle must be checked to proceed. System collections (system.*) are protected.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Drop Collection",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "write",
			destructive: true,
			requiresConfirmation: true,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
