// lib/mcp/tools/crud/delete-one.ts
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
	id: z
		.string()
		.describe("Document ID to delete. Example: '507f1f77bcf86cd799439011'"),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	id: z.string(),
	deleted: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, id } = args as {
			database: string;
			collection: string;
			id: string;
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				id: id || "",
				deleted: false,
				message: "DELETE_FAILED: Database name cannot be empty",
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

		if (!collection || collection.trim() === "") {
			const errorResult = {
				database,
				collection: "",
				id: id || "",
				deleted: false,
				message: "DELETE_FAILED: Collection name cannot be empty",
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

		if (!id || id.trim() === "") {
			const errorResult = {
				database,
				collection,
				id: "",
				deleted: false,
				message: "DELETE_FAILED: Document ID cannot be empty",
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

		let objectId: ObjectId;
		try {
			objectId = new ObjectId(id);
		} catch {
			const errorResult = {
				database,
				collection,
				id,
				deleted: false,
				message:
					"DELETE_FAILED: Invalid document ID format. Must be a valid 24-character hex string.",
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
		const db = client.db(database);

		// Check database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		const dbExists = dbList.databases.some((d) => d.name === database);

		if (!dbExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				id,
				deleted: false,
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

		// Check collection exists
		const cols = await db.listCollections().toArray();
		const collectionExists = cols.some((c) => c.name === collection);

		if (!collectionExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				id,
				deleted: false,
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist`,
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

		// Delete document by _id
		let result: any;
		try {
			result = await db
				.collection(collection)
				.deleteOne({ _id: objectId });
		} catch (error) {
			await client.close();
			const errorResult = {
				database,
				collection,
				id,
				deleted: false,
				message: `DELETE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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

		await client.close();

		if (result.deletedCount === 0) {
			const res = {
				database,
				collection,
				id,
				deleted: false,
				message: `No document found with ID '${id}' in '${collection}'`,
			};
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(res, null, 2),
					},
				],
				structuredContent: res,
			};
		}

		const res = {
			database,
			collection,
			id,
			deleted: true,
			message: `Document with ID '${id}' deleted from '${collection}'`,
		};

		return {
			content: [
				{ type: "text" as const, text: JSON.stringify(res, null, 2) },
			],
			structuredContent: res,
		};
	} catch (error) {
		if (client) await client.close();
		const errorResult = {
			database: (args as any).database || "",
			collection: (args as any).collection || "",
			id: (args as any).id || "",
			deleted: false,
			message: `DELETE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const deleteOneTool = {
	name: "delete_one",
	config: {
		title: "Delete One Document",
		description:
			"[CRUD] Delete a single document by its _id.\n\n" +
			"INPUT: database name, collection name, document ID.\n" +
			"EXAMPLE: id='507f1f77bcf86cd799439011'\n" +
			"Returns deleted: true if found and deleted, false if not found.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Delete One Document",
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
