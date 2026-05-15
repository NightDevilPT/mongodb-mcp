// lib/mcp/tools/add-objectid-field.ts
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
	// === WHERE ARE WE? ===
	database: z.string().describe("Database name. Example: 'e_commerce'"),
	collection: z
		.string()
		.describe(
			"Collection that HOLDS the reference (the CHILD collection). Example: 'orders' collection needs userId to know who placed the order, 'profiles' collection needs userId to link to user",
		),

	// === THE FIELD ===
	fieldName: z
		.string()
		.describe(
			"Name of the reference field. Use the referenced collection name + 'Id'. Examples: 'userId' (links to users), 'productId' (links to products), 'categoryId' (links to categories), 'sellerId' (links to users as seller)",
		),

	// === WHO DOES IT POINT TO? ===
	referencesCollection: z
		.string()
		.describe(
			"Collection being referenced (the PARENT collection). Example: if fieldName is 'userId', this is 'users'. If fieldName is 'productId', this is 'products'. MUST exist before adding this field.",
		),
	referencesField: z
		.string()
		.optional()
		.describe(
			"Field in the referenced collection to link to. Default is '_id'. Example: '_id' (standard MongoDB ID), 'email' (if linking by email instead of ID)",
		),

	// === RELATIONSHIP TYPE ===
	relationshipType: z
		.enum(["one-to-one", "one-to-many"])
		.describe(
			"'one-to-one': Each document in THIS collection links to exactly ONE unique document in referenced collection. Creates UNIQUE index. Example: 'profiles' collection → each profile links to ONE user (unique userId). " +
				"'one-to-many': Many documents in THIS collection can link to the SAME document in referenced collection. Creates REGULAR index. Example: 'orders' collection → many orders can belong to the SAME user (non-unique userId).",
		),

	// === VALIDATION ===
	isRequired: z
		.boolean()
		.optional()
		.describe(
			"Must this reference always be present? Example: true = every order MUST have a userId (who placed it). false = optional (e.g., guest checkout without user)",
		),

	// === INDEX ===
	createIndex: z
		.boolean()
		.optional()
		.describe(
			"Create index for faster lookups? Default is true. RECOMMENDED for all foreign keys. Example: index on orders.userId speeds up 'find all orders for user X' queries.",
		),
	createSparseIndex: z
		.boolean()
		.optional()
		.describe(
			"Only index documents that have this field? Use if some documents may not have this reference. Example: true if some orders don't have a userId (guest orders)",
		),

	// === DESCRIPTION ===
	description: z
		.string()
		.optional()
		.describe(
			"Human-readable description. Example: 'The user who placed this order' for orders.userId, 'The product being ordered' for orders.productId",
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
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const {
			database,
			collection,
			fieldName,
			referencesCollection,
			referencesField,
			relationshipType,
			isRequired,
			createIndex,
			createSparseIndex,
			description,
		} = args as {
			database: string;
			collection: string;
			fieldName: string;
			referencesCollection: string;
			referencesField?: string;
			relationshipType: string;
			isRequired?: boolean;
			createIndex?: boolean;
			createSparseIndex?: boolean;
			description?: string;
		};

		// Validate database name
		if (!database || database.trim() === "") {
			const errorResult = {
				database: "",
				collection: collection || "",
				field: fieldName || "",
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
				field: fieldName || "",
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
		if (!fieldName || fieldName.trim() === "") {
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

		// Validate referencesCollection
		if (!referencesCollection || referencesCollection.trim() === "") {
			const errorResult = {
				database,
				collection,
				field: fieldName,
				added: false,
				message:
					"INVALID_REFERENCE: referencesCollection is required. Specify which collection this field links to.",
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

		// Cannot reference itself
		if (collection === referencesCollection) {
			const errorResult = {
				database,
				collection,
				field: fieldName,
				added: false,
				message:
					"INVALID_REFERENCE: A collection cannot reference itself. Use a different collection name.",
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

		const refField = referencesField || "_id";
		const shouldIndex = createIndex !== undefined ? createIndex : true;
		const isUnique = relationshipType === "one-to-one";

		const { client: mongoClient } = await connectDB(extra);
		client = mongoClient;

		const db = client.db(database);

		// Check if THIS collection exists
		const collections = await db.listCollections().toArray();
		const thisCollectionExists = collections.some(
			(col) => col.name === collection,
		);

		if (!thisCollectionExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: fieldName,
				added: false,
				message: `COLLECTION_NOT_FOUND: This collection '${collection}' does not exist. Create it first using create_collection.`,
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

		// Check if REFERENCED collection exists
		const refExists = collections.some(
			(col) => col.name === referencesCollection,
		);

		if (!refExists) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: fieldName,
				added: false,
				message: `REFERENCE_NOT_FOUND: Referenced collection '${referencesCollection}' does not exist. Create it first using create_collection.`,
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
				fieldName
			]
		) {
			await client.close();
			const errorResult = {
				database,
				collection,
				field: fieldName,
				added: false,
				message: `DUPLICATE_FIELD: Field '${fieldName}' already exists in '${collection}'`,
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

		// Build field definition
		const fieldDef: Record<string, unknown> = {
			bsonType: "objectId",
			description:
				description ||
				`Links to ${referencesCollection}.${refField} (${relationshipType})`,
		};

		// Update collection validator
		await updateCollectionValidator(
			db,
			collection,
			fieldName,
			fieldDef,
			isRequired,
		);

		// Create index
		if (shouldIndex) {
			try {
				const indexOptions: Record<string, unknown> = {
					background: true,
					...(isUnique ? { unique: true } : {}),
					...(createSparseIndex ? { sparse: true } : {}),
				};
				await db
					.collection(collection)
					.createIndex({ [fieldName]: 1 }, indexOptions);
			} catch {
				// Index failed but field added
			}
		}

		// ============================================================
		// STORE BIDIRECTIONAL RELATIONSHIP IN _schema
		// ============================================================

		// 1. Store in THIS collection: "I reference X"
		await db.collection("_schema").updateOne(
			{ collection: collection, database: database },
			{
				$addToSet: {
					references: {
						field: fieldName,
						referencesCollection: referencesCollection,
						referencesField: refField,
						relationshipType: relationshipType,
					},
				} as any,
				$set: { updatedAt: new Date() },
			},
			{ upsert: true },
		);

		// 2. Store in REFERENCED collection: "X is referenced by me"
		await db.collection("_schema").updateOne(
			{ collection: referencesCollection, database: database },
			{
				$addToSet: {
					referencedBy: {
						collection: collection,
						field: fieldName,
						relationshipType: relationshipType,
					},
				} as any,
				$set: { updatedAt: new Date() },
			},
			{ upsert: true },
		);

		await client.close();

		const indexType = isUnique ? "unique index" : "index";
		const result = {
			database,
			collection,
			field: fieldName,
			added: true,
			message: `Reference field '${fieldName}' added to '${collection}' → links to '${referencesCollection}.${refField}' (${relationshipType}) with ${indexType}`,
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
			field: (args as { fieldName: string }).fieldName || "",
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
export const addObjectIdFieldTool = {
	name: "add_objectId_field",
	config: {
		title: "Add Reference Field (Foreign Key)",
		description:
			"[Schema] Add a reference field that links this collection to another collection.\n\n" +
			"═══════════════════════════════════════\n" +
			"WHEN TO USE:\n" +
			"• orders needs userId → links to users\n" +
			"• orders needs productId → links to products\n" +
			"• profiles needs userId → links to users\n" +
			"• reviews needs productId → links to products\n" +
			"═══════════════════════════════════════\n\n" +
			"HOW IT WORKS:\n" +
			"1. Adds ObjectId field to THIS collection\n" +
			"2. Creates index for fast lookups\n" +
			"3. Verifies referenced collection exists\n" +
			"4. Stores relationship in _schema on BOTH sides\n" +
			"═══════════════════════════════════════\n\n" +
			"E-COMMERCE EXAMPLE:\n" +
			"orders.userId → users._id (one-to-many)\n" +
			"orders.productId → products._id (one-to-many)\n" +
			"profiles.userId → users._id (one-to-one)\n" +
			"═══════════════════════════════════════",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Add Reference Field",
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
