// lib/mcp/tools/db-administration/add-index.ts
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
	field: z
		.string()
		.describe("Field to index. Example: 'email', 'userId', 'createdAt'"),
	unique: z.boolean().optional().describe("No duplicate values allowed"),
	textSearch: z
		.boolean()
		.optional()
		.describe("Full-text search index (string fields only)"),
	sparse: z
		.boolean()
		.optional()
		.describe("Only index docs that have this field"),
	ttlSeconds: z
		.number()
		.optional()
		.describe("Auto-delete after N seconds (date fields only). 86400=24h"),
};

const outputSchema = {
	database: z.string(),
	collection: z.string(),
	field: z.string(),
	added: z.boolean(),
	message: z.string(),
};

const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const {
			database,
			collection,
			field,
			unique,
			textSearch,
			sparse,
			ttlSeconds,
		} = args as {
			database: string;
			collection: string;
			field: string;
			unique?: boolean;
			textSearch?: boolean;
			sparse?: boolean;
			ttlSeconds?: number;
		};

		if (!database?.trim()) {
			const er = {
				database: "",
				collection: collection || "",
				field: field || "",
				added: false,
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
				field: field || "",
				added: false,
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
		if (!field?.trim()) {
			const er = {
				database,
				collection,
				field: "",
				added: false,
				message: "Field name required",
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
		if (field === "_id") {
			const er = {
				database,
				collection,
				field,
				added: false,
				message: "_id already has index by default",
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
				field,
				added: false,
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

		// Check if index already exists
		const existing = await db
			.collection(collection)
			.listIndexes()
			.toArray();
		const dirStr = textSearch ? "text" : "1";
		const expectedName = `${field}_${dirStr}`;
		if (existing.some((i: any) => i.name === expectedName)) {
			await client.close();
			const er = {
				database,
				collection,
				field,
				added: false,
				message: `Index '${expectedName}' already exists on '${collection}'`,
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

		// Build index
		const key: Record<string, 1 | -1 | "text"> = {};
		key[field] = textSearch ? "text" : 1;

		const opts: Record<string, unknown> = { background: true };
		if (unique) opts.unique = true;
		if (sparse) opts.sparse = true;
		if (ttlSeconds && ttlSeconds > 0) opts.expireAfterSeconds = ttlSeconds;

		try {
			await db.collection(collection).createIndex(key as any, opts);
		} catch (e: any) {
			await client.close();
			const er = {
				database,
				collection,
				field,
				added: false,
				message: `Failed: ${e.message}`,
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

		await client.close();

		const f: string[] = [];
		if (unique) f.push("unique");
		if (textSearch) f.push("text search");
		if (sparse) f.push("sparse");
		if (ttlSeconds) f.push(`TTL ${ttlSeconds}s`);
		const fs = f.length > 0 ? ` (${f.join(", ")})` : "";

		const result = {
			database,
			collection,
			field,
			added: true,
			message: `Index created on '${collection}.${field}'${fs}`,
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
			field: (args as any).field || "",
			added: false,
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

export const addIndexTool = {
	name: "add_index",
	config: {
		title: "Add Index",
		description:
			"[Database] Create an index on a field. Skips if index already exists. Supports unique, text search, sparse, and TTL.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Add Index",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			operation: "write",
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
