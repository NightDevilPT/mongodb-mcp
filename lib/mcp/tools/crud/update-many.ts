// lib/mcp/tools/crud/update-many.ts
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
	updates: z
		.array(
			z.object({
				id: z
					.string()
					.describe(
						"Document ID to update. Example: '507f1f77bcf86cd799439011'",
					),
				fields: z
					.record(z.string(), z.unknown())
					.describe(
						'Fields to update for this document. Example: {"name":"John Updated","age":31}',
					),
			}),
		)
		.describe(
			"Array of updates. Each object has an 'id' and 'fields' to update.\n\n" +
				'EXAMPLE: [{"id":"507f1f77bcf86cd799439011","fields":{"name":"John","age":30}},{"id":"507f1f77bcf86cd799439012","fields":{"name":"Jane","status":"active"}}]\n\n' +
				"MAX: 1000 updates per batch.\n" +
				"Only provided fields are updated, others remain unchanged.\n" +
				"If 'updatedAt' field exists in schema, it auto-sets for each document.",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	matchedCount: z.number(),
	modifiedCount: z.number(),
	acknowledged: z.boolean(),
	message: z.string(),
	results: z
		.array(
			z.object({
				id: z.string(),
				matched: z.boolean(),
				modified: z.boolean(),
			}),
		)
		.optional(),
	autoUpdateFields: z.array(z.string()).optional(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, updates } = args as {
			database: string;
			collection: string;
			updates: Array<{ id: string; fields: Record<string, unknown> }>;
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const er = {
				database: "",
				collection: collection || "",
				matchedCount: 0,
				modifiedCount: 0,
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
				matchedCount: 0,
				modifiedCount: 0,
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
		if (!updates || !Array.isArray(updates) || updates.length === 0) {
			const er = {
				database,
				collection,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: "Updates array required",
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
		if (updates.length > 1000) {
			const er = {
				database,
				collection,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: `BATCH_TOO_LARGE: Max 1000 updates per batch. Got ${updates.length}`,
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

		// Validate each update
		for (const u of updates) {
			if (!u.id || u.id.trim() === "") {
				const er = {
					database,
					collection,
					matchedCount: 0,
					modifiedCount: 0,
					acknowledged: false,
					message: "Each update must have an 'id' field",
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
			if (!u.fields || Object.keys(u.fields).length === 0) {
				const er = {
					database,
					collection,
					matchedCount: 0,
					modifiedCount: 0,
					acknowledged: false,
					message: `Update for ID '${u.id}' has no fields to update`,
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
			if ("_id" in u.fields) {
				const er = {
					database,
					collection,
					matchedCount: 0,
					modifiedCount: 0,
					acknowledged: false,
					message: `Cannot update _id field for ID '${u.id}'`,
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

		// Check database
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		if (!dbList.databases.some((d: any) => d.name === database)) {
			await client.close();
			const er = {
				database,
				collection,
				matchedCount: 0,
				modifiedCount: 0,
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

		// Check collection
		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				matchedCount: 0,
				modifiedCount: 0,
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

		// Get auto-update fields
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		const autoUpdateFields: string[] = [];
		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				const schema = options.validator.$jsonSchema;
				for (const [fieldName, fieldDef] of Object.entries(
					schema.properties || {},
				)) {
					if ((fieldDef as any).autoUpdate) {
						autoUpdateFields.push(fieldName);
					}
				}
			}
		}

		// Build bulk operations
		const now = new Date();
		const bulkOps: any[] = [];
		const results: Array<{
			id: string;
			matched: boolean;
			modified: boolean;
		}> = [];

		for (const u of updates) {
			const fields = { ...u.fields };
			for (const field of autoUpdateFields) {
				if (!(field in fields)) {
					fields[field] = now;
				}
			}
			bulkOps.push({
				updateOne: {
					filter: { _id: new ObjectId(u.id) },
					update: { $set: fields },
				},
			});
		}

		// Execute bulk write
		let totalMatched = 0;
		let totalModified = 0;
		try {
			const bulkResult = await db
				.collection(collection)
				.bulkWrite(bulkOps, { ordered: false });
			totalMatched = bulkResult.matchedCount;
			totalModified = bulkResult.modifiedCount;
		} catch (error) {
			await client.close();
			const er = {
				database,
				collection,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: `UPDATE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
			matchedCount: totalMatched,
			modifiedCount: totalModified,
			acknowledged: true,
			message: `Updated ${totalModified} of ${updates.length} document(s) in '${collection}'${autoUpdateFields.length > 0 ? `. Auto-updated: ${autoUpdateFields.join(", ")}` : ""}`,
			autoUpdateFields:
				autoUpdateFields.length > 0 ? autoUpdateFields : undefined,
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
			matchedCount: 0,
			modifiedCount: 0,
			acknowledged: false,
			message: `UPDATE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const updateManyTool = {
	name: "update_many",
	config: {
		title: "Update Many Documents",
		description:
			"[CRUD] Update multiple documents by their IDs in a single batch.\n\n" +
			"INPUT: database, collection, array of {id, fields} objects.\n" +
			"Uses bulkWrite for performance. Max 1000 updates.\n" +
			"Only provided fields are updated, others unchanged.\n" +
			"Auto-updates 'updatedAt' if field exists in schema.\n\n" +
			'EXAMPLE: [{"id":"507f...","fields":{"name":"John"}},{"id":"507f...","fields":{"status":"active"}}]',
		inputSchema,
		outputSchema,
		annotations: {
			title: "Update Many Documents",
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
