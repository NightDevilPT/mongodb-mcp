// lib/mcp/tools/db-administration/drop-index.ts
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
		.describe("Field whose index to remove. Example: 'email', 'userId'"),
};

const outputSchema = {
	database: z.string(),
	collection: z.string(),
	field: z.string(),
	dropped: z.boolean(),
	message: z.string(),
};

const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, field } = args as {
			database: string;
			collection: string;
			field: string;
		};

		if (!database?.trim()) {
			const er = {
				database: "",
				collection: collection || "",
				field: field || "",
				dropped: false,
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
				dropped: false,
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
				dropped: false,
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
				dropped: false,
				message: "Cannot drop _id index",
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
				dropped: false,
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

		// Find the index name
		const existing = await db
			.collection(collection)
			.listIndexes()
			.toArray();
		const idx = existing.find((i: any) => {
			const keys = Object.keys(i.key);
			return keys.length === 1 && keys[0] === field;
		});

		if (!idx) {
			await client.close();
			const er = {
				database,
				collection,
				field,
				dropped: false,
				message: `No index found on '${collection}.${field}'`,
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

		try {
			await db.collection(collection).dropIndex(idx.name);
		} catch (e: any) {
			await client.close();
			const er = {
				database,
				collection,
				field,
				dropped: false,
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

		const result = {
			database,
			collection,
			field,
			dropped: true,
			message: `Index '${idx.name}' dropped from '${collection}.${field}'`,
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
			dropped: false,
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

export const dropIndexTool = {
	name: "drop_index",
	config: {
		title: "Drop Index",
		description:
			"[Database] Remove an index from a field. Finds the index by field name and drops it.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Drop Index",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			operation: "write",
			destructive: true,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
