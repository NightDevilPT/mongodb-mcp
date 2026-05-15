# **MongoDB MCP Server - Complete Tool Specification Rule Book**

---

## **PHASE 1: DATABASE ADMINISTRATION**

### **1.1 - `db_connect_check`**

| Property        | Value                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                                                                                                                        |
| **Read/Write**  | Read                                                                                                                                                                                                                                                                                           |
| **Description** | Check MongoDB connection status and get server information including version, database name, host, and collection list                                                                                                                                                                         |
| **Input**       | None (uses MONGODB_URI from env/header)                                                                                                                                                                                                                                                        |
| **Output**      | `connected` (boolean) - Connection status, `message` (string) - Status message, `host` (string) - Server host, `version` (string) - MongoDB version, `database` (string) - Current database, `collections` (number) - Collection count, `collectionList` (array of strings) - Collection names |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                                                                                         |
| **Error Codes** | CONNECTION_FAILED, MISSING_CONFIG                                                                                                                                                                                                                                                              |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                       |

### **1.2 - `list_databases`**

| Property        | Value                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**    | Database Administration                                                                                                                                |
| **Read/Write**  | Read                                                                                                                                                   |
| **Description** | List all databases with optional size information and system database inclusion                                                                        |
| **Input**       | `includeSize` (boolean, optional) - Include database size on disk, `includeSystemDatabases` (boolean, optional) - Include admin/config/local databases |
| **Output**      | `databases` (array of {name, sizeOnDisk, empty}) - Database list, `totalCount` (number) - Total databases found                                        |
| **Validation**  | System databases (admin, config, local) excluded by default                                                                                            |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                 |
| **Error Codes** | CONNECTION_FAILED, LIST_DATABASES_FAILED                                                                                                               |
| **Status**      | [x] DONE                                                                                                                                               |

### **1.3 - `create_database`**

| Property        | Value                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                   |
| **Read/Write**  | Write                                                                                                                                                                     |
| **Description** | Create a new database by inserting a document into an initial collection to materialize it                                                                                |
| **Input**       | `database` (string) - Database name (letters, numbers, underscores, hyphens, max 64 chars), `collection` (string, optional, default: "\_setup") - Initial collection name |
| **Output**      | `database` (string) - Created database name, `created` (boolean) - Success status, `message` (string) - Result message                                                    |
| **Validation**  | Database name: only letters/numbers/underscores/hyphens, max 64 chars, cannot be admin/config/local                                                                       |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                  |
| **Error Codes** | DATABASE_EXISTS, INVALID_DATABASE_NAME, CREATE_DATABASE_FAILED                                                                                                            |
| **Status**      | [x] DONE                                                                                                                                                                  |

### **1.4 - `drop_database`**

| Property        | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                        |
| **Read/Write**  | Write                                                                                                          |
| **Description** | Permanently delete a database with confirmation toggle for safety                                              |
| **Input**       | `database` (string) - Database name to drop, `confirm` (boolean) - Must be true to proceed                     |
| **Output**      | `database` (string) - Database name, `dropped` (boolean) - Success status, `message` (string) - Result message |
| **Validation**  | Cannot drop system databases (admin, config, local), confirm must be true                                      |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                        |
| **Error Codes** | DATABASE_NOT_FOUND, SYSTEM_DATABASE_PROTECTED, CONFIRMATION_FAILED                                             |
| **Status**      | [x] DONE                                                                                                       |

### **1.5 - `database_stats`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Read/Write**  | Read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Description** | Get comprehensive statistics for a database including size, document count, indexes, and optional per-collection breakdown                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Input**       | `database` (string) - Database name, `includeCollectionDetails` (boolean, optional) - Include per-collection statistics                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Output**      | `database` (string) - Database name, `sizeOnDisk` (string) - Total size, `collections` (number) - Collection count, `documents` (number) - Total documents, `indexes` (number) - Total indexes, `storageSize` (string) - Storage allocated, `dataSize` (string) - Actual data size, `indexSize` (string) - Index size, `avgObjSize` (string) - Average document size, `fsTotalSize` (string) - Filesystem total, `fsUsedSize` (string) - Filesystem used, `views` (number) - View count, `collectionDetails` (array) - Optional per-collection stats |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Error Codes** | DATABASE_NOT_FOUND, DATABASE_STATS_FAILED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### **1.6 - `list_collections`**

