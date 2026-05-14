# **MongoDB MCP Server - Complete Tool Specification Rule Book**

---

## **PHASE 1: CONNECTION & DATABASE ADMINISTRATION**

### **1.1 - `db_connect_check`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Read |
| **Description** | Check MongoDB connection status and get server information |
| **Input Schema** | None (uses MONGODB_URI from env/header) |
| **Output Schema** | `connected` (boolean), `message` (string), `database` (string, nullable), `host` (string, nullable), `version` (string, nullable), `collections` (number, nullable) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `CONNECTION_FAILED`, `MISSING_CONFIG` |
| **Status** | [x] DONE |

### **1.2 - `list_databases`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Read |
| **Description** | List all databases with optional size and system database inclusion |
| **Input Schema** | `includeSize` (boolean, optional), `includeSystemDatabases` (boolean, optional) |
| **Output Schema** | `databases` (array of {name, sizeOnDisk, empty}), `totalCount` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Validation** | System databases (admin, config, local) excluded by default |
| **Error Codes** | `CONNECTION_FAILED`, `LIST_DATABASES_FAILED` |
| **Status** | [x] DONE |

### **1.3 - `create_database`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Create a new database with an initial collection |
| **Input Schema** | `database` (string), `collection` (string, optional, default: "_setup") |
| **Output Schema** | `database` (string), `created` (boolean), `message` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Database name: letters, numbers, underscores, hyphens, max 64 chars |
| **Error Codes** | `DATABASE_EXISTS`, `INVALID_DATABASE_NAME`, `CREATE_DATABASE_FAILED` |
| **Status** | [x] DONE |

### **1.4 - `drop_database`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Delete a database with confirmation |
| **Input Schema** | `database` (string), `confirm` (string, must equal database name) |
| **Output Schema** | `database` (string), `dropped` (boolean), `message` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Cannot drop system databases (admin, config, local) |
| **Error Codes** | `DATABASE_NOT_FOUND`, `SYSTEM_DATABASE_PROTECTED`, `CONFIRMATION_FAILED` |
| **Status** | [x] DONE |

### **1.5 - `database_stats`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Read |
| **Description** | Get detailed statistics for a specific database |
| **Input Schema** | `database` (string), `includeCollectionDetails` (boolean, optional) |
| **Output Schema** | `database` (string), `sizeOnDisk` (string), `collections` (number), `documents` (number), `indexes` (number), `storageSize` (string), `collectionDetails` (array, optional) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `DATABASE_STATS_FAILED` |
| **Status** | [x] DONE |

### **1.6 - `list_collections`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Read |
| **Description** | List all collections in a database with statistics |
| **Input Schema** | `database` (string), `includeStats` (boolean, optional), `namePattern` (string, optional) |
| **Output Schema** | `database` (string), `collections` (array of {name, type, documentCount, size, indexCount}), `totalCount` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `LIST_COLLECTIONS_FAILED` |
| **Status** | [x] DONE |

