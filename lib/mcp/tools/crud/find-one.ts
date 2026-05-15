// lib/mcp/tools/crud/find-one.ts
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
	database: z.string().describe("Database name. Example: 'e_commerce'"),
	collection: z
		.string()
		.describe("Collection name. Example: 'users', 'orders'"),
	filter: z
		.record(z.string(), z.unknown())
		.describe(
			"MongoDB filter query (JSON object) to find ONE document.\n\n" +
				"SUPPORTED OPERATORS: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or, $not, $nor, $exists, $regex, $all, $elemMatch, $size\n\n" +
				"EXAMPLES:\n" +
				'- By ID: {"_id":"507f1f77bcf86cd799439011"}\n' +
				'- By field: {"email":"john@example.com"}\n' +
				'- Range: {"age":{"$gte":18,"$lte":65}}\n' +
				'- OR: {"$or":[{"email":"john@example.com"},{"username":"john"}]}\n' +
				'- Nested: {"address.city":"New York"}',
		),
	projection: z
		.string()
		.optional()
		.describe(
			"Fields to include, comma-separated. Example: 'name,email,age' returns only these fields. Leave empty for all fields.",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	document: z.record(z.string(), z.unknown()).nullable(),
	found: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, filter, projection } = args as {
			database: string;
			collection: string;
			filter: Record<string, unknown>;
			projection?: string;
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				document: null,
				found: false,
				message: "QUERY_FAILED: Database name cannot be empty",
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
				document: null,
				found: false,
				message: "QUERY_FAILED: Collection name cannot be empty",
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

		if (!filter || Object.keys(filter).length === 0) {
			const errorResult = {
				database,
				collection,
				document: null,
				found: false,
				message:
					"QUERY_FAILED: Filter is required to find a specific document",
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
		const dbExists = dbList.databases.some((db) => db.name === database);

		if (!dbExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				document: null,
				found: false,
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
				document: null,
				found: false,
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

		// Build projection
		const queryProjection: Record<string, number> = {};
		if (projection && projection.trim() !== "") {
			projection.split(",").forEach((f) => {
				queryProjection[f.trim()] = 1;
			});
		}

		// Build query options
		const queryOptions: any = {};
		if (Object.keys(queryProjection).length > 0) {
			queryOptions.projection = queryProjection;
		}

		// Execute query
		let document: any = null;
		try {
			document = await db
				.collection(collection)
				.findOne(filter, queryOptions);
		} catch (error) {
			await client.close();
			const errorResult = {
				database,
				collection,
				document: null,
				found: false,
				message: `QUERY_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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

		if (!document) {
			const result = {
				database,
				collection,
				document: null,
				found: false,
				message: `No document found matching filter`,
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
		}

		const result = {
			database,
			collection,
			document,
			found: true,
			message: `Document found in '${collection}'`,
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
			database: (args as any).database || "",
			collection: (args as any).collection || "",
			document: null,
			found: false,
			message: `QUERY_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const findOneTool = {
	name: "find_one",
	config: {
		title: "Find One Document",
		description:
			"[CRUD] Find a single document by MongoDB filter query.\n\n" +
			"SUPPORTED OPERATORS: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or, $not, $nor, $exists, $regex, $all, $elemMatch, $size\n\n" +
			"EXAMPLES:\n" +
			'- By ID: {"_id":"507f1f77bcf86cd799439011"}\n' +
			'- By email: {"email":"john@example.com"}\n' +
			'- OR: {"$or":[{"email":"john@example.com"},{"username":"john"}]}\n' +
			'- Range: {"age":{"$gte":18,"$lte":65}}\n\n' +
			"PROJECTION: Comma-separated fields to include. Example: 'name,email'",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Find One Document",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "crud",
			operation: "read",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