| Property        | Value                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                                       |
| **Read/Write**  | Read                                                                                                                                                                                                          |
| **Description** | List all collections in a database with optional statistics and name pattern filtering                                                                                                                        |
| **Input**       | `database` (string) - Database name, `includeStats` (boolean, optional) - Include document count/size/index count, `namePattern` (string, optional) - Filter by name substring                                |
| **Output**      | `database` (string) - Database name, `collections` (array of {name, type, documentCount, size, indexCount}) - Collection list, `totalCount` (number) - Total collections, `message` (string) - Result message |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                        |
| **Error Codes** | DATABASE_NOT_FOUND, LIST_COLLECTIONS_FAILED                                                                                                                                                                   |
| **Status**      | [x] DONE                                                                                                                                                                                                      |

### **1.7 - `create_collection`**

| Property        | Value                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                 |
| **Read/Write**  | Write                                                                                                                                                   |
| **Description** | Create a new empty collection. Use field tools separately to add validation schema.                                                                     |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name (letters, numbers, underscores, max 255 chars, no "system." prefix)        |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `created` (boolean) - Success status, `message` (string) - Result message |
| **Validation**  | Collection name: letters/numbers/underscores only, max 255 chars, no "system." prefix                                                                   |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_EXISTS, INVALID_COLLECTION_NAME, CREATE_COLLECTION_FAILED                                                                |
| **Status**      | [x] DONE                                                                                                                                                |

### **1.8 - `drop_collection`**

| Property        | Value                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                 |
| **Read/Write**  | Write                                                                                                                                                   |
| **Description** | Permanently delete a collection with confirmation toggle for safety                                                                                     |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name to drop, `confirm` (boolean) - Must be true to proceed                     |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `dropped` (boolean) - Success status, `message` (string) - Result message |
| **Validation**  | Cannot drop system collections (system.\*), confirm must be true                                                                                        |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                                                                 |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, SYSTEM_COLLECTION_PROTECTED, CONFIRMATION_FAILED                                                              |
| **Status**      | [x] DONE                                                                                                                                                |

### **1.9 - `rename_collection`**

| Property        | Value                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                     |
| **Read/Write**  | Write                                                                                                                                                                                       |
| **Description** | Rename an existing collection to a new name                                                                                                                                                 |
| **Input**       | `database` (string) - Database name, `oldName` (string) - Current collection name, `newName` (string) - New collection name                                                                 |
| **Output**      | `database` (string) - Database name, `oldName` (string) - Old name, `newName` (string) - New name, `renamed` (boolean) - Success status, `documentCount` (number) - Documents in collection |
| **Validation**  | New name must follow collection naming rules, cannot rename system collections                                                                                                              |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                    |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, COLLECTION_EXISTS, RENAME_FAILED                                                                                                                  |
| **Status**      | [x] DONE                                                                                                                                                                                    |

### **1.10 - `collection_stats`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                                                                                                                                                                                           |
| **Read/Write**  | Read                                                                                                                                                                                                                                                                                                                                                              |
| **Description** | Get comprehensive collection statistics including document count, sizes, all indexes with details, and fields from the validator schema                                                                                                                                                                                                                           |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name                                                                                                                                                                                                                                                                                      |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `message` (string) - Result message, `stats` ({documentCount, totalSize, avgDocumentSize, storageSize, totalIndexSize}) - Collection stats, `indexes` (array of {name, key, unique, sparse, ttl}) - All indexes, `fields` (array of {name, type, required}) - Fields from validator |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                                                                                                                                                            |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, STATS_FAILED                                                                                                                                                                                                                                                                                                            |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                          |

### **1.11 - `list_indexes`**

| Property        | Value                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                                                      |
| **Read/Write**  | Read                                                                                                                                                                                                                         |
| **Description** | List all indexes on a collection with details (name, key fields, unique, sparse, TTL)                                                                                                                                        |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name                                                                                                                                                 |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `indexes` (array of {name, key, unique, sparse, ttl}) - Index list, `totalCount` (number) - Total indexes, `message` (string) - Result message |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                       |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND                                                                                                                                                                                     |
| **Status**      | [x] DONE                                                                                                                                                                                                                     |

