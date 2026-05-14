# **MCP Server Development Rule Book v5.1**
## *MongoDB MCP Server - Complete Development Standard*

---

## **1. SDK REFERENCE**

### 1.1 `registerTool` Signature
```typescript
registerTool<OutputArgs, InputArgs>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: {
      title?: string;
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
    _meta?: Record<string, any>;
  },
  cb: ToolCallback<InputArgs>
): RegisteredTool;
```

### 1.2 NOT Built-in
- ❌ Rate limiting, Caching, Authentication
- ❌ Elicitation (no mid-execution user prompts)
- ❌ `_meta` enforcement (documentation only)

---

## **2. FILE ORGANIZATION**

```
lib/
├── mcp/
│   ├── index.ts              # Register all components
│   ├── tools/
│   │   ├── index.ts          # Tools array
│   │   └── [name].ts         # One file per tool
│   ├── resources/
│   │   ├── index.ts          # Resources array
│   │   └── [name].ts         # One file per resource
│   └── prompts/
│       ├── index.ts          # Prompts array
│       └── [name].ts         # One file per prompt
└── utils/
    └── connection.ts         # MongoDB connection utilities
```

---

## **3. NAMING RULES**

| Element | Convention | Example |
|---------|-----------|---------|
| Tool name | `snake_case` | `db_connect_check` |
| File name | `kebab-case.ts` | `db-connect-check.ts` |
| Export variable | `camelCase` + `Tool` | `dbConnectCheckTool` |
| Schema fields | `camelCase` | `collectionList` |
| Utility functions | `camelCase` | `connectDB` |

---

## **4. UTILITY FUNCTIONS (Reusable)**

### 4.1 Rule: Reusable logic MUST go in `lib/utils/`

```typescript
// lib/utils/connection.ts
import { MongoClient, Db } from "mongodb";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function getMongoURI(extra?: Extra): string | undefined {
  if (extra) {
    const headerValue = extra.requestInfo?.headers?.["mongodb_uri"];
    const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (fromHeader) return fromHeader;
  }
  return process.env.MONGODB_URI;
}

export async function connectDB(
  extra?: Extra,
  dbName?: string
): Promise<{ client: MongoClient; db: Db }> {
  const uri = getMongoURI(extra);
  if (!uri) {
    throw new Error("MONGODB_URI not configured. Set it in MCP Inspector Environment Variables.");
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();

  const database = dbName || "test";
  const db = client.db(database);

  return { client, db };
}
```

---

## **5. TOOL TEMPLATE**

```typescript
// lib/mcp/tools/tool-name.ts
import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "@/lib/utils/connection";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const inputSchema = {
  database: z.string().describe("Database name"),
};

const outputSchema = {
  field1: z.string(),
  field2: z.number(),
};

const handler: ToolCallback<ZodRawShapeCompat> = async (args, extra) => {
  const { database } = args as { database: string };

  let client;
  try {
    const { client: mongoClient, db } = await connectDB(extra, database);
    client = mongoClient;

    // Business logic

    await client.close();

    const result = {
      field1: "value",
      field2: 123,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (error) {
    if (client) await client.close();
    const errorResult = {
      field1: "",
      field2: 0,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(errorResult, null, 2) }],
      structuredContent: errorResult,
      isError: true,
    };
  }
};

export const toolNameTool = {
  name: "tool_name",
  config: {
    title: "Human Readable Title",
    description: "One line description",
    inputSchema,
    outputSchema,
    annotations: {
      title: "Human Readable Title",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: {
      category: "database",
      version: "1.0.0",
      author: "NightDevilPT",
    },
  },
  handler,
};
```

---

## **6. REGISTRATION PATTERN**

### 6.1 Main Registration
```typescript
// lib/mcp/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { tools } from "./tools";

export function registerMcpComponents(server: McpServer) {
  for (const tool of tools) {
    server.registerTool<ZodRawShapeCompat, ZodRawShapeCompat>(
      tool.name,
      tool.config,
      tool.handler
    );
  }
}
```

### 6.2 Tools Registry
```typescript
// lib/mcp/tools/index.ts
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { dbConnectCheckTool } from "./db-connect-check";
import { listDatabasesTool } from "./list-databases";

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

export const tools: ToolDefinition[] = [dbConnectCheckTool, listDatabasesTool];
```

---

## **7. MANDATORY RULES**

