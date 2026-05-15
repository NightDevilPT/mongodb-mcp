// lib/mcp/tools/list-collections.ts
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
	database: z.string().describe("Database name to list collections from"),
	includeStats: z
		.boolean()
		.optional()
		.describe(
			"Include collection statistics (document count, size, index count)",
		),
	namePattern: z
		.string()
		.optional()
		.describe(
			"Filter collections by name pattern (case-sensitive substring match)",
		),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	collections: z.array(
		z.object({
			name: z.string(),
			type: z.string(),
			documentCount: z.number(),
			size: z.string(),
			indexCount: z.number(),
		}),
	),
	totalCount: z.number(),
	message: z.string(),
};

// ============================================================
// UTILITY: FORMAT BYTES TO HUMAN READABLE
// ============================================================
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, includeStats, namePattern } = args as {
			database: string;
			includeStats?: boolean;
			namePattern?: string;
		};

		// Validate database name is not empty
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collections: [],
				totalCount: 0,
				message:
					"LIST_COLLECTIONS_FAILED: Database name cannot be empty",
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
				collections: [],
				totalCount: 0,
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

		// List collections
		const collectionsList = await db.listCollections().toArray();

		// Apply name pattern filter if provided
		let filteredCollections = collectionsList;
		if (namePattern && namePattern.trim() !== "") {
			filteredCollections = collectionsList.filter((col) =>
				col.name.includes(namePattern),
			);
		}

		// Build collection details
		const collections = [];

		for (const col of filteredCollections) {
			let documentCount = 0;
			let size = "0 B";
			let indexCount = 0;

			if (includeStats) {
				try {
					const colStats = await db.command({ collStats: col.name });
					documentCount = colStats.count || 0;
					size = formatBytes(colStats.size || 0);
					indexCount = colStats.nindexes || 0;
				} catch {
					// If stats fail for a collection, use defaults
				}
			}

			collections.push({
				name: col.name,
				type: col.type || "collection",
				documentCount,
				size,
				indexCount,
			});
		}

		await client.close();

		const result = {
			database,
			collections,
			totalCount: collections.length,
			message: `Found ${collections.length} collection(s) in database '${database}'`,
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
			collections: [],
			totalCount: 0,
			message: `LIST_COLLECTIONS_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const listCollectionsTool = {
	name: "list_collections",
	config: {
		title: "List Collections",
		description:
			"[Database Administration] List all collections in a database with optional statistics (document count, size, index count) and name pattern filtering.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "List Collections",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "read",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