### **1.12 - `add_index`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**    | Database Administration                                                                                                                                                                                                                                                                                                                                |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                                                                  |
| **Description** | Create an index on a field. Skips silently if index already exists. Supports unique, text search, sparse, and TTL options.                                                                                                                                                                                                                             |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name, `field` (string) - Field to index, `unique` (boolean, optional) - No duplicate values, `textSearch` (boolean, optional) - Full-text search index, `sparse` (boolean, optional) - Only index docs with field, `ttlSeconds` (number, optional) - Auto-delete after seconds |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `field` (string) - Indexed field, `added` (boolean) - Success status, `message` (string) - Result message                                                                                                                                                                |
| **Validation**  | Cannot create index on \_id field, skips if index already exists                                                                                                                                                                                                                                                                                       |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                                                                                                                                                |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, INDEX_EXISTS, PROTECTED_INDEX, INDEX_OPERATION_FAILED                                                                                                                                                                                                                                                        |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                               |

### **1.13 - `drop_index`**

| Property        | Value                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Database Administration                                                                                                                                                                |
| **Read/Write**  | Write                                                                                                                                                                                  |
| **Description** | Remove an index from a field. Finds the index by field name and drops it.                                                                                                              |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name, `field` (string) - Field whose index to remove                                                           |
| **Output**      | `database` (string) - Database name, `collection` (string) - Collection name, `field` (string) - Field name, `dropped` (boolean) - Success status, `message` (string) - Result message |
| **Validation**  | Cannot drop \_id index                                                                                                                                                                 |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                                                                                                |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, INDEX_NOT_FOUND, PROTECTED_INDEX, INDEX_OPERATION_FAILED                                                                                     |
| **Status**      | [x] DONE                                                                                                                                                                               |

---

## **PHASE 2: SCHEMA & FIELD MANAGEMENT**

### **2.1 - `add_string_field`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Description** | Add a string/email/url/phone/zipCode field with validation (min/max length, regex pattern), required flag, unique index, and default value. Auto-applies regex for email/url/phone/zipCode types.                                                                                                                                                                                                                                                                                                                                  |
| **Input**       | `database` (string) - Database name, `collection` (string) - Collection name, `name` (string) - Field name, `type` (enum: string/email/url/phone/zipCode) - String type, `required` (boolean, optional) - Field is required, `unique` (boolean, optional) - Create unique index, `minLength` (number, optional) - Min characters, `maxLength` (number, optional) - Max characters, `pattern` (string, optional) - Custom regex, `default` (string, optional) - Default value, `description` (string, optional) - Field description |
| **Output**      | `database` (string), `collection` (string), `field` (string) - Field name, `added` (boolean) - Success status, `message` (string) - Result message                                                                                                                                                                                                                                                                                                                                                                                 |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DUPLICATE_FIELD, INVALID_FIELD_NAME, ADD_FIELD_FAILED                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### **2.2 - `add_number_field`**

| Property        | Value                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                                                                                                                                                 |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                             |
| **Description** | Add a number field with min/max validation, required flag, unique index, and default value                                                                                                                                                                                                                        |
| **Input**       | `database` (string), `collection` (string), `name` (string) - Field name (e.g., 'age', 'price'), `required` (boolean, optional), `unique` (boolean, optional), `min` (number, optional) - Minimum value, `max` (number, optional) - Maximum value, `default` (number, optional), `description` (string, optional) |
| **Output**      | `database` (string), `collection` (string), `field` (string), `added` (boolean), `message` (string)                                                                                                                                                                                                               |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                                                                                                                                          |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DUPLICATE_FIELD, INVALID_FIELD_NAME, ADD_FIELD_FAILED                                                                                                                                                                                                                   |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                          |

### **2.3 - `add_boolean_field`**

| Property        | Value                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                            |
| **Read/Write**  | Write                                                                                                                                                                                        |
| **Description** | Add a boolean field with required flag and default value                                                                                                                                     |
| **Input**       | `database` (string), `collection` (string), `name` (string) - Field name (e.g., 'isActive'), `required` (boolean, optional), `default` (boolean, optional), `description` (string, optional) |
| **Output**      | `database` (string), `collection` (string), `field` (string), `added` (boolean), `message` (string)                                                                                          |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                     |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DUPLICATE_FIELD, INVALID_FIELD_NAME, ADD_FIELD_FAILED                                                                                              |
| **Status**      | [x] DONE                                                                                                                                                                                     |

