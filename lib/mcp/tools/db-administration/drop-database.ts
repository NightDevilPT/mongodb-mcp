// lib/mcp/tools/db-administration/drop-database.ts
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
	database: z.string().describe("Database name to drop"),
	confirm: z
		.boolean()
		.describe("Confirmation toggle - must be true to proceed with drop"),
};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	database: z.string(),
	dropped: z.boolean(),
	message: z.string(),
};

// ============================================================
// SYSTEM DATABASES THAT CANNOT BE DROPPED
// ============================================================
const SYSTEM_DATABASES = ["admin", "config", "local"];

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
	let client;
	try {
		const { database, confirm } = args as {
			database: string;
			confirm: boolean;
		};

		// Validate confirmation toggle
		if (!confirm) {
			const errorResult = {
				database,
				dropped: false,
				message:
					"CONFIRMATION_FAILED: Confirmation toggle must be checked (true) to drop database",
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

		// Protect system databases
		if (SYSTEM_DATABASES.includes(database)) {
			const errorResult = {
				database,
				dropped: false,
				message: `SYSTEM_DATABASE_PROTECTED: Cannot drop system database '${database}'`,
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

		// Check if database exists
		const adminDb = client.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		const dbExists = dbList.databases.some((db) => db.name === database);

		if (!dbExists) {
			await client.close();
			const errorResult = {
				database,
				dropped: false,
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

		// Drop the database
		const db = client.db(database);
		await db.dropDatabase();

		await client.close();

		const result = {
			database,
			dropped: true,
			message: `Database '${database}' dropped successfully`,
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
			dropped: false,
			message: `DROP_DATABASE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const dropDatabaseTool = {
	name: "drop_database",
	config: {
		title: "Drop Database",
		description:
			"[Database Administration] Delete a database permanently. Confirmation toggle must be checked to proceed. System databases (admin, config, local) are protected.",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Drop Database",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "administration",
			operation: "write",
			destructive: true,
			requiresConfirmation: true,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
