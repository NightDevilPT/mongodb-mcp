// lib/mcp/tools/index.ts
import { dbConnectCheckTool } from "./db-connect-check";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";

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

export const tools: ToolDefinition[] = [dbConnectCheckTool];