### **2.4 - `add_date_field`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Description** | Add a date field with min/max date validation, unique index, auto-set/auto-update behavior, TTL index, and indexes                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Input**       | `database` (string), `collection` (string), `name` (string) - Field name (e.g., 'createdAt', 'expiresAt'), `required` (boolean, optional), `autoSet` (boolean, optional) - Set on insert once, `autoUpdate` (boolean, optional) - Update on every change, `unique` (boolean, optional), `index` (boolean, optional), `descendingIndex` (boolean, optional), `minDate` (string, optional) - YYYY-MM-DD, `maxDate` (string, optional) - YYYY-MM-DD, `expireAfterSeconds` (number, optional) - TTL auto-delete, `description` (string, optional) |
| **Output**      | `database` (string), `collection` (string), `field` (string), `added` (boolean), `message` (string)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DUPLICATE_FIELD, INVALID_FIELD_NAME, ADD_FIELD_FAILED                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### **2.5 - `add_array_field`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Description** | Add an array field with item type (string/number/boolean/object/array), min/max items, unique items, and object property definitions for arrays of objects                                                                                                                                                                                                                                                                                                             |
| **Input**       | `database` (string), `collection` (string), `name` (string) - Field name, `itemType` (enum: string/number/boolean/object/array) - Type of items, `required` (boolean, optional), `minItems` (number, optional), `maxItems` (number, optional), `uniqueItems` (boolean, optional), `objectFields` (object, optional) - {fieldName:fieldType} for object arrays, `objectRequired` (string, optional) - Comma-separated required fields, `description` (string, optional) |
| **Output**      | `database` (string), `collection` (string), `field` (string), `added` (boolean), `message` (string)                                                                                                                                                                                                                                                                                                                                                                    |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                                                                                                                                                                                                                                                                                               |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DUPLICATE_FIELD, INVALID_FIELD_NAME, ADD_FIELD_FAILED                                                                                                                                                                                                                                                                                                                                                                        |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### **2.6 - `add_objectId_field`**

| Property        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Read/Write**  | Write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Description** | Add an ObjectId reference field with bidirectional relationship tracking. Verifies referenced collection exists, creates index, and stores relationship in \_schema on BOTH collections for auto-join queries.                                                                                                                                                                                                                                                                                                        |
| **Input**       | `database` (string), `collection` (string) - Collection holding the reference (child), `fieldName` (string) - Field name (e.g., 'userId'), `referencesCollection` (string) - Referenced collection (parent), `referencesField` (string, optional, default: '\_id') - Field in referenced collection, `relationshipType` (enum: one-to-one/one-to-many), `isRequired` (boolean, optional), `createIndex` (boolean, optional, default: true), `createSparseIndex` (boolean, optional), `description` (string, optional) |
| **Output**      | `database` (string), `collection` (string), `field` (string), `added` (boolean), `message` (string)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, REFERENCE_NOT_FOUND, DUPLICATE_FIELD, INVALID_REFERENCE, ADD_FIELD_FAILED                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### **2.7 - `remove_fields`**

| Property        | Value                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Schema Management                                                                                                                                           |
| **Read/Write**  | Write                                                                                                                                                       |
| **Description** | Remove validation fields from collection schema without deleting data. Cleans up indexes and \_schema relationships on both sides.                          |
| **Input**       | `database` (string), `collection` (string), `fields` (array of strings) - Field names to remove, `force` (boolean, optional) - Force remove required fields |
| **Output**      | `database` (string), `collection` (string), `removedFields` (array of strings), `notFoundFields` (array of strings)                                         |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                    |
| **Validation**  | \_id field cannot be removed, required fields need force flag                                                                                               |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, PROTECTED_FIELD, NO_VALIDATOR_FOUND, REMOVE_FIELDS_FAILED                                                         |
| **Status**      | [ ] TODO                                                                                                                                                    |

---

## **PHASE 3: CRUD OPERATIONS**

### **3.1 - `insert_one`**

