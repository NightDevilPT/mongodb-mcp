// lib/mcp/tools/list-databases.ts
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
	includeSize: z
		.boolean()
		.optional()
		.describe("Include database size information"),
	includeSystemDatabases: z
		.boolean()
		.optional()
		.describe("Include system databases (admin, config, local)"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	databases: z.array(
		z.object({
			name: z.string(),
			sizeOnDisk: z.number(),
			empty: z.boolean(),
		}),
	),
	totalCount: z.number(),
};

// ============================================================
// SYSTEM DATABASES TO EXCLUDE BY DEFAULT
// ============================================================
const SYSTEM_DATABASES = ["admin", "config", "local"];

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { includeSize, includeSystemDatabases } = args as {
			includeSize?: boolean;
			includeSystemDatabases?: boolean;
		};

		const { client: mongoClient } = await connectDB(extra, "admin");
		client = mongoClient;

		const adminDb = client.db("admin");
		const dbListResult = await adminDb.admin().listDatabases();

		let databases = dbListResult.databases.map((db) => ({
			name: db.name,
			sizeOnDisk: includeSize ? db.sizeOnDisk || 0 : 0,
			empty: includeSize ? (db.empty ?? true) : true,
		}));

		if (!includeSystemDatabases) {
			databases = databases.filter(
				(db) => !SYSTEM_DATABASES.includes(db.name),
			);
		}

		const result = {
			databases,
			totalCount: databases.length,
		};

		await client.close();

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
			databases: [],
			totalCount: 0,
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
export const listDatabasesTool = {
	name: "list_databases",
	config: {
		title: "List Databases",
		description:
			"[Database Administration] List all databases with optional size and system database inclusion. System databases (admin, config, local) are excluded by default.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "List Databases",
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
