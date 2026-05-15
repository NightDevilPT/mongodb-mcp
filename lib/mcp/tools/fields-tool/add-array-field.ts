// lib/mcp/tools/add-array-field.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "@/lib/utils/connection";
import {
	validateDatabaseName,
	validateCollectionName,
	updateCollectionValidator,
} from "@/lib/utils/field-validation";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {
	database: z
		.string()
		.describe("Database name (e.g., 'e_commerce', 'my_app')"),
	collection: z
		.string()
		.describe("Collection name (e.g., 'users', 'products')"),
	name: z
		.string()
		.describe(
			"Field name for the array (e.g., 'tags', 'addresses', 'scores', 'items', 'matrix')",
		),
	itemType: z
		.enum(["string", "number", "boolean", "object", "array"])
		.describe(
			"Type of items in the array. 'string' = ['a','b'], 'number' = [1,2,3], 'boolean' = [true,false], 'object' = [{...}], 'array' = [[1,2],[3,4]]",
		),
	required: z
		.boolean()
		.optional()
		.describe(
			"Whether this field must be present in every document (e.g., true = required, false = optional)",
		),
	minItems: z
		.number()
		.optional()
		.describe(
			"Minimum number of items allowed in the array (e.g., 1 = at least one item required). MongoDB validation: minItems",
		),
	maxItems: z
		.number()
		.optional()
		.describe(
			"Maximum number of items allowed in the array (e.g., 10 = no more than 10 items). MongoDB validation: maxItems",
		),
	uniqueItems: z
		.boolean()
		.optional()
		.describe(
			"Whether all items in the array must be unique (e.g., true = no duplicate values). MongoDB validation: uniqueItems",
		),
	objectFields: z
		.record(z.string(), z.string())
		.optional()
		.describe(
			"[OBJECT ONLY] Define properties of each object in the array. Key=fieldName, Value=fieldType. Example: {'street':'string','city':'string','zip':'number'}. Supported types: string, number, boolean, objectId, date.",
		),
	objectRequired: z
		.string()
		.optional()
		.describe(
			"[OBJECT ONLY] Comma-separated list of required fields inside each object. Example: 'street,city' makes street and city required inside every object.",
		),
	description: z
		.string()
		.optional()
		.describe(
			"Human-readable description of this field. Example: 'List of user shipping addresses'. Stored as metadata only, not enforced by MongoDB.",
		),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	field: z.string(),
	added: z.boolean(),
	message: z.string(),
};