### **1.7 - `create_collection`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Create a new collection with optional validation schema |
| **Input Schema** | `database` (string), `collection` (string), `validator` (object, optional), `capped` (boolean, optional), `maxSize` (number, optional) |
| **Output Schema** | `database` (string), `collection` (string), `created` (boolean), `message` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Collection name: letters, numbers, underscores, max 255 chars, no "system." prefix |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_EXISTS`, `INVALID_COLLECTION_NAME`, `CREATE_COLLECTION_FAILED` |
| **Status** | [x] DONE |

### **1.8 - `drop_collection`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Delete a collection with confirmation |
| **Input Schema** | `database` (string), `collection` (string), `confirm` (string, must equal collection name) |
| **Output Schema** | `database` (string), `collection` (string), `dropped` (boolean), `message` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Cannot drop system collections (system.*) |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `SYSTEM_COLLECTION_PROTECTED`, `CONFIRMATION_FAILED` |
| **Status** | [x] DONE |

### **1.9 - `rename_collection`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Rename an existing collection |
| **Input Schema** | `database` (string), `oldName` (string), `newName` (string) |
| **Output Schema** | `database` (string), `oldName` (string), `newName` (string), `renamed` (boolean), `documentCount` (number) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `COLLECTION_EXISTS`, `RENAME_FAILED` |
| **Status** | [x] DONE |

### **1.10 - `collection_stats`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Read |
| **Description** | Get detailed statistics for a specific collection |
| **Input Schema** | `database` (string), `collection` (string), `includeIndexDetails` (boolean, optional), `includeValidator` (boolean, optional) |
| **Output Schema** | `database` (string), `collection` (string), `documentCount` (number), `size` (string), `avgDocumentSize` (string), `storageSize` (string), `indexCount` (number), `indexSize` (string), `indexDetails` (array, optional), `validator` (object, nullable) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `STATS_FAILED` |
| **Status** | [ ] TODO |

### **1.11 - `manage_indexes`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Create or drop indexes on collection fields |
| **Input Schema** | `database` (string), `collection` (string), `action` (enum: "create", "drop", "list"), `field` (string, optional), `indexType` (enum: "asc", "desc", optional) |
| **Output Schema** | `database` (string), `collection` (string), `indexes` (array of {name, field, type}), `message` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | _id index cannot be dropped |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `INDEX_EXISTS`, `INDEX_NOT_FOUND`, `PROTECTED_INDEX`, `INDEX_OPERATION_FAILED` |
| **Status** | [ ] TODO |

### **1.12 - `add_fields`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Add validation fields to collection schema |
| **Input Schema** | `database` (string), `collection` (string), `fields` (array of {name, type, required, description}) |
| **Output Schema** | `database` (string), `collection` (string), `addedFields` (array of strings), `skippedFields` (array of strings) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Merges with existing validator, never replaces |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `DUPLICATE_FIELDS`, `ADD_FIELDS_FAILED` |
| **Status** | [ ] TODO |

### **1.13 - `remove_fields`**
| Property | Value |
|----------|-------|
| **Category** | Database Administration |
| **Read/Write** | Write |
| **Description** | Remove validation fields from collection schema (does not delete data) |
| **Input Schema** | `database` (string), `collection` (string), `fields` (array of strings), `force` (boolean, optional) |
| **Output Schema** | `database` (string), `collection` (string), `removedFields` (array of strings), `notFoundFields` (array of strings) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | _id field cannot be removed, required fields need force flag |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `PROTECTED_FIELD`, `NO_VALIDATOR_FOUND`, `REMOVE_FIELDS_FAILED` |
| **Status** | [ ] TODO |

---

## **PHASE 2: CRUD OPERATIONS**

### **2.1 - `insert_one`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Insert a single document into a collection |
| **Input Schema** | `database` (string), `collection` (string), `document` (object) |
| **Output Schema** | `insertedId` (string), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `INSERT_FAILED` |
| **Status** | [ ] TODO |

### **2.2 - `insert_many`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Insert multiple documents into a collection |
| **Input Schema** | `database` (string), `collection` (string), `documents` (array of objects) |
| **Output Schema** | `insertedCount` (number), `insertedIds` (array of strings), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Max 1000 documents per batch |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `BATCH_TOO_LARGE`, `INSERT_FAILED` |
| **Status** | [ ] TODO |

### **2.3 - `find_documents`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Read |
| **Description** | Find documents with filter, projection, sort, and pagination |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object, optional), `projection` (object, optional), `sort` (object, optional), `limit` (number, default: 100, max: 1000), `skip` (number, default: 0) |
| **Output Schema** | `documents` (array), `count` (number), `totalCount` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `QUERY_FAILED` |
| **Status** | [ ] TODO |

### **2.4 - `find_one`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Read |
| **Description** | Find a single document by filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object), `projection` (object, optional) |
| **Output Schema** | `document` (object, nullable), `found` (boolean) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `QUERY_FAILED` |
| **Status** | [ ] TODO |

### **2.5 - `update_one`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Update a single document matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object), `update` (object), `upsert` (boolean, optional) |
| **Output Schema** | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `UPDATE_FAILED` |
| **Status** | [ ] TODO |

### **2.6 - `update_many`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Update all documents matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object), `update` (object), `upsert` (boolean, optional), `confirm` (boolean, required if filter is empty) |
| **Output Schema** | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Confirmation required for empty filter (update all) |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `CONFIRMATION_REQUIRED`, `UPDATE_FAILED` |
| **Status** | [ ] TODO |

### **2.7 - `replace_one`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Replace entire document matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object), `document` (object), `upsert` (boolean, optional) |
| **Output Schema** | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `REPLACE_FAILED` |
| **Status** | [ ] TODO |

### **2.8 - `delete_one`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Delete a single document matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object) |
| **Output Schema** | `deletedCount` (number), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `DELETE_FAILED` |
| **Status** | [ ] TODO |

### **2.9 - `delete_many`**
| Property | Value |
|----------|-------|
| **Category** | CRUD |
| **Read/Write** | Write |
| **Description** | Delete all documents matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object), `confirm` (boolean, required if filter is empty) |
| **Output Schema** | `deletedCount` (number), `acknowledged` (boolean) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Confirmation required for empty filter (delete all) |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `CONFIRMATION_REQUIRED`, `DELETE_FAILED` |
| **Status** | [ ] TODO |

---

## **PHASE 3: AGGREGATION & ADVANCED QUERIES**

### **3.1 - `aggregate`**
| Property | Value |
|----------|-------|
| **Category** | Query |
| **Read/Write** | Read |
| **Description** | Execute MongoDB aggregation pipeline |
| **Input Schema** | `database` (string), `collection` (string), `pipeline` (array of objects), `allowDiskUse` (boolean, optional), `limit` (number, default: 100, max: 1000) |
| **Output Schema** | `results` (array), `count` (number), `executionTimeMs` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `AGGREGATION_FAILED` |
| **Status** | [ ] TODO |

### **3.2 - `count_documents`**
| Property | Value |
|----------|-------|
| **Category** | Query |
| **Read/Write** | Read |
| **Description** | Count documents matching filter |
| **Input Schema** | `database` (string), `collection` (string), `filter` (object, optional) |
| **Output Schema** | `count` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND` |
| **Status** | [ ] TODO |

