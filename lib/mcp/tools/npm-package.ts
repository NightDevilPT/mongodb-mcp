import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const inputSchema = {
  name: z.string().describe("Package name, e.g. 'zod'"),
};

const outputSchema = {
  name: z.string(),
  version: z.string(),
  description: z.string(),
  weeklyDownloads: z.string(),
  repository: z.string().nullable(),
};

const handler: ToolCallback<typeof inputSchema> = async ({ name }, extra: Extra) => {
  const [pkgRes, downloadsRes] = await Promise.all([
    fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`),
  ]);

  if (!pkgRes.ok) {
    return {
      content: [{ type: "text" as const, text: `Package "${name}" not found.` }],
      isError: true,
    };
  }

  const pkg = await pkgRes.json();
  const downloads = await downloadsRes.json();

  const result = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description || "",
    weeklyDownloads: downloads.downloads?.toLocaleString() ?? "unknown",
    repository: pkg.repository?.url?.replace("git+", "").replace(".git", "") ?? null,
  };

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(result, null, 2),
    }],
    structuredContent: result,
  };
};

export const npmPackageTool = {
  name: "npm_package" as const,
  config: {
    title: "NPM Package Info",
    description: "Get npm package info: version, downloads, repo URL.",
    inputSchema,
    outputSchema,
    annotations: {
      title: "NPM Package Lookup",
      readOnlyHint: true,       // Only reads data, no modifications
      destructiveHint: false,   // Doesn't delete or modify anything
      idempotentHint: true,     // Same package name always returns same data
      openWorldHint: true,      // Fetches from external npm registry
    },
    _meta: {
      category: "developer-tools",
      version: "1.0.0",
      author: "your-team",
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
      },
      cacheEnabled: true,
    },
  },
  handler,
};