// lib/mcp/tools/index.ts
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { listDatabasesTool } from "./list-databases";
import { dbConnectCheckTool } from "./db-connect-check";
import { createDatabaseTool } from "./create-database";
import { dropDatabaseTool } from "./drop-database";
import { databaseStatsTool } from "./database-stats";
import { listCollectionsTool } from "./list-collections";
import { createCollectionTool } from "./create-collection";
import { dropCollectionTool } from "./drop-collection";
import { renameCollectionTool } from "./rename-collection";

interface ToolDefinition {
	name: string;
	config: {
		title?: string;
		description?: string;
		inputSchema?: ZodRawShapeCompat;
		outputSchema?: ZodRawShapeCompat;
		annotations?: Record<string, unknown>;
		_meta?: Record<string, unknown>;
	};
	handler: ToolCallback<ZodRawShapeCompat>;
}

export const tools: ToolDefinition[] = [
	dbConnectCheckTool,
	listDatabasesTool,
	createDatabaseTool,
	dropDatabaseTool,
	databaseStatsTool,
	listCollectionsTool,
	createCollectionTool,
	dropCollectionTool,
	renameCollectionTool,
];
