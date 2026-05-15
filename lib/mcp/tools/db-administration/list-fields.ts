// lib/mcp/tools/db-administration/list-fields.ts
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
};

// ============================================================
// OUTPUT SCHEMA
// ============================================================
const outputSchema = {
	database: z.string(),
	collection: z.string(),
	message: z.string(),
	fields: z.array(
		z.object({
			name: z.string(),
			type: z.string(),
			required: z.boolean(),
			validation: z.object({
				minLength: z.number().nullable(),
				maxLength: z.number().nullable(),
				minimum: z.union([z.number(), z.string()]).nullable(),
				maximum: z.union([z.number(), z.string()]).nullable(),
				pattern: z.string().nullable(),
				enum: z.array(z.string()).nullable(),
			}),
			indexes: z.array(
				z.object({
					name: z.string(),
					unique: z.boolean(),
					sparse: z.boolean(),
					ttl: z.number().nullable(),
				}),
			),
			description: z.string().nullable(),
		}),
	),
	totalCount: z.number(),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection } = args as {
			database: string;
			collection: string;
		};

		if (!database?.trim()) {
			const er = {
				database: "",
				collection: collection || "",
				message: "Database name required",
				fields: [],
				totalCount: 0,
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
				message: "Collection name required",
				fields: [],
				totalCount: 0,
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

		const cols = await db.listCollections().toArray();
		if (!cols.some((c: any) => c.name === collection)) {
			await client.close();
			const er = {
				database,
				collection,
				message: `Collection '${collection}' not found`,
				fields: [],
				totalCount: 0,
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

		// Get validator/schema
		const collInfo = await db
			.listCollections({ name: collection })
			.toArray();
		const properties: Record<string, any> = {};
		const requiredFields: string[] = [];

		if (collInfo.length > 0) {
			const options = (collInfo[0] as any).options;
			if (options?.validator?.$jsonSchema) {
				const schema = options.validator.$jsonSchema;
				Object.assign(properties, schema.properties || {});
				if (schema.required) {
					requiredFields.push(...schema.required);
				}
			}
		}

		// Get indexes
		const indexList = await db
			.collection(collection)
			.listIndexes()
			.toArray();

		// Build field list
		const fields: Array<{
			name: string;
			type: string;
			required: boolean;
			validation: {
				minLength: number | null;
				maxLength: number | null;
				minimum: number | string | null;
				maximum: number | string | null;
				pattern: string | null;
				enum: string[] | null;
			};
			indexes: Array<{
				name: string;
				unique: boolean;
				sparse: boolean;
				ttl: number | null;
			}>;
			description: string | null;
		}> = [];

		for (const [fieldName, fieldDef] of Object.entries(properties)) {
			const def = fieldDef as any;

			// Determine display type
			let typeStr = def.bsonType || "unknown";
			if (def.bsonType === "array" && def.items) {
				if (def.items.bsonType === "object" && def.items.properties) {
					const props = Object.keys(def.items.properties).join(", ");
					typeStr = `array of object {${props}}`;
				} else {
					typeStr = `array of ${def.items.bsonType || "unknown"}`;
				}
			}
			if (def.bsonType === "object" && def.properties) {
				const props = Object.keys(def.properties).join(", ");
				typeStr = `object {${props}}`;
			}

			// Find indexes for this field
			const fieldIndexes = indexList
				.filter((idx: any) => {
					const keys = Object.keys(idx.key || {});
					return keys.length === 1 && keys[0] === fieldName;
				})
				.map((idx: any) => ({
					name: idx.name,
					unique: idx.unique || false,
					sparse: idx.sparse || false,
					ttl: idx.expireAfterSeconds || null,
				}));

			fields.push({
				name: fieldName,
				type: typeStr,
				required: requiredFields.includes(fieldName),
				validation: {
					minLength: def.minLength ?? null,
					maxLength: def.maxLength ?? null,
					minimum: def.minimum ?? null,
					maximum: def.maximum ?? null,
					pattern: def.pattern ?? null,
					enum: def.enum ?? null,
				},
				indexes: fieldIndexes,
				description: def.description ?? null,
			});
		}

		await client.close();

		const result = {
			database,
			collection,
			message: `Found ${fields.length} field(s) in '${collection}'`,
			fields,
			totalCount: fields.length,
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
			message: `LIST_FIELDS_FAILED: ${error instanceof Error ? error.message : "Unknown"}`,
			fields: [],
			totalCount: 0,
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
export const listFieldsTool = {
	name: "list_fields",
	config: {
		title: "List Collection Fields",
		description:
			"[Database Administration] List all fields in a collection with complete details: type, required status, validation rules (min/max, pattern, enum), indexes (unique, sparse, TTL), and descriptions.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "List Collection Fields",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "read",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
