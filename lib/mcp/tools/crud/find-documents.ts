// lib/mcp/tools/crud/find-documents.ts
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
		.optional()
		.describe(
			"MongoDB filter query (JSON object). Leave empty for all documents.\n\n" +
				"EXAMPLES:\n" +
				"- All docs: {} or leave empty\n" +
				'- Exact: {"name":"John"}\n' +
				'- Range: {"age":{"$gte":18,"$lte":65}}\n' +
				'- Text: {"name":{"$regex":"john","$options":"i"}}\n' +
				'- In: {"status":{"$in":["active","pending"]}}\n' +
				'- OR: {"$or":[{"status":"active"},{"role":"admin"}]}\n' +
				'- AND+OR: {"$and":[{"$or":[{"status":"active"},{"status":"pending"}]},{"age":{"$gte":18}}]}\n' +
				'- Exists: {"email":{"$exists":true}}\n' +
				'- Nested: {"address.city":"New York"}\n' +
				'- Array: {"tags":{"$all":["mongodb","database"]}}',
		),
	projection: z
		.string()
		.optional()
		.describe(
			"Fields to include, comma-separated. Example: 'name,email,age' returns only these 3 fields. Leave empty for all fields.",
		),
	sortField: z
		.string()
		.optional()
		.describe("Field to sort by. Example: 'createdAt', 'name', 'price'"),
	sortOrder: z
		.enum(["asc", "desc"])
		.optional()
		.describe(
			"Sort direction. 'asc' = ascending (1→9, A→Z), 'desc' = descending (9→1, Z→A). Default: 'desc'",
		),
	page: z
		.number()
		.optional()
		.describe("Page number (starts from 1). Default: 1"),
	limit: z
		.number()
		.optional()
		.describe("Documents per page. Default: 10, Max: 100"),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	documents: z.array(z.record(z.string(), z.unknown())),
	pagination: z.object({
		page: z.number(),
		limit: z.number(),
		totalDocuments: z.number(),
		totalPages: z.number(),
		hasNextPage: z.boolean(),
		hasPreviousPage: z.boolean(),
		nextPage: z.number().nullable(),
		previousPage: z.number().nullable(),
	}),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const {
			database,
			collection,
			filter,
			projection,
			sortField,
			sortOrder,
			page,
			limit,
		} = args as {
			database: string;
			collection: string;
			filter?: Record<string, unknown>;
			projection?: string;
			sortField?: string;
			sortOrder?: string;
			page?: number;
			limit?: number;
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				documents: [],
				pagination: {
					page: 1,
					limit: 10,
					totalDocuments: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
					nextPage: null,
					previousPage: null,
				},
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
				documents: [],
				pagination: {
					page: 1,
					limit: 10,
					totalDocuments: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
					nextPage: null,
					previousPage: null,
				},
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

		const currentPage = page && page > 0 ? page : 1;
		const pageLimit = limit && limit > 0 ? Math.min(limit, 100) : 10;
		const skip = (currentPage - 1) * pageLimit;

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
				documents: [],
				pagination: {
					page: currentPage,
					limit: pageLimit,
					totalDocuments: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
					nextPage: null,
					previousPage: null,
				},
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
				documents: [],
				pagination: {
					page: currentPage,
					limit: pageLimit,
					totalDocuments: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
					nextPage: null,
					previousPage: null,
				},
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

		// Build filter
		const queryFilter =
			filter && Object.keys(filter).length > 0 ? filter : {};

		// Build projection
		const queryProjection: Record<string, number> = {};
		if (projection && projection.trim() !== "") {
			projection.split(",").forEach((f) => {
				queryProjection[f.trim()] = 1;
			});
		}

		// Build sort
		const querySort: Record<string, number> = {};
		if (sortField && sortField.trim() !== "") {
			querySort[sortField.trim()] = sortOrder === "asc" ? 1 : -1;
		}

		// Build query options
		const queryOptions: any = {
			limit: pageLimit,
			skip: skip,
		};
		if (Object.keys(queryProjection).length > 0) {
			queryOptions.projection = queryProjection;
		}
		if (Object.keys(querySort).length > 0) {
			queryOptions.sort = querySort;
		}

		// Execute query
		let documents: any[] = [];
		let totalDocuments = 0;

		try {
			documents = await db
				.collection(collection)
				.find(queryFilter, queryOptions)
				.toArray();
			totalDocuments = await db
				.collection(collection)
				.countDocuments(queryFilter);
		} catch (error) {
			await client.close();
			const errorResult = {
				database,
				collection,
				documents: [],
				pagination: {
					page: currentPage,
					limit: pageLimit,
					totalDocuments: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
					nextPage: null,
					previousPage: null,
				},
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

		// Calculate pagination
		const totalPages = Math.ceil(totalDocuments / pageLimit);
		const hasNextPage = currentPage < totalPages;
		const hasPreviousPage = currentPage > 1;

		const pagination = {
			page: currentPage,
			limit: pageLimit,
			totalDocuments,
			totalPages,
			hasNextPage,
			hasPreviousPage,
			nextPage: hasNextPage ? currentPage + 1 : null,
			previousPage: hasPreviousPage ? currentPage - 1 : null,
		};

		const result = {
			database,
			collection,
			documents,
			pagination,
			message: `Found ${documents.length} document(s) on page ${currentPage} of ${totalPages} (total: ${totalDocuments})`,
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
			documents: [],
			pagination: {
				page: 1,
				limit: 10,
				totalDocuments: 0,
				totalPages: 0,
				hasNextPage: false,
				hasPreviousPage: false,
				nextPage: null,
				previousPage: null,
			},
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
export const findDocumentsTool = {
	name: "find_documents",
	config: {
		title: "Find Documents",
		description:
			"[CRUD] Find documents with full MongoDB filter support, projection, sort, and pagination.\n\n" +
			"═══════════════════════════════════════\n" +
			"SUPPORTED FILTER OPERATORS:\n" +
			"• $eq, $ne: Equals, Not equals\n" +
			"• $gt, $gte, $lt, $lte: Greater/Less than (or equal)\n" +
			"• $in, $nin: Value in/not in array\n" +
			"• $and, $or, $not, $nor: Logical operators\n" +
			"• $exists: Field exists (true/false)\n" +
			"• $regex: Pattern matching with $options 'i' for case-insensitive\n" +
			"• $all: Array contains all values\n" +
			"• $elemMatch: Array element matching\n" +
			"• $size: Array size matching\n" +
			"═══════════════════════════════════════\n" +
			"FILTER EXAMPLES:\n" +
			"• All documents: {} or leave empty\n" +
			'• Exact match: {"name":"John"}\n' +
			'• Not equal: {"status":{"$ne":"deleted"}}\n' +
			'• Range: {"age":{"$gte":18,"$lte":65}}\n' +
			'• Text search: {"name":{"$regex":"john","$options":"i"}}\n' +
			'• In list: {"status":{"$in":["active","pending"]}}\n' +
			'• Not in list: {"role":{"$nin":["banned","deleted"]}}\n' +
			'• Field exists: {"email":{"$exists":true}}\n' +
			'• Field missing: {"phone":{"$exists":false}}\n' +
			'• Multiple AND: {"age":{"$gte":18},"status":"active"}\n' +
			'• OR: {"$or":[{"status":"active"},{"role":"admin"}]}\n' +
			'• AND + OR: {"$and":[{"$or":[{"status":"active"},{"status":"pending"}]},{"age":{"$gte":18}}]}\n' +
			'• Nested field: {"address.city":"New York"}\n' +
			'• Array contains all: {"tags":{"$all":["mongodb","database"]}}\n' +
			'• Array size: {"tags":{"$size":3}}\n' +
			"═══════════════════════════════════════\n" +
			"PROJECTION: Comma-separated fields to include. Example: 'name,email' returns only name and email.\n" +
			"SORT: Choose field and direction (asc/desc). Example: sortField='createdAt', sortOrder='desc' for newest first.\n" +
			"PAGINATION: page (starts at 1), limit (default 10, max 100). Returns hasNextPage, hasPreviousPage, nextPage, previousPage, totalDocuments, totalPages.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Find Documents",
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
