// lib/mcp/tools/db-administration/rename-collection.ts
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
	oldName: z.string().describe("Current collection name to rename"),
	newName: z
		.string()
		.describe(
			"New collection name (letters, numbers, underscores, max 255 chars, no 'system.' prefix)",
		),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	oldName: z.string(),
	newName: z.string(),
	renamed: z.boolean(),
	documentCount: z.number(),
};

// ============================================================
// VALIDATION
// ============================================================
const COLLECTION_NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MAX_COLLECTION_NAME_LENGTH = 255;
const SYSTEM_PREFIX = "system.";

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, oldName, newName } = args as {
			database: string;
			oldName: string;
			newName: string;
		};

		// Validate database name is not empty
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				oldName: oldName || "",
				newName: newName || "",
				renamed: false,
				documentCount: 0,
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

		// Validate old collection name is not empty
		if (!oldName || oldName.trim() === "") {
			const errorResult = {
				database,
				oldName: "",
				newName: newName || "",
				renamed: false,
				documentCount: 0,
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

		// Validate new collection name is not empty
		if (!newName || newName.trim() === "") {
			const errorResult = {
				database,
				oldName,
				newName: "",
				renamed: false,
				documentCount: 0,
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

		// Validate new collection name length
		if (newName.length > MAX_COLLECTION_NAME_LENGTH) {
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Validate new collection name format
		if (!COLLECTION_NAME_REGEX.test(newName)) {
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Validate new name not same as old name
		if (oldName === newName) {
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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
		if (oldName.toLowerCase().startsWith(SYSTEM_PREFIX)) {
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Validate new name not using system prefix
		if (newName.toLowerCase().startsWith(SYSTEM_PREFIX)) {
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Check if old collection exists
		const collections = await db.listCollections().toArray();
		const oldCollectionExists = collections.some(
			(col) => col.name === oldName,
		);

		if (!oldCollectionExists) {
			await client.close();
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Check if new collection name already exists
		const newCollectionExists = collections.some(
			(col) => col.name === newName,
		);

		if (newCollectionExists) {
			await client.close();
			const errorResult = {
				database,
				oldName,
				newName,
				renamed: false,
				documentCount: 0,
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

		// Get document count before rename
		const documentCount = await db.collection(oldName).countDocuments();

		// Rename the collection
		await db.collection(oldName).rename(newName);

		await client.close();

		const result = {
			database,
			oldName,
			newName,
			renamed: true,
			documentCount,
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
			oldName: (args as { oldName: string }).oldName || "",
			newName: (args as { newName: string }).newName || "",
			renamed: false,
			documentCount: 0,
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
export const renameCollectionTool = {
	name: "rename_collection",
	config: {
		title: "Rename Collection",
		description:
			"[Database Administration] Rename an existing collection. New name must follow collection naming rules (letters, numbers, underscores, max 255 chars, no 'system.' prefix).",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Rename Collection",
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
