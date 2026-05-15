// lib/mcp/tools/collection-stats.ts
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
	collection: z.string().describe("Collection name to get stats for"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	message: z.string(),
	stats: z.object({
		documentCount: z.number(),
		totalSize: z.string(),
		avgDocumentSize: z.string(),
		storageSize: z.string(),
		totalIndexSize: z.string(),
	}),
	indexes: z.array(
		z.object({
			name: z.string(),
			key: z.record(z.string(), z.number()),
			unique: z.boolean(),
			sparse: z.boolean(),
			ttl: z.number().nullable(),
		}),
	),
	fields: z.array(
		z.object({
			name: z.string(),
			type: z.string(),
			required: z.boolean(),
		}),
	),
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
		const { database, collection } = args as {
			database: string;
			collection: string;
		};

		// Validate database name is not empty
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				message: "STATS_FAILED: Database name cannot be empty",
				stats: {
					documentCount: 0,
					totalSize: "0 B",
					avgDocumentSize: "0 B",
					storageSize: "0 B",
					totalIndexSize: "0 B",
				},
				indexes: [],
				fields: [],
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
				message: "STATS_FAILED: Collection name cannot be empty",
				stats: {
					documentCount: 0,
					totalSize: "0 B",
					avgDocumentSize: "0 B",
					storageSize: "0 B",
					totalIndexSize: "0 B",
				},
				indexes: [],
				fields: [],
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
				message: `DATABASE_NOT_FOUND: Database '${database}' does not exist`,
				stats: {
					documentCount: 0,
					totalSize: "0 B",
					avgDocumentSize: "0 B",
					storageSize: "0 B",
					totalIndexSize: "0 B",
				},
				indexes: [],
				fields: [],
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
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist`,
				stats: {
					documentCount: 0,
					totalSize: "0 B",
					avgDocumentSize: "0 B",
					storageSize: "0 B",
					totalIndexSize: "0 B",
				},
				indexes: [],
				fields: [],
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

		// Get collection stats
		const colStats = await db.command({ collStats: collection });

		// Get indexes
		const indexList = await db
			.collection(collection)
			.listIndexes()
			.toArray();
		const indexes = indexList.map((idx: any) => ({
			name: idx.name,
			key: idx.key as Record<string, number>,
			unique: idx.unique || false,
			sparse: idx.sparse || false,
			ttl: idx.expireAfterSeconds || null,
		}));

		// Get fields from validator
		// Get fields from validator with nested details
		const fields: Array<{ name: string; type: string; required: boolean }> =
			[];
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				const schema = options.validator.$jsonSchema;
				const properties = schema.properties || {};
				const requiredFields: string[] = schema.required || [];

				for (const [fieldName, fieldDef] of Object.entries(
					properties,
				)) {
					const def = fieldDef as any;
					let typeStr = def.bsonType || "unknown";

					// If array, show what's inside
					if (def.bsonType === "array" && def.items) {
						if (
							def.items.bsonType === "object" &&
							def.items.properties
						) {
							// Array of objects - show object properties
							const props = Object.keys(
								def.items.properties,
							).join(", ");
							typeStr = `array of object {${props}}`;
						} else if (def.items.bsonType === "array") {
							// Nested array
							typeStr = "array of array";
						} else if (def.items.bsonType) {
							// Array of primitives
							typeStr = `array of ${def.items.bsonType}`;
						} else {
							typeStr = "array";
						}
					}

					// If object, show its properties
					if (def.bsonType === "object" && def.properties) {
						const props = Object.keys(def.properties).join(", ");
						typeStr = `object {${props}}`;
					}

					fields.push({
						name: fieldName,
						type: typeStr,
						required: requiredFields.includes(fieldName),
					});
				}
			}
		}

		await client.close();

		const result = {
			database,
			collection,
			message: `Stats retrieved for collection '${collection}'`,
			stats: {
				documentCount: colStats.count || 0,
				totalSize: formatBytes(colStats.size || 0),
				avgDocumentSize: formatBytes(colStats.avgObjSize || 0),
				storageSize: formatBytes(colStats.storageSize || 0),
				totalIndexSize: formatBytes(colStats.totalIndexSize || 0),
			},
			indexes,
			fields,
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
			message: `STATS_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
			stats: {
				documentCount: 0,
				totalSize: "0 B",
				avgDocumentSize: "0 B",
				storageSize: "0 B",
				totalIndexSize: "0 B",
			},
			indexes: [],
			fields: [],
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
export const collectionStatsTool = {
	name: "collection_stats",
	config: {
		title: "Collection Statistics",
		description:
			"[Database Administration] Get detailed statistics for a collection including document count, size, indexes (name, key, unique, sparse, TTL), and fields (name, type, required) from the validator schema.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Collection Statistics",
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
