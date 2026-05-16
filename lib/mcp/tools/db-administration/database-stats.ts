// lib/mcp/tools/db-administration/database-stats.ts
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

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z.string().describe("Database name to get statistics for"),
	includeCollectionDetails: z
		.boolean()
		.optional()
		.describe("Include per-collection statistics"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	message: z.string(),
	stats: z
		.object({
			sizeOnDisk: z.string(),
			collections: z.number(),
			documents: z.number(),
			indexes: z.number(),
			storageSize: z.string(),
			dataSize: z.string(),
			indexSize: z.string(),
			avgObjSize: z.string(),
			fsTotalSize: z.string(),
			fsUsedSize: z.string(),
			views: z.number(),
		})
		.optional(),
	collectionDetails: z
		.array(
			z.object({
				name: z.string(),
				documentCount: z.number(),
				size: z.string(),
				storageSize: z.string(),
				indexCount: z.number(),
				indexSize: z.string(),
				avgObjSize: z.string(),
			}),
		)
		.optional(),
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
		const { database, includeCollectionDetails } = args as {
			database: string;
			includeCollectionDetails?: boolean;
		};

		// Validate database name is not empty
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				message: "DATABASE_STATS_FAILED: Database name cannot be empty",
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

		// Get database stats using dbStats command
		const dbStats = await db.command({ dbStats: 1 });

		// Get collection details
		let collectionDetails: Array<{
			name: string;
			documentCount: number;
			size: string;
			storageSize: string;
			indexCount: number;
			indexSize: string;
			avgObjSize: string;
		}> = [];

		let totalDocuments = 0;
		let totalIndexes = 0;
		let totalDataSize = 0;
		let totalStorageSize = 0;
		let totalIndexSize = 0;

		const collections = await db.listCollections().toArray();

		for (const col of collections) {
			const colStats = await db.command({ collStats: col.name });
			totalDocuments += colStats.count || 0;
			totalIndexes += colStats.nindexes || 0;
			totalDataSize += colStats.size || 0;
			totalStorageSize += colStats.storageSize || 0;
			totalIndexSize += colStats.totalIndexSize || 0;

			if (includeCollectionDetails) {
				collectionDetails.push({
					name: col.name,
					documentCount: colStats.count || 0,
					size: formatBytes(colStats.size || 0),
					storageSize: formatBytes(colStats.storageSize || 0),
					indexCount: colStats.nindexes || 0,
					indexSize: formatBytes(colStats.totalIndexSize || 0),
					avgObjSize: formatBytes(colStats.avgObjSize || 0),
				});
			}
		}

		await client.close();

		const result = {
			database,
			message: `Statistics retrieved for database '${database}'`,
			stats: {
				sizeOnDisk: formatBytes(
					(dbStats.dataSize || 0) + (dbStats.indexSize || 0),
				),
				collections: collections.length,
				documents: totalDocuments,
				indexes: totalIndexes,
				storageSize: formatBytes(totalStorageSize),
				dataSize: formatBytes(totalDataSize),
				indexSize: formatBytes(totalIndexSize),
				avgObjSize: formatBytes(dbStats.avgObjSize || 0),
				fsTotalSize: formatBytes(dbStats.fsTotalSize || 0),
				fsUsedSize: formatBytes(dbStats.fsUsedSize || 0),
				views: dbStats.views || 0,
			},
			collectionDetails,
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
			message: `DATABASE_STATS_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const databaseStatsTool = {
	name: "database_stats",
	config: {
		title: "Database Statistics",
		description:
			"[Database Administration] Get detailed statistics for a specific database including size, document count, indexes, and optional per-collection breakdown.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Database Statistics",
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
