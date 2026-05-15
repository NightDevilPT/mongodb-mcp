// lib/mcp/tools/crud/delete-many.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "@/lib/utils/connection";
import { ObjectId } from "mongodb";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z.string().describe("Database name. Example: 'e_commerce'"),
	collection: z
		.string()
		.describe("Collection name. Example: 'users', 'orders'"),
	ids: z
		.array(z.string())
		.describe(
			"Array of document IDs to delete.\n\n" +
				"EXAMPLE: ['507f1f77bcf86cd799439011','507f1f77bcf86cd799439012','507f1f77bcf86cd799439013']\n\n" +
				"MAX: 1000 IDs per batch.",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	deletedCount: z.number(),
	acknowledged: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, ids } = args as {
			database: string;
			collection: string;
			ids: string[];
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const er = {
				database: "",
				collection: collection || "",
				deletedCount: 0,
				acknowledged: false,
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
		if (!collection || collection.trim() === "") {
			const er = {
				database,
				collection: "",
				deletedCount: 0,
				acknowledged: false,
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
		if (!ids || !Array.isArray(ids) || ids.length === 0) {
			const er = {
				database,
				collection,
				deletedCount: 0,
				acknowledged: false,
				message: "IDs array required",
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
		if (ids.length > 1000) {
			const er = {
				database,
				collection,
				deletedCount: 0,
				acknowledged: false,
				message: `BATCH_TOO_LARGE: Max 1000 IDs per batch. Got ${ids.length}`,
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

		// Validate and convert IDs
		const objectIds: ObjectId[] = [];
		for (const id of ids) {
			if (!id || id.trim() === "") {
				const er = {
					database,
					collection,
					deletedCount: 0,
					acknowledged: false,
					message: "Each ID must be a non-empty string",
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
				objectIds.push(new ObjectId(id.trim()));
			} catch {
				const er = {
					database,
					collection,
					deletedCount: 0,
					acknowledged: false,
					message: `Invalid ID format: '${id}'. Must be a 24-character hex string.`,
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
		}

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;
		const db = client.db(database);

		// Check database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		if (!dbList.databases.some((d: any) => d.name === database)) {
			await client.close();
			const er = {
				database,
				collection,
				deletedCount: 0,
				acknowledged: false,
				message: `DATABASE_NOT_FOUND: Database '${database}' does not exist`,
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

		// Check collection exists
		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				deletedCount: 0,
				acknowledged: false,
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist`,
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

		// Delete documents
		let deletedCount = 0;
		try {
			const result = await db
				.collection(collection)
				.deleteMany({ _id: { $in: objectIds } });
			deletedCount = result.deletedCount;
		} catch (error) {
			await client.close();
			const er = {
				database,
				collection,
				deletedCount: 0,
				acknowledged: false,
				message: `DELETE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
			deletedCount,
			acknowledged: true,
			message: `Deleted ${deletedCount} of ${ids.length} document(s) from '${collection}'`,
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
			deletedCount: 0,
			acknowledged: false,
			message: `DELETE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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

// ============================================================
// EXPORT
// ============================================================
export const deleteManyTool = {
	name: "delete_many",
	config: {
		title: "Delete Many Documents",
		description:
			"[CRUD] Delete multiple documents by their IDs in a single batch.\n\n" +
			"INPUT: database, collection, array of document IDs.\n" +
			"MAX: 1000 IDs per batch.\n\n" +
			"EXAMPLE: ids=['507f1f77bcf86cd799439011','507f1f77bcf86cd799439012']",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Delete Many Documents",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "crud",
			operation: "write",
			destructive: true,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
