// lib/mcp/tools/create-database.ts
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
	database: z
		.string()
		.describe(
			"Database name (letters, numbers, underscores, hyphens, max 64 chars)",
		),
	collection: z
		.string()
		.optional()
		.describe("Initial collection name (default: '_setup')"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	created: z.boolean(),
	message: z.string(),
};

// ============================================================
// VALIDATION
// ============================================================
const DATABASE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_DATABASE_NAME_LENGTH = 64;
const SYSTEM_DATABASES = ["admin", "config", "local"];

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, collection } = args as {
			database: string;
			collection?: string;
		};

		// Validate database name
		if (!database || database.length === 0) {
			const errorResult = {
				database: database || "",
				created: false,
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

		if (database.length > MAX_DATABASE_NAME_LENGTH) {
			const errorResult = {
				database,
				created: false,
				message: `INVALID_DATABASE_NAME: Database name exceeds ${MAX_DATABASE_NAME_LENGTH} characters`,
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

		if (!DATABASE_NAME_REGEX.test(database)) {
			const errorResult = {
				database,
				created: false,
				message:
					"INVALID_DATABASE_NAME: Only letters, numbers, underscores, and hyphens allowed",
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

		if (SYSTEM_DATABASES.includes(database)) {
			const errorResult = {
				database,
				created: false,
				message: "INVALID_DATABASE_NAME: Cannot create system database",
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

		// Check if database already exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		const dbExists = dbList.databases.some((db) => db.name === database);

		if (dbExists) {
			await client.close();
			const errorResult = {
				database,
				created: false,
				message: "DATABASE_EXISTS: Database already exists",
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

		// Create database by inserting a document into initial collection
		const initialCollection = collection || "_setup";
		const db = client.db(database);
		await db.collection(initialCollection).insertOne({
			_created: new Date(),
			_message: "Database initialized",
		});

		await client.close();

		const result = {
			database,
			created: true,
			message: `Database '${database}' created successfully with collection '${initialCollection}'`,
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
			created: false,
			message: `CREATE_DATABASE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const createDatabaseTool = {
	name: "create_database",
	config: {
		title: "Create Database",
		description:
			"[Database Administration] Create a new database with an initial collection. Database name must contain only letters, numbers, underscores, and hyphens (max 64 chars).",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Create Database",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "write",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
