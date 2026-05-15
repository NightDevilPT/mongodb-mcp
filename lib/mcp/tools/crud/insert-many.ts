// lib/mcp/tools/crud/insert-many.ts
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
	documents: z
		.array(z.record(z.string(), z.unknown()))
		.describe(
			'Array of documents to insert. Example: [{"name":"John","email":"john@example.com"},{"name":"Jane","email":"jane@example.com"}]\n\n' +
				"MAX: 1000 documents per batch.\n" +
				"Use 'list_fields' tool first to see required fields and their types.\n" +
				"If 'createdAt' field exists in collection schema, it will be automatically set to current date for each document.\n" +
				"If 'updatedAt' field exists in collection schema, it will be automatically set to current date for each document.",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	insertedCount: z.number(),
	insertedIds: z.array(z.string()),
	acknowledged: z.boolean(),
	message: z.string(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, documents } = args as {
			database: string;
			collection: string;
			documents: Record<string, unknown>[];
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
				message: "INSERT_FAILED: Database name cannot be empty",
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
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
				message: "INSERT_FAILED: Collection name cannot be empty",
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

		if (!documents || !Array.isArray(documents) || documents.length === 0) {
			const errorResult = {
				database,
				collection,
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
				message: "INSERT_FAILED: documents must be a non-empty array",
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

		if (documents.length > 1000) {
			const errorResult = {
				database,
				collection,
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
				message: `BATCH_TOO_LARGE: Maximum 1000 documents per batch. Got ${documents.length}`,
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
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
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
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
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

		// Get schema for auto-set fields
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		const autoSetFields: string[] = [];

		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				const schema = options.validator.$jsonSchema;
				const properties = schema.properties || {};
				for (const [fieldName, fieldDef] of Object.entries(
					properties,
				)) {
					const def = fieldDef as any;
					if (def.autoSet) {
						autoSetFields.push(fieldName);
					}
				}
			}
		}

		// Apply auto-set fields to each document
		const now = new Date();
		for (const doc of documents) {
			for (const field of autoSetFields) {
				if (
					!(field in doc) ||
					doc[field] === undefined ||
					doc[field] === null
				) {
					doc[field] = now;
				}
			}
		}

		// Insert documents
		let result: any;
		try {
			result = await db.collection(collection).insertMany(documents);
		} catch (error) {
			await client.close();
			const errorResult = {
				database,
				collection,
				insertedCount: 0,
				insertedIds: [],
				acknowledged: false,
				message: `INSERT_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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

		const insertedIds = Object.values(result.insertedIds).map((id: any) =>
			id.toString(),
		);

		const res = {
			database,
			collection,
			insertedCount: result.insertedCount,
			insertedIds,
			acknowledged: result.acknowledged,
			message: `Successfully inserted ${result.insertedCount} document(s) into '${collection}'${autoSetFields.length > 0 ? `. Auto-set fields: ${autoSetFields.join(", ")}` : ""}`,
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
			insertedCount: 0,
			insertedIds: [],
			acknowledged: false,
			message: `INSERT_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const insertManyTool = {
	name: "insert_many",
	config: {
		title: "Insert Many Documents",
		description:
			"[CRUD] Insert multiple documents into a collection.\n\n" +
			"═══════════════════════════════════════\n" +
			"FEATURES:\n" +
			"- Accepts array of documents as JSON\n" +
			"- Max 1000 documents per batch\n" +
			"- Auto-sets createdAt/updatedAt if fields exist in schema\n" +
			"- Validates database and collection exist\n" +
			"═══════════════════════════════════════\n" +
			"EXAMPLE:\n" +
			'documents: [{"name":"John","email":"john@example.com"},{"name":"Jane","email":"jane@example.com"}]',
		inputSchema,
		outputSchema,
		annotations: {
			title: "Insert Many Documents",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "crud",
			operation: "write",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
