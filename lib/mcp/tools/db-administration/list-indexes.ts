// lib/mcp/tools/db-administration/list-indexes.ts
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

const inputSchema = {
	database: z.string().describe("Database name. Example: 'e_commerce'"),
	collection: z
		.string()
		.describe("Collection name. Example: 'users', 'orders'"),
};

const outputSchema = {
	database: z.string(),
	collection: z.string(),
	indexes: z.array(
		z.object({
			name: z.string(),
			key: z.record(z.string(), z.number()),
			unique: z.boolean(),
			sparse: z.boolean(),
			ttl: z.number().nullable(),
		}),
	),
	totalCount: z.number(),
	message: z.string(),
};

const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection } = args as {
			database: string;
			collection: string;
		};

		if (!database?.trim()) {
			const er = {
				database: "",
				collection: collection || "",
				indexes: [],
				totalCount: 0,
				message: "Database name required",
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(er, null, 2),
					},
				],
				structuredContent: er,
				isError: true,
			};
		}
		if (!collection?.trim()) {
			const er = {
				database,
				collection: "",
				indexes: [],
				totalCount: 0,
				message: "Collection name required",
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(er, null, 2),
					},
				],
				structuredContent: er,
				isError: true,
			};
		}

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;
		const db = client.db(database);

		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				indexes: [],
				totalCount: 0,
				message: `Collection '${collection}' not found`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(er, null, 2),
					},
				],
				structuredContent: er,
				isError: true,
			};
		}

		const list = await db.collection(collection).listIndexes().toArray();
		const indexes = list.map((idx: any) => ({
			name: idx.name,
			key: idx.key as Record<string, number>,
			unique: idx.unique || false,
			sparse: idx.sparse || false,
			ttl: idx.expireAfterSeconds || null,
		}));

		await client.close();

		const result = {
			database,
			collection,
			indexes,
			totalCount: indexes.length,
			message: `Found ${indexes.length} index(es) on '${collection}'`,
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
		const er = {
			database: (args as any).database || "",
			collection: (args as any).collection || "",
			indexes: [],
			totalCount: 0,
			message: `Failed: ${error instanceof Error ? error.message : "Unknown"}`,
		};
		return {
			content: [
				{ type: "text" as const, text: JSON.stringify(er, null, 2) },
			],
			structuredContent: er,
			isError: true,
		};
	}
};

export const listIndexesTool = {
	name: "list_indexes",
	config: {
		title: "List Indexes",
		description:
			"[Database] View all indexes on a collection with details (name, key, unique, sparse, TTL).",
		inputSchema,
		outputSchema,
		annotations: {
			title: "List Indexes",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			operation: "read",
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
