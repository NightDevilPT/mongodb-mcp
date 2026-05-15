// lib/mcp/tools/db-connect-check.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB, getMongoURI } from "@/lib/utils/connection";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// INPUT SCHEMA
// ============================================================
const inputSchema = {};

// ============================================================
// OUTPUT SCHEMA - Must match structuredContent exactly
// ============================================================
const outputSchema = {
	connected: z.boolean(),
	message: z.string(),
	host: z.string(),
	version: z.string(),
	database: z.string(),
	collections: z.number(),
	collectionList: z.array(z.string()),
};

// ============================================================
// HANDLER
// ============================================================
const handler: ToolCallback<typeof inputSchema> = async (args, extra) => {
	let client;
	try {
		const { client: mongoClient, db } = await connectDB(extra);
		client = mongoClient;

		const adminDb = db.admin();
		const serverInfo = await adminDb.serverInfo();
		const collectionList = await db.listCollections().toArray();
		const collectionNames = collectionList.map((c) => c.name);

		const uri = getMongoURI(extra) || "localhost:27017";

		const result = {
			connected: true,
			message: "Successfully connected to MongoDB",
			host: uri.replace(/\/\/.*@/, "//***@"),
			version: serverInfo.version,
			database: db.databaseName,
			collections: collectionNames.length,
			collectionList: collectionNames,
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
			connected: false,
			message: error instanceof Error ? error.message : "Unknown error",
			host: "",
			version: "",
			database: "",
			collections: 0,
			collectionList: [] as string[],
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
export const dbConnectCheckTool = {
	name: "db_connect_check",
	config: {
		title: "Database Connection Check",
		description:
			"[Database Administration] Check MongoDB connection status and get server information including version, database name, host, and collection list",
		inputSchema,
		outputSchema,
		annotations: {
			title: "Database Connection Check",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		_meta: {
			category: "database",
			subcategory: "connection",
			operation: "read",
			destructive: false,
			requiresConfirmation: false,
			version: "1.0.0",
			author: "NightDevilPT",
		},
	},
	handler,
};