### 7.1 Tool Rules
- [ ] `inputSchema` with Zod validation and `.describe()` on every field
- [ ] `outputSchema` MUST match `structuredContent` exactly (no extra/missing fields)
- [ ] Handler type: `ToolCallback<ZodRawShapeCompat>`
- [ ] Destructure args with type assertion: `const { field } = args as { field: string }`
- [ ] Handler uses try-catch
- [ ] Always close MongoDB client: `if (client) await client.close()` in try AND catch
- [ ] Annotations correct: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

### 7.2 Response Content Rules
- [ ] `content.text` MUST be `JSON.stringify(result, null, 2)` - structured JSON only
- [ ] `content.text` and `structuredContent` must be the same data
- [ ] Success: `{ content: [...], structuredContent: {...} }`
- [ ] Error: `{ content: [...], structuredContent: {...}, isError: true }`
- [ ] Error `structuredContent` must match `outputSchema` (use empty/default values)
- [ ] Error `content.text` must also be `JSON.stringify(errorResult, null, 2)`
- [ ] No plain text messages, no emojis, no icons, no decorative symbols

### 7.3 Response Format
```typescript
// SUCCESS
const result = { field1: "value", field2: 123 };
return {
  content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: result,
};

// ERROR
const errorResult = { field1: "", field2: 0 };
return {
  content: [{ type: "text" as const, text: JSON.stringify(errorResult, null, 2) }],
  structuredContent: errorResult,
  isError: true,
};
```

### 7.4 Connection Rules
- [ ] Always use `connectDB(extra, dbName)` from `@/lib/utils/connection`
- [ ] Database name passed as tool input, not from env
- [ ] URI from header `mongodb_uri` or env `MONGODB_URI`
- [ ] Always close connection after use

---

## **8. DOCKER COMPOSE (Development)**

```yaml
version: "3.8"
services:
    mongodb:
        image: mongo:latest
        container_name: mcp-mongodb
        restart: always
        environment:
            - MONGO_INITDB_ROOT_USERNAME=admin
            - MONGO_INITDB_ROOT_PASSWORD=password123
        ports:
            - "27017:27017"
        volumes:
            - mongo_data:/data/db

    mongo-express:
        image: mongo-express:latest
        container_name: mongo-express
        restart: always
        ports:
            - "8081:8081"
        environment:
            - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
            - ME_CONFIG_MONGODB_ADMINPASSWORD=password123
            - ME_CONFIG_MONGODB_SERVER=mongodb
            - ME_CONFIG_BASICAUTH_USERNAME=webadmin
            - ME_CONFIG_BASICAUTH_PASSWORD=webpassword
        depends_on:
            - mongodb

volumes:
    mongo_data:
```

---

## **9. MCP INSPECTOR CONFIG**

```
Environment Variables:
MONGODB_URI=mongodb://admin:password123@localhost:27017
```

---

## **10. ADDING NEW TOOL CHECKLIST**

1. Create file `lib/mcp/tools/[kebab-name].ts`
2. Copy template from Section 5
3. Define `inputSchema` with `.describe()` on every field
4. Define `outputSchema` matching `structuredContent` exactly
5. Handler: `ToolCallback<ZodRawShapeCompat>` with type assertion for args
6. Use `connectDB(extra, args.database)` 
7. Close client in try AND catch
8. Return `JSON.stringify(result, null, 2)` in both success and error
9. Error `structuredContent` must match `outputSchema`
10. Export with `name`, `config`, `handler`
11. Add to `lib/mcp/tools/index.ts` array

---

## **11. COMPLETED TOOLS**

| # | Tool Name | File | Status |
|---|-----------|------|--------|
| 1 | `db_connect_check` | `db-connect-check.ts` | [x] DONE |
| 2 | `list_databases` | `list-databases.ts` | [x] DONE |

---

## **12. WHAT NOT TO DO**

❌ Don't use plain text in `content.text` - use `JSON.stringify(result, null, 2)`
❌ Don't use emojis, icons, symbols, Unicode decorations
❌ Don't let `structuredContent` differ from `outputSchema`
❌ Don't skip `client.close()` in try AND catch
❌ Don't throw errors in tool handlers (return `isError: true`)
❌ Don't hardcode MongoDB URI
❌ Don't put reusable logic in tools (use `lib/utils/`)
❌ Don't use `any` types
❌ Don't skip `.describe()` on schema fields
❌ Don't use `ToolCallback<typeof inputSchema>` (use `ToolCallback<ZodRawShapeCompat>`)
