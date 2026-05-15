// lib/mcp/tools/crud/update-one.ts
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
		.describe("Document ID to update. Example: '507f1f77bcf86cd799439011'"),
	update: z
		.record(z.string(), z.unknown())
		.describe(
			"Fields to update as JSON object. Only provided fields are updated, others remain unchanged.\n\n" +
				'EXAMPLE: {"name":"John Updated","age":31}\n' +
				"- This updates only name and age\n" +
				"- Email and other fields stay the same\n" +
				"- If 'updatedAt' field exists in schema, it is auto-set to current date\n" +
				"- Use 'list_fields' tool to see available fields",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	id: z.string(),
	matchedCount: z.number(),
	modifiedCount: z.number(),
	acknowledged: z.boolean(),
	message: z.string(),
	updatedFields: z.array(z.string()).optional(),
	autoUpdateFields: z.array(z.string()).optional(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, id, update } = args as {
			database: string;
			collection: string;
			id: string;
			update: Record<string, unknown>;
		};

		// Validate inputs
		if (!database || database.trim() === "") {
			const er = {
				database: "",
				collection: collection || "",
				id: id || "",
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
				id: id || "",
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
		if (!id || id.trim() === "") {
			const er = {
				database,
				collection,
				id: "",
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: "Document ID required",
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
		if (!update || Object.keys(update).length === 0) {
			const er = {
				database,
				collection,
				id,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: "Update object cannot be empty",
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
		if ("_id" in update) {
			const er = {
				database,
				collection,
				id,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: "Cannot update _id field",
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

		let objectId: ObjectId;
		try {
			objectId = new ObjectId(id);
		} catch {
			const er = {
				database,
				collection,
				id,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: false,
				message: "Invalid document ID format",
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

		// Check database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		if (!dbList.databases.some((d: any) => d.name === database)) {
			await client.close();
			const er = {
				database,
				collection,
				id,
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

		// Check collection exists
		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				id,
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

		// Get schema for auto-update fields
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		const autoUpdateFields: string[] = [];
		const autoUpdateValues: Record<string, unknown> = {};

		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				const schema = options.validator.$jsonSchema;
				const properties = schema.properties || {};
				for (const [fieldName, fieldDef] of Object.entries(
					properties,
				)) {
					const def = fieldDef as any;
					if (def.autoUpdate && !(fieldName in update)) {
						autoUpdateValues[fieldName] = new Date();
						autoUpdateFields.push(fieldName);
					}
				}
			}
		}

		// Build final update with $set
		const finalUpdate: Record<string, unknown> = {
			$set: { ...update, ...autoUpdateValues },
		};

		const updatedFields = Object.keys(update);

		// Execute update
		let matchedCount = 0;
		let modifiedCount = 0;
		try {
			const result = await db
				.collection(collection)
				.updateOne({ _id: objectId }, finalUpdate);
			matchedCount = result.matchedCount;
			modifiedCount = result.modifiedCount;
		} catch (error) {
			await client.close();
			const er = {
				database,
				collection,
				id,
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

		if (matchedCount === 0) {
			const er = {
				database,
				collection,
				id,
				matchedCount: 0,
				modifiedCount: 0,
				acknowledged: true,
				message: `No document found with ID '${id}'`,
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

		const parts: string[] = [`Document updated`];
		parts.push(`Updated fields: ${updatedFields.join(", ")}`);
		if (autoUpdateFields.length > 0)
			parts.push(`Auto-updated: ${autoUpdateFields.join(", ")}`);

		const result = {
			database,
			collection,
			id,
			matchedCount,
			modifiedCount,
			acknowledged: true,
			message: parts.join(". ") + ".",
			updatedFields,
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
			id: (args as any).id || "",
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
export const updateOneTool = {
	name: "update_one",
	config: {
		title: "Update One Document",
		description:
			"[CRUD] Update a single document by its _id.\n\n" +
			"INPUT: database, collection, document ID, update object.\n" +
			"Only provided fields are updated, others remain unchanged.\n" +
			"If 'updatedAt' field exists in schema, it auto-sets to current date.\n\n" +
			"EXAMPLE: id='507f1f77bcf86cd799439011', update={'name':'John Updated','age':31}",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Update One Document",
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