// ============================================================
// BSON TYPE MAPPING - All supported by MongoDB $jsonSchema
// ============================================================
const ITEM_BSON_TYPE: Record<string, string> = {
	string: "string",
	number: "number",
	boolean: "bool",
	object: "object",
	array: "array",
	objectId: "objectId",
	date: "date",
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
			name,
			itemType,
			required,
			minItems,
			maxItems,
			uniqueItems,
			objectFields,
			objectRequired,
			description,
		} = args as {
			database: string;
			collection: string;
			name: string;
			itemType: string;
			required?: boolean;
			minItems?: number;
			maxItems?: number;
			uniqueItems?: boolean;
			objectFields?: Record<string, string>;
			objectRequired?: string;
			description?: string;
		};

		// Validate database name
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				field: name || "",
				added: false,
				message: "INVALID_DATABASE_NAME: Database name cannot be empty",
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

		// Validate collection name
		if (!collection || collection.trim() === "") {
			const errorResult = {
				database,
				collection: "",
				field: name || "",
				added: false,
				message:
					"INVALID_COLLECTION_NAME: Collection name cannot be empty",
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

		// Validate field name
		if (!name || name.trim() === "") {
			const errorResult = {
				database,
				collection,
				field: "",
				added: false,
				message: "INVALID_FIELD_NAME: Field name cannot be empty",
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

		// Validate min/max items
		if (
			minItems !== undefined &&
			maxItems !== undefined &&
			minItems > maxItems
		) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: minItems cannot be greater than maxItems",
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

		if (minItems !== undefined && minItems < 0) {
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message:
					"INVALID_FIELD_VALIDATION: minItems cannot be negative",
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

		// Parse required fields for object
		let requiredFields: string[] = [];
		if (objectRequired && objectRequired.trim() !== "") {
			requiredFields = objectRequired
				.split(",")
				.map((f) => f.trim())
				.filter((f) => f !== "");
		}

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;

		// Check if database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		const dbExists = dbList.databases.some((db) => db.name === database);

		if (!dbExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
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

		const db = client.db(database);

		// Check if collection exists
		const collections = await db.listCollections().toArray();
		const collectionExists = collections.some(
			(col) => col.name === collection,
		);

		if (!collectionExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
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

		// Check if field already exists
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		if (
			collInfo.length > 0 &&
			(collInfo[0] as any).options?.validator?.$jsonSchema?.properties?.[
				name
			]
		) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: name,
				added: false,
				message: `DUPLICATE_FIELD: Field '${name}' already exists`,
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

		// Build array field definition (MongoDB $jsonSchema compatible)
		const fieldDef: Record<string, unknown> = {
			bsonType: "array",
			description: description || `${name} field (array of ${itemType})`,
		};

		// Build items definition
		if (
			itemType === "object" &&
			objectFields &&
			Object.keys(objectFields).length > 0
		) {
			const properties: Record<string, unknown> = {};
			for (const [fieldName, fieldType] of Object.entries(objectFields)) {
				properties[fieldName] = {
					bsonType: ITEM_BSON_TYPE[fieldType] || fieldType,
					description: `${fieldName} field`,
				};
			}

			const objectSchema: Record<string, unknown> = {
				bsonType: "object",
				properties,
				additionalProperties: true, // Allows extra fields not defined
			};

			if (requiredFields.length > 0) {
				objectSchema.required = requiredFields;
			}

			fieldDef.items = objectSchema;
		} else {
			const itemBsonType = ITEM_BSON_TYPE[itemType] || itemType;
			fieldDef.items = { bsonType: itemBsonType };
		}

		// MongoDB supports these validations
		if (minItems !== undefined) fieldDef.minItems = minItems;
		if (maxItems !== undefined) fieldDef.maxItems = maxItems;
		if (uniqueItems) fieldDef.uniqueItems = true;

		// Update collection validator
		await updateCollectionValidator(
			db,
			collection,
			name,
			fieldDef,
			required,
		);

		await client.close();

		let msg = `Array field '${name}' (array of ${itemType})`;
		if (
			itemType === "object" &&
			objectFields &&
			Object.keys(objectFields).length > 0
		) {
			const fieldCount = Object.keys(objectFields).length;
			msg += ` with ${fieldCount} object properties`;
		}
		msg += ` added successfully to '${collection}'`;

		const result = {
			database,
			collection,
			field: name,
			added: true,
			message: msg,
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
			database: (args as { database: string }).database || "",
			collection: (args as { collection: string }).collection || "",
			field: (args as { name: string }).name || "",
			added: false,
			message: `ADD_FIELD_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const addArrayFieldTool = {
	name: "add_array_field",
	config: {
		title: "Add Array Field",
		description:
			"[Schema] Add an array field with MongoDB $jsonSchema validation.\n\n" +
			"MongoDB ENFORCED validations:\n" +
			"- minItems/maxItems: Array length limits\n" +
			"- uniqueItems: No duplicate items\n" +
			"- itemType: Type of items (string/number/boolean/object/array)\n" +
			"- objectFields: Object property definitions with types\n" +
			"- objectRequired: Required fields inside objects\n" +
			"- required: Field must be present\n\n" +
			"EXAMPLES:\n" +
			"- Array of strings: itemType='string' → ['apple','banana']\n" +
			"- Array of numbers: itemType='number' → [1,2,3]\n" +
			"- Array of objects: itemType='object', objectFields={'street':'string','city':'string'}, objectRequired='street,city'\n" +
			"- Array of arrays: itemType='array' → [[1,2],[3,4]]",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Add Array Field",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "schema",
			subcategory: "fields",
			operation: "write",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
