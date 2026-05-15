// lib/mcp/tools/index.ts
// [ Database Administration ]
import { listDatabasesTool } from "./db-administration/list-databases";
import { listCollectionsTool } from "./db-administration/list-collections";
import { dropDatabaseTool } from "./db-administration/drop-database";
import { dropCollectionTool } from "./db-administration/drop-collection";
import { databaseStatsTool } from "./db-administration/database-stats";
import { collectionStatsTool } from "./db-administration/collection-stats";
import { createDatabaseTool } from "./db-administration/create-database";
import { createCollectionTool } from "./db-administration/create-collection";
import { dbConnectCheckTool } from "./db-administration/db-connect-check";
import { renameCollectionTool } from "./db-administration/rename-collection";

// [ Fields Tool ]
import { addDateFieldTool } from "./fields-tool/add-date-field";
import { addArrayFieldTool } from "./fields-tool/add-array-field";
import { addStringFieldTool } from "./fields-tool/add-string-field";
import { addBooleanFieldTool } from "./fields-tool/add-boolean-field";
import { addNumberFieldTool } from "./fields-tool/add-number-field";
import { addObjectIdFieldTool } from "./fields-tool/add-objectid-field";

// [ CRUD Operations ]
import { findOneTool } from "./crud/find-one";
import { aggregateTool } from "./crud/aggregate";
import { insertOneTool } from "./crud/insert-one";
import { deleteOneTool } from "./crud/delete-one";
import { updateOneTool } from "./crud/update-one";
import { insertManyTool } from "./crud/insert-many";
import { deleteManyTool } from "./crud/delete-many";
import { updateManyTool } from "./crud/update-many";
import { findDocumentsTool } from "./crud/find-documents";
import { listFieldsTool } from "./db-administration/list-fields";
import { addIndexTool } from "./db-administration/add-index";
import { dropIndexTool } from "./db-administration/drop-index";
import { listIndexesTool } from "./db-administration/list-indexes";

// [ Type Definitions ]
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

export const tools: ToolDefinition[] = [
	// Database Administration
	dbConnectCheckTool,
	listDatabasesTool,
	createDatabaseTool,
	dropDatabaseTool,
	databaseStatsTool,
	listCollectionsTool,
	createCollectionTool,
	dropCollectionTool,
	renameCollectionTool,
	collectionStatsTool,
	listFieldsTool,
	// Schema
	addStringFieldTool,
	addNumberFieldTool,
	addBooleanFieldTool,
	addArrayFieldTool,
	addDateFieldTool,
	addObjectIdFieldTool,
	// Index Management
	addIndexTool,
	listIndexesTool,
	dropIndexTool,
	// CRUD Operations
	findOneTool,
	findDocumentsTool,
	insertOneTool,
	insertManyTool,
	updateOneTool,
	updateManyTool,
	deleteOneTool,
	deleteManyTool,
	aggregateTool,
];