| Property        | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                     |
| **Read/Write**  | Write                                                                                    |
| **Description** | Insert a single document into a collection. Auto-sets date fields marked with autoSet.   |
| **Input**       | `database` (string), `collection` (string), `document` (object) - Document to insert     |
| **Output**      | `insertedId` (string) - ID of inserted document, `acknowledged` (boolean) - Confirmation |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, INSERT_FAILED                                  |
| **Status**      | [x] DONE                                                                                 |

### **3.2 - `insert_many`**

| Property        | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Category**    | CRUD                                                                                             |
| **Read/Write**  | Write                                                                                            |
| **Description** | Insert multiple documents into a collection. Max 1000 per batch. Auto-sets autoSet date fields.  |
| **Input**       | `database` (string), `collection` (string), `documents` (array of objects) - Documents to insert |
| **Output**      | `insertedCount` (number), `insertedIds` (array of strings), `acknowledged` (boolean)             |
| **Validation**  | Max 1000 documents per batch                                                                     |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false         |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, BATCH_TOO_LARGE, INSERT_FAILED                         |
| **Status**      | [ ] TODO                                                                                         |

### **3.3 - `find_documents`**

| Property        | Value                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                                                                                                                                                                                                    |
| **Read/Write**  | Read                                                                                                                                                                                                                                                                    |
| **Description** | Find documents with filter, projection, sort, pagination. Can auto-join based on \_schema relationships.                                                                                                                                                                |
| **Input**       | `database` (string), `collection` (string), `filter` (object, optional), `projection` (object, optional), `sort` (object, optional), `limit` (number, default: 100, max: 1000), `skip` (number, default: 0), `autoJoin` (boolean, optional) - Auto-include related data |
| **Output**      | `documents` (array), `count` (number), `totalCount` (number)                                                                                                                                                                                                            |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                                                                                                                  |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, QUERY_FAILED                                                                                                                                                                                                                  |
| **Status**      | [x] DONE                                                                                                                                                                                                                                                                |

### **3.4 - `find_one`**

| Property        | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Category**    | CRUD                                                                                                                           |
| **Read/Write**  | Read                                                                                                                           |
| **Description** | Find a single document by filter. Can auto-join related data from \_schema.                                                    |
| **Input**       | `database` (string), `collection` (string), `filter` (object), `projection` (object, optional), `autoJoin` (boolean, optional) |
| **Output**      | `document` (object, nullable), `found` (boolean)                                                                               |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                         |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, QUERY_FAILED                                                                         |
| **Status**      | [x] DONE                                                                                                                       |

### **3.5 - `update_one`**

| Property        | Value                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                                                              |
| **Read/Write**  | Write                                                                                                                             |
| **Description** | Update a single document. Auto-updates date fields marked with autoUpdate.                                                        |
| **Input**       | `database` (string), `collection` (string), `filter` (object), `update` (object) - Update operators, `upsert` (boolean, optional) |
| **Output**      | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean)                      |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                          |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, UPDATE_FAILED                                                                           |
| **Status**      | [x] DONE                                                                                                                          |

### **3.6 - `update_many`**

| Property        | Value                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                                                                                             |
| **Read/Write**  | Write                                                                                                                                                            |
| **Description** | Update all documents matching filter. Requires confirmation for empty filter. Auto-updates autoUpdate date fields.                                               |
| **Input**       | `database` (string), `collection` (string), `filter` (object), `update` (object), `upsert` (boolean, optional), `confirm` (boolean, required if filter is empty) |
| **Output**      | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean)                                                     |
| **Validation**  | Confirmation required for empty filter (update all)                                                                                                              |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                                                         |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, CONFIRMATION_REQUIRED, UPDATE_FAILED                                                                                   |
| **Status**      | [x] DONE                                                                                                                                                         |

### **3.7 - `replace_one`**

| Property        | Value                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                                                            |
| **Read/Write**  | Write                                                                                                                           |
| **Description** | Replace an entire document matching filter                                                                                      |
| **Input**       | `database` (string), `collection` (string), `filter` (object), `document` (object) - New document, `upsert` (boolean, optional) |
| **Output**      | `matchedCount` (number), `modifiedCount` (number), `upsertedId` (string, nullable), `acknowledged` (boolean)                    |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                                         |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, REPLACE_FAILED                                                                        |
| **Status**      | [ ] TODO                                                                                                                        |

### **3.8 - `delete_one`**

