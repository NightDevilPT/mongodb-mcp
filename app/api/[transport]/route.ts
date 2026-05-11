import { createMcpHandler } from "mcp-handler";
import { registerMcpComponents } from "@/lib/mcp";

const handler = createMcpHandler(
  (server) => {
    registerMcpComponents(server);
  },
  {},
  { basePath: "/api", maxDuration: 60, verboseLogs: true }
);

export { handler as GET, handler as POST };