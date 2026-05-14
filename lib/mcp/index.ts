// lib/mcp/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools";

export function registerMcpComponents(server: McpServer) {
	for (const tool of tools) {
		server.registerTool(tool.name, tool.config, tool.handler);
	}
}
