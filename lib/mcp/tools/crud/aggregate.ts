// lib/mcp/tools/crud/aggregate.ts
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
		.describe(
			"Collection to aggregate. Example: 'orders', 'users', 'products'",
		),
	pipeline: z
		.array(z.record(z.string(), z.unknown()))
		.describe(
			"Array of MongoDB aggregation pipeline stages.\n\n" +
				"═══════════════════════════════════════\n" +
				"SUPPORTED STAGES WITH EXAMPLES:\n\n" +
				"$match - Filter documents:\n" +
				'  {"$match": {"status": "active"}}\n' +
				'  {"$match": {"age": {"$gte": 18}}}\n\n' +
				"$group - Group and calculate:\n" +
				'  {"$group": {"_id": "$category", "count": {"$sum": 1}}}\n' +
				'  {"$group": {"_id": "$userId", "total": {"$sum": "$amount"}, "avg": {"$avg": "$amount"}}}\n\n' +
				"$sort - Sort results:\n" +
				'  {"$sort": {"createdAt": -1}} (newest first)\n' +
				'  {"$sort": {"name": 1}} (A to Z)\n\n' +
				"$project - Select/transform fields:\n" +
				'  {"$project": {"name": 1, "email": 1, "_id": 0}}\n' +
				'  {"$project": {"fullName": {"$concat": ["$firstName", " ", "$lastName"]}}}\n\n' +
				"$lookup - JOIN collections:\n" +
				'  {"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}}\n' +
				'  Then use $unwind: {"$unwind": "$user"}\n\n' +
				"$unwind - Expand arrays:\n" +
				'  {"$unwind": "$items"}\n\n' +
				"$limit / $skip - Pagination:\n" +
				'  {"$limit": 10}, {"$skip": 20}\n\n' +
				"$addFields - Add computed fields:\n" +
				'  {"$addFields": {"total": {"$multiply": ["$price", "$quantity"]}}}\n\n' +
				"═══════════════════════════════════════\n" +
				"COMPLETE EXAMPLES:\n\n" +
				"1. Count by status:\n" +
				'[{"$group": {"_id": "$status", "count": {"$sum": 1}}}]\n\n' +
				"2. Orders with user details:\n" +
				'[{"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}}, {"$unwind": "$user"}, {"$project": {"user.name": 1, "user.email": 1, "total": 1}}]\n\n' +
				"3. Top 10 products by sales:\n" +
				'[{"$group": {"_id": "$productId", "totalSold": {"$sum": "$quantity"}}}, {"$sort": {"totalSold": -1}}, {"$limit": 10}]\n\n' +
				"4. Monthly revenue:\n" +
				'[{"$group": {"_id": {"$month": "$createdAt"}, "revenue": {"$sum": "$amount"}}}, {"$sort": {"_id": 1}}]',
		),
	allowDiskUse: z
		.boolean()
		.optional()
		.describe(
			"Allow MongoDB to use disk for large aggregations (>100MB memory). Default: false",
		),
	limit: z
		.number()
		.optional()
		.describe("Max documents to return. Default: 100, Max: 1000"),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	results: z.array(z.record(z.string(), z.unknown())),
	count: z.number(),
	executionTimeMs: z.number(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, pipeline, allowDiskUse, limit } =
			args as {
				database: string;
				collection: string;
				pipeline: Record<string, unknown>[];
				allowDiskUse?: boolean;
				limit?: number;
			};

		// Validate inputs
		if (!database || database.trim() === "") {
			const er = {
				database: "",
				collection: collection || "",
				results: [],
				count: 0,
				executionTimeMs: 0,
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
				results: [],
				count: 0,
				executionTimeMs: 0,
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
		if (!pipeline || !Array.isArray(pipeline) || pipeline.length === 0) {
			const er = {
				database,
				collection,
				results: [],
				count: 0,
				executionTimeMs: 0,
				message:
					'Pipeline required. Example: [{"$match":{"status":"active"}}]',
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

		const resultLimit = limit && limit > 0 ? Math.min(limit, 1000) : 100;

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;
		const db = client.db(database);

		// Check database
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		if (!dbList.databases.some((d: any) => d.name === database)) {
			await client.close();
			const er = {
				database,
				collection,
				results: [],
				count: 0,
				executionTimeMs: 0,
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

		// Check collection
		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				results: [],
				count: 0,
				executionTimeMs: 0,
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

		// Add $limit to pipeline if not already present
		const hasLimit = pipeline.some((stage) => "$limit" in stage);
		const finalPipeline = hasLimit
			? pipeline
			: [...pipeline, { $limit: resultLimit }];

		// Build aggregate options
		const aggOptions: any = {};
		if (allowDiskUse) aggOptions.allowDiskUse = true;

		// Execute aggregation
		const startTime = Date.now();
		let results: any[] = [];
		try {
			results = await db
				.collection(collection)
				.aggregate(finalPipeline, aggOptions)
				.toArray();
		} catch (error) {
			await client.close();
			const er = {
				database,
				collection,
				results: [],
				count: 0,
				executionTimeMs: 0,
				message: `AGGREGATION_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
		const executionTimeMs = Date.now() - startTime;

		await client.close();

		const result = {
			database,
			collection,
			results,
			count: results.length,
			executionTimeMs,
			message: `Aggregation returned ${results.length} result(s) in ${executionTimeMs}ms`,
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
			results: [],
			count: 0,
			executionTimeMs: 0,
			message: `AGGREGATION_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const aggregateTool = {
	name: "aggregate",
	config: {
		title: "Aggregate",
		description:
			"[Query] Execute MongoDB aggregation pipeline for complex data analysis, transformations, and joins.\n\n" +
			"═══════════════════════════════════════\n" +
			"SUPPORTED STAGES (in recommended order):\n" +
			"• $match    - Filter documents (like find())\n" +
			"• $group    - Group by field with calculations\n" +
			"• $sort     - Sort results (1=asc, -1=desc)\n" +
			"• $project  - Select, rename, or compute fields\n" +
			"• $lookup   - JOIN with another collection\n" +
			"• $unwind   - Expand array into separate documents\n" +
			"• $addFields - Add new computed fields\n" +
			"• $limit    - Limit number of results\n" +
			"• $skip     - Skip documents (for pagination)\n" +
			"• $count    - Count documents in pipeline\n" +
			"• $facet    - Run multiple pipelines in parallel\n\n" +
			"═══════════════════════════════════════\n" +
			"ACCUMULATORS ($group):\n" +
			"• $sum    - Sum values\n" +
			"• $avg    - Average values\n" +
			"• $min    - Minimum value\n" +
			"• $max    - Maximum value\n" +
			"• $first  - First value in group\n" +
			"• $last   - Last value in group\n" +
			"• $push   - Create array of all values\n" +
			"• $addToSet - Create array of unique values\n\n" +
			"═══════════════════════════════════════\n" +
			"EXAMPLES - SIMPLE TO ADVANCED:\n\n" +
			"1. FILTER DOCUMENTS:\n" +
			'[{"$match":{"status":"active","age":{"$gte":18}}}]\n\n' +
			"2. COUNT BY CATEGORY:\n" +
			'[{"$group":{"_id":"$category","count":{"$sum":1}}}]\n\n' +
			"3. TOTAL REVENUE PER USER:\n" +
			'[{"$group":{"_id":"$userId","totalSpent":{"$sum":"$amount"},"orderCount":{"$sum":1},"avgOrder":{"$avg":"$amount"}}}]\n\n' +
			"4. JOIN ORDERS WITH USER DETAILS:\n" +
			'[{"$lookup":{"from":"users","localField":"userId","foreignField":"_id","as":"user"}},{"$unwind":"$user"},{"$project":{"_id":1,"total":1,"user.name":1,"user.email":1}}]\n\n' +
			"5. JOIN ORDERS WITH USER + PRODUCT DETAILS:\n" +
			'[{"$lookup":{"from":"users","localField":"userId","foreignField":"_id","as":"user"}},{"$unwind":"$user"},{"$lookup":{"from":"products","localField":"productId","foreignField":"_id","as":"product"}},{"$unwind":"$product"},{"$project":{"user.name":1,"product.name":1,"quantity":1,"total":1}}]\n\n' +
			"6. TOP 10 PRODUCTS BY SALES:\n" +
			'[{"$group":{"_id":"$productId","totalSold":{"$sum":"$quantity"},"revenue":{"$sum":"$total"}}},{"$sort":{"totalSold":-1}},{"$limit":10}]\n\n' +
			"7. MONTHLY REVENUE REPORT:\n" +
			'[{"$group":{"_id":{"year":{"$year":"$createdAt"},"month":{"$month":"$createdAt"}},"revenue":{"$sum":"$amount"},"orders":{"$sum":1}}},{"$sort":{"_id.year":1,"_id.month":1}}]\n\n' +
			"8. FILTER + GROUP + SORT + LIMIT:\n" +
			'[{"$match":{"status":"completed","createdAt":{"$gte":"2024-01-01"}}},{"$group":{"_id":"$userId","total":{"$sum":"$amount"}}},{"$sort":{"total":-1}},{"$limit":20}]\n\n' +
			"9. UNWIND ARRAY + GROUP:\n" +
			'[{"$unwind":"$tags"},{"$group":{"_id":"$tags","count":{"$sum":1}}},{"$sort":{"count":-1}}]\n\n' +
			"10. COMPLEX DASHBOARD:\n" +
			'[{"$facet":{"totalRevenue":[{"$group":{"_id":null,"total":{"$sum":"$amount"}}}],"byStatus":[{"$group":{"_id":"$status","count":{"$sum":1}}}],"topUsers":[{"$group":{"_id":"$userId","total":{"$sum":"$amount"}}},{"$sort":{"total":-1}},{"$limit":5}]}}]\n\n' +
			"═══════════════════════════════════════\n" +
			"TIPS:\n" +
			"• Use $match early to reduce documents processed\n" +
			"• Use indexes on fields in $match, $sort, $group\n" +
			"• $lookup works with _schema relationships stored by add_objectId_field tool\n" +
			"• Set allowDiskUse=true for large datasets (>100MB)\n" +
			"• Pipeline order matters: $match → $group → $sort → $project → $limit",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Aggregate",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "query",
			operation: "read",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
