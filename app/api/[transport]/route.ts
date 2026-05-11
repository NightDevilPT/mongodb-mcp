import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "npm_package",
      {
        title: "NPM Package Info",
        description: "Get npm package info: version, downloads, repo URL.",
        inputSchema: {
          name: z.string().describe("Package name, e.g. 'zod'"),
        },
      },
      async ({ name }) => {
        const [pkgRes, downloadsRes] = await Promise.all([
          fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`),
          fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`),
        ]);

        if (!pkgRes.ok) {
          return {
            content: [{ type: "text", text: `Package "${name}" not found.` }],
            isError: true,
          };
        }

        const pkg = await pkgRes.json();
        const downloads = await downloadsRes.json();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: pkg.name,
              version: pkg.version,
              description: pkg.description,
              weeklyDownloads: downloads.downloads?.toLocaleString() ?? "unknown",
              repository: pkg.repository?.url?.replace("git+", "").replace(".git", "") ?? null,
            }, null, 2),
          }],
        };
      }
    );
  },
  {},
  { basePath: "/api", maxDuration: 60, verboseLogs: true }
);

export { handler as GET, handler as POST };