### **3.3 - `distinct_values`**
| Property | Value |
|----------|-------|
| **Category** | Query |
| **Read/Write** | Read |
| **Description** | Get distinct values for a field |
| **Input Schema** | `database` (string), `collection` (string), `field` (string), `filter` (object, optional) |
| **Output Schema** | `field` (string), `values` (array), `count` (number) |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND` |
| **Status** | [ ] TODO |

---

## **PHASE 4: BULK OPERATIONS**

### **4.1 - `bulk_write`**
| Property | Value |
|----------|-------|
| **Category** | Bulk |
| **Read/Write** | Write |
| **Description** | Execute bulk write operations (insert, update, delete) |
| **Input Schema** | `database` (string), `collection` (string), `operations` (array of {type, filter/document/update}), `ordered` (boolean, default: true) |
| **Output Schema** | `insertedCount` (number), `modifiedCount` (number), `deletedCount` (number), `upsertedCount` (number), `errors` (array) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: false` |
| **Validation** | Max 1000 operations per batch |
| **Error Codes** | `DATABASE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `BULK_WRITE_FAILED` |
| **Status** | [ ] TODO |

---

## **PHASE 5: TRANSACTIONS (Requires Replica Set)**

### **5.1 - `start_transaction`**
| Property | Value |
|----------|-------|
| **Category** | Transaction |
| **Read/Write** | Write |
| **Description** | Start a new transaction session |
| **Input Schema** | None |
| **Output Schema** | `sessionId` (string), `status` (string), `startedAt` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Status** | [ ] TODO |

### **5.2 - `commit_transaction`**
| Property | Value |
|----------|-------|
| **Category** | Transaction |
| **Read/Write** | Write |
| **Description** | Commit an active transaction |
| **Input Schema** | `sessionId` (string) |
| **Output Schema** | `sessionId` (string), `status` (string), `committedAt` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Status** | [ ] TODO |

### **5.3 - `abort_transaction`**
| Property | Value |
|----------|-------|
| **Category** | Transaction |
| **Read/Write** | Write |
| **Description** | Abort/rollback an active transaction |
| **Input Schema** | `sessionId` (string) |
| **Output Schema** | `sessionId` (string), `status` (string), `abortedAt` (string) |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Status** | [ ] TODO |

---

## **SUMMARY**

| Phase | Category | Total Tools | Completed | Remaining |
|-------|----------|-------------|-----------|-----------|
| 1 | Database Administration | 13 | 0 | 13 |
| 2 | CRUD Operations | 9 | 0 | 9 |
| 3 | Aggregation & Queries | 3 | 0 | 3 |
| 4 | Bulk Operations | 1 | 0 | 1 |
| 5 | Transactions | 3 | 0 | 3 |
| **TOTAL** | | **29** | **0** | **29** |

---

## **ERROR CODES REFERENCE**

| Error Code | Description |
|------------|-------------|
| `MISSING_CONFIG` | MONGODB_URI not set in environment |
| `CONNECTION_FAILED` | Could not connect to MongoDB |
| `DATABASE_NOT_FOUND` | Specified database does not exist |
| `DATABASE_EXISTS` | Database already exists |
| `COLLECTION_NOT_FOUND` | Specified collection does not exist |
| `COLLECTION_EXISTS` | Collection already exists |
| `INVALID_DATABASE_NAME` | Database name validation failed |
| `INVALID_COLLECTION_NAME` | Collection name validation failed |
| `SYSTEM_DATABASE_PROTECTED` | Cannot modify system database |
| `SYSTEM_COLLECTION_PROTECTED` | Cannot modify system collection |
| `CONFIRMATION_FAILED` | Confirmation string does not match |
| `CONFIRMATION_REQUIRED` | Confirmation needed for destructive operation |
| `PROTECTED_FIELD` | Cannot modify _id field |
| `PROTECTED_INDEX` | Cannot drop _id index |
| `INDEX_EXISTS` | Index already exists |
| `INDEX_NOT_FOUND` | Specified index not found |
| `NO_VALIDATOR_FOUND` | Collection has no validator |
| `DUPLICATE_FIELDS` | Fields already exist in validator |
| `BATCH_TOO_LARGE` | Exceeded maximum batch size |
| `INSERT_FAILED` | Document insertion failed |
| `QUERY_FAILED` | Query execution failed |
| `UPDATE_FAILED` | Update operation failed |
| `REPLACE_FAILED` | Replace operation failed |
| `DELETE_FAILED` | Delete operation failed |
| `AGGREGATION_FAILED` | Aggregation pipeline failed |
| `BULK_WRITE_FAILED` | Bulk write operation failed |
| `INDEX_OPERATION_FAILED` | Index operation failed |
| `RENAME_FAILED` | Collection rename failed |
| `STATS_FAILED` | Failed to get statistics |