// lib/mcp/tools/crud/insert-one.ts
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
	document: z
		.record(z.string(), z.unknown())
		.describe(
			'Document to insert as a JSON object. Example: {"name":"John","email":"john@example.com","age":30}\n\n' +
				"HOW TO KNOW WHAT FIELDS TO PROVIDE:\n" +
				"- Use 'list_fields' tool first to see all fields, their types, and which are required\n" +
				"- Use 'collection_stats' tool to see field details and indexes\n" +
				"- This tool will validate your document against the collection schema\n" +
				"- Required fields must be present\n" +
				"- Extra fields not in schema are allowed but will be reported\n" +
				"- Auto-set fields (like createdAt) are set automatically",
		),
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	insertedId: z.string(),
	acknowledged: z.boolean(),
	message: z.string(),
	schema: z
		.object({
			fields: z.array(
				z.object({
					name: z.string(),
					type: z.string(),
					required: z.boolean(),
					description: z.string().nullable(),
				}),
			),
		})
		.optional(),
	validatedFields: z.array(z.string()).optional(),
	missingFields: z.array(z.string()).optional(),
	extraFields: z.array(z.string()).optional(),
	autoSetFields: z.array(z.string()).optional(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection, document } = args as {
			database: string;
			collection: string;
			document: Record<string, unknown>;
		};

		// Validate inputs
		if (!database?.trim()) {
			const er = {
				database: "",
				collection: collection || "",
				insertedId: "",
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
		if (!collection?.trim()) {
			const er = {
				database,
				collection: "",
				insertedId: "",
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
		if (!document || Object.keys(document).length === 0) {
			const er = {
				database,
				collection,
				insertedId: "",
				acknowledged: false,
				message:
					"Document cannot be empty. Use 'list_fields' first to see what fields this collection expects.",
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
				insertedId: "",
				acknowledged: false,
				message: `DATABASE_NOT_FOUND: Database '${database}' does not exist. Use 'list_databases' to see available databases.`,
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
				insertedId: "",
				acknowledged: false,
				message: `COLLECTION_NOT_FOUND: Collection '${collection}' does not exist. Use 'list_collections' to see available collections.`,
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

		// Get collection validator/schema
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		const schemaFields: Record<string, any> = {};
		const requiredFields: string[] = [];
		let hasValidator = false;

		// Build schema info for output
		const schemaInfo: Array<{
			name: string;
			type: string;
			required: boolean;
			description: string | null;
		}> = [];

		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				hasValidator = true;
				const schema = options.validator.$jsonSchema;
				Object.assign(schemaFields, schema.properties || {});
				if (schema.required) {
					requiredFields.push(...schema.required);
				}

				// Build schema info
				for (const [fieldName, fieldDef] of Object.entries(
					schemaFields,
				)) {
					const def = fieldDef as any;
					let typeStr = def.bsonType || "unknown";
					if (def.bsonType === "array" && def.items) {
						typeStr = `array of ${def.items.bsonType || "unknown"}`;
					}
					schemaInfo.push({
						name: fieldName,
						type: typeStr,
						required: requiredFields.includes(fieldName),
						description: def.description || null,
					});
				}
			}
		}

		// If no schema, warn but allow insert
		if (!hasValidator) {
			// Insert document directly
			let insertedId = "";
			try {
				const result = await db
					.collection(collection)
					.insertOne(document);
				insertedId = result.insertedId.toString();
			} catch (error) {
				await client.close();
				const er = {
					database,
					collection,
					insertedId: "",
					acknowledged: false,
					message: `INSERT_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
				insertedId,
				acknowledged: true,
				message: `Document inserted with ID '${insertedId}'. NOTE: This collection has no schema validation. Consider adding fields using add_string_field, add_number_field, etc.`,
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

		// Validate document against schema
		const validatedFields: string[] = [];
		const missingFields: string[] = [];
		const extraFields: string[] = [];
		const autoSetFieldsList: string[] = [];
		const autoSetValues: Record<string, unknown> = {};

		// Check for missing required fields
		for (const field of requiredFields) {
			if (
				!(field in document) ||
				document[field] === undefined ||
				document[field] === null
			) {
				const fieldDef = schemaFields[field];
				if (fieldDef?.autoSet) {
					autoSetValues[field] = new Date();
					autoSetFieldsList.push(field);
					validatedFields.push(field);
				} else {
					missingFields.push(field);
				}
			} else {
				validatedFields.push(field);
			}
		}

		// Check provided fields against schema
		for (const key of Object.keys(document)) {
			if (!(key in schemaFields)) {
				extraFields.push(key);
			} else if (
				!validatedFields.includes(key) &&
				!missingFields.includes(key)
			) {
				validatedFields.push(key);
			}
		}

		// Return error if missing required fields
		if (missingFields.length > 0) {
			await client.close();
			const er = {
				database,
				collection,
				insertedId: "",
				acknowledged: false,
				message: `VALIDATION_FAILED: Missing required fields: ${missingFields.join(", ")}`,
				schema: { fields: schemaInfo },
				validatedFields,
				missingFields,
				extraFields: extraFields.length > 0 ? extraFields : undefined,
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

		// Merge auto-set fields
		const finalDocument = { ...document, ...autoSetValues };

		// Insert
		let insertedId = "";
		try {
			const result = await db
				.collection(collection)
				.insertOne(finalDocument);
			insertedId = result.insertedId.toString();
		} catch (error) {
			await client.close();
			const er = {
				database,
				collection,
				insertedId: "",
				acknowledged: false,
				message: `INSERT_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
				schema: { fields: schemaInfo },
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

		const parts: string[] = [`Document inserted with ID '${insertedId}'`];
		parts.push(`Validated ${validatedFields.length} field(s)`);
		if (extraFields.length > 0)
			parts.push(
				`${extraFields.length} extra field(s): ${extraFields.join(", ")}`,
			);
		if (autoSetFieldsList.length > 0)
			parts.push(`Auto-set: ${autoSetFieldsList.join(", ")}`);

		const result = {
			database,
			collection,
			insertedId,
			acknowledged: true,
			message: parts.join(". ") + ".",
			schema: { fields: schemaInfo },
			validatedFields,
			extraFields: extraFields.length > 0 ? extraFields : undefined,
			autoSetFields:
				autoSetFieldsList.length > 0 ? autoSetFieldsList : undefined,
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
			insertedId: "",
			acknowledged: false,
			message: `INSERT_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const insertOneTool = {
	name: "insert_one",
	config: {
		title: "Insert One Document",
		description:
			"[CRUD] Insert a single document into a collection.\n\n" +
			"═══════════════════════════════════════\n" +
			"HOW TO USE:\n" +
			"1. First use 'list_fields' tool to see what fields this collection has\n" +
			"2. Check which fields are 'required' - these MUST be in your document\n" +
			"3. Check field 'type' - provide correct data types\n" +
			"4. Auto-set fields (createdAt, updatedAt) are set automatically\n" +
			"5. Pass your document as a JSON object\n" +
			"═══════════════════════════════════════\n" +
			"VALIDATION:\n" +
			"- Required fields missing → Error with details\n" +
			"- Extra fields not in schema → Allowed but reported\n" +
			"- Auto-set date fields → Set automatically\n" +
			"- Returns schema info so AI knows what fields exist\n" +
			"═══════════════════════════════════════\n" +
			"EXAMPLE:\n" +
			"collection: 'users' (has fields: name, email, age)\n" +
			"document: {'name':'John','email':'john@example.com','age':30}",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Insert One Document",
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