| Property        | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                    |
| **Read/Write**  | Write                                                                                   |
| **Description** | Delete a single document matching filter                                                |
| **Input**       | `database` (string), `collection` (string), `filter` (object)                           |
| **Output**      | `deletedCount` (number), `acknowledged` (boolean)                                       |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, DELETE_FAILED                                 |
| **Status**      | [x] DONE                                                                                |

### **3.9 - `delete_many`**

| Property        | Value                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Category**    | CRUD                                                                                                            |
| **Read/Write**  | Write                                                                                                           |
| **Description** | Delete all documents matching filter. Requires confirmation for empty filter.                                   |
| **Input**       | `database` (string), `collection` (string), `filter` (object), `confirm` (boolean, required if filter is empty) |
| **Output**      | `deletedCount` (number), `acknowledged` (boolean)                                                               |
| **Validation**  | Confirmation required for empty filter (delete all)                                                             |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                         |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, CONFIRMATION_REQUIRED, DELETE_FAILED                                  |
| **Status**      | [x] DONE                                                                                                        |

---

## **PHASE 4: AGGREGATION & ADVANCED QUERIES**

### **4.1 - `aggregate`**

| Property        | Value                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Query                                                                                                                                                                         |
| **Read/Write**  | Read                                                                                                                                                                          |
| **Description** | Execute MongoDB aggregation pipeline for complex queries, transformations, and joins                                                                                          |
| **Input**       | `database` (string), `collection` (string), `pipeline` (array of objects) - Aggregation stages, `allowDiskUse` (boolean, optional), `limit` (number, default: 100, max: 1000) |
| **Output**      | `results` (array) - Aggregation results, `count` (number) - Result count, `executionTimeMs` (number) - Execution time                                                         |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                                                                        |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, AGGREGATION_FAILED                                                                                                                  |
| **Status**      | [ ] TODO                                                                                                                                                                      |

### **4.2 - `count_documents`**

| Property        | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| **Category**    | Query                                                                                  |
| **Read/Write**  | Read                                                                                   |
| **Description** | Count documents matching a filter                                                      |
| **Input**       | `database` (string), `collection` (string), `filter` (object, optional)                |
| **Output**      | `count` (number) - Document count                                                      |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND                                               |
| **Status**      | [ ] TODO                                                                               |

### **4.3 - `distinct_values`**

| Property        | Value                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Query                                                                                                                         |
| **Read/Write**  | Read                                                                                                                          |
| **Description** | Get distinct values for a specific field, optionally filtered                                                                 |
| **Input**       | `database` (string), `collection` (string), `field` (string) - Field to get distinct values from, `filter` (object, optional) |
| **Output**      | `field` (string), `values` (array) - Distinct values, `count` (number) - Value count                                          |
| **Annotations** | readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false                                        |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND                                                                                      |
| **Status**      | [ ] TODO                                                                                                                      |

---

## **PHASE 5: BULK OPERATIONS**

### **5.1 - `bulk_write`**

| Property        | Value                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**    | Bulk                                                                                                                                                                                 |
| **Read/Write**  | Write                                                                                                                                                                                |
| **Description** | Execute multiple insert/update/delete operations in a single batch for performance                                                                                                   |
| **Input**       | `database` (string), `collection` (string), `operations` (array of {type, filter/document/update}) - Operations to execute, `ordered` (boolean, default: true) - Stop on first error |
| **Output**      | `insertedCount` (number), `modifiedCount` (number), `deletedCount` (number), `upsertedCount` (number), `errors` (array) - Error details                                              |
| **Validation**  | Max 1000 operations per batch                                                                                                                                                        |
| **Annotations** | readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false                                                                                              |
| **Error Codes** | DATABASE_NOT_FOUND, COLLECTION_NOT_FOUND, BULK_WRITE_FAILED                                                                                                                          |
| **Status**      | [ ] TODO                                                                                                                                                                             |

---

## **PHASE 6: TRANSACTIONS (Requires Replica Set)**

### **6.1 - `start_transaction`**

| Property        | Value                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Category**    | Transaction                                                                                                               |
| **Read/Write**  | Write                                                                                                                     |
| **Description** | Start a new transaction session for atomic multi-document operations                                                      |
| **Input**       | None                                                                                                                      |
| **Output**      | `sessionId` (string) - Transaction session ID, `status` (string) - Session status, `startedAt` (string) - Start timestamp |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false                                  |
| **Status**      | [ ] TODO                                                                                                                  |

### **6.2 - `commit_transaction`**

| Property        | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Category**    | Transaction                                                                              |
| **Read/Write**  | Write                                                                                    |
| **Description** | Commit an active transaction, making all changes permanent                               |
| **Input**       | `sessionId` (string) - Transaction session ID                                            |
| **Output**      | `sessionId` (string), `status` (string), `committedAt` (string) - Commit timestamp       |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false |
| **Status**      | [ ] TODO                                                                                 |

### **6.3 - `abort_transaction`**

| Property        | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Category**    | Transaction                                                                              |
| **Read/Write**  | Write                                                                                    |
| **Description** | Abort/rollback an active transaction, discarding all changes                             |
| **Input**       | `sessionId` (string) - Transaction session ID                                            |
| **Output**      | `sessionId` (string), `status` (string), `abortedAt` (string) - Abort timestamp          |
| **Annotations** | readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false |
| **Status**      | [ ] TODO                                                                                 |

---

## **ERROR CODES REFERENCE**

| Error Code                    | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `MISSING_CONFIG`              | MONGODB_URI not set in environment            |
| `CONNECTION_FAILED`           | Could not connect to MongoDB                  |
| `DATABASE_NOT_FOUND`          | Specified database does not exist             |
| `DATABASE_EXISTS`             | Database already exists                       |
| `COLLECTION_NOT_FOUND`        | Specified collection does not exist           |
| `COLLECTION_EXISTS`           | Collection already exists                     |
| `INVALID_DATABASE_NAME`       | Database name validation failed               |
| `INVALID_COLLECTION_NAME`     | Collection name validation failed             |
| `SYSTEM_DATABASE_PROTECTED`   | Cannot modify system database                 |
| `SYSTEM_COLLECTION_PROTECTED` | Cannot modify system collection               |
| `CONFIRMATION_FAILED`         | Confirmation toggle not checked               |
| `CONFIRMATION_REQUIRED`       | Confirmation needed for destructive operation |
| `PROTECTED_FIELD`             | Cannot modify \_id field                      |
| `PROTECTED_INDEX`             | Cannot drop \_id index                        |
| `INDEX_EXISTS`                | Index already exists                          |
| `INDEX_NOT_FOUND`             | Specified index not found                     |
| `NO_VALIDATOR_FOUND`          | Collection has no validator                   |
| `DUPLICATE_FIELD`             | Field already exists in validator             |
| `REFERENCE_NOT_FOUND`         | Referenced collection does not exist          |
| `INVALID_REFERENCE`           | Invalid reference configuration               |
| `INVALID_FIELD_NAME`          | Field name validation failed                  |
| `BATCH_TOO_LARGE`             | Exceeded maximum batch size                   |
| `INSERT_FAILED`               | Document insertion failed                     |
| `QUERY_FAILED`                | Query execution failed                        |
| `UPDATE_FAILED`               | Update operation failed                       |
| `REPLACE_FAILED`              | Replace operation failed                      |
| `DELETE_FAILED`               | Delete operation failed                       |
| `AGGREGATION_FAILED`          | Aggregation pipeline failed                   |
| `BULK_WRITE_FAILED`           | Bulk write operation failed                   |
| `INDEX_OPERATION_FAILED`      | Index operation failed                        |
| `RENAME_FAILED`               | Collection rename failed                      |
| `STATS_FAILED`                | Failed to get statistics                      |
| `ADD_FIELD_FAILED`            | Failed to add field                           |
| `REMOVE_FIELDS_FAILED`        | Failed to remove fields                       |

---

## **SUMMARY**

| Phase     | Category                  | Total Tools | Completed | Remaining |
| --------- | ------------------------- | ----------- | --------- | --------- |
| 1         | Database Administration   | 13          | 13        | 0         |
| 2         | Schema & Field Management | 7           | 6         | 1         |
| 3         | CRUD Operations           | 9           | 0         | 9         |
| 4         | Aggregation & Queries     | 3           | 0         | 3         |
| 5         | Bulk Operations           | 1           | 0         | 1         |
| 6         | Transactions              | 3           | 0         | 3         |
| **TOTAL** |                           | **36**      | **19**    | **17**    |
