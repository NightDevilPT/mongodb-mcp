# **MongoDB MCP Server - Complete Tool Specification**

---

## **PHASE 1: DATABASE ADMINISTRATION**

Tools for managing MongoDB databases, collections, and retrieving statistics.

---

### **1.1 - `db_connect_check`**

Check MongoDB connection status and get server information including version, database name, host, and collection list.

| Property       | Value                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                                                                                                                                                                                                               |
| **Read/Write** | Read                                                                                                                                                                                                                                                                                                                                  |
| **Input**      | None (uses MONGODB_URI from env/header)                                                                                                                                                                                                                                                                                               |
| **Output**     | `connected` (boolean) - Whether connection was successful, `message` (string) - Status message, `host` (string) - Server host address, `version` (string) - MongoDB server version, `database` (string) - Current database name, `collections` (number) - Total collection count, `collectionList` (array) - Names of all collections |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                                                               |

---

### **1.2 - `list_databases`**

List all available databases on the MongoDB server with optional size information and system database inclusion.

| Property       | Value                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                             |
| **Read/Write** | Read                                                                                                                                                |
| **Input**      | `includeSize` (boolean, optional) - Show database size on disk, `includeSystemDatabases` (boolean, optional) - Include admin/config/local databases |
| **Output**     | `databases` (array of {name, sizeOnDisk, empty}) - List of databases with details, `totalCount` (number) - Total databases found                    |
| **Status**     | ✅ DONE                                                                                                                                             |

---

### **1.3 - `create_database`**

Create a new database by inserting a document into an initial collection to materialize it. Database name supports letters, numbers, underscores, and hyphens (max 64 chars).

| Property       | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                |
| **Read/Write** | Write                                                                                                                  |
| **Input**      | `database` (string) - Database name, `collection` (string, optional, default: "\_setup") - Initial collection name     |
| **Output**     | `database` (string) - Created database name, `created` (boolean) - Success status, `message` (string) - Result details |
| **Status**     | ✅ DONE                                                                                                                |

---

### **1.4 - `drop_database`**

Permanently delete a database with a confirmation toggle for safety. System databases (admin, config, local) are protected from deletion.

| Property       | Value                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Category**   | Database Administration                                                                    |
| **Read/Write** | Write                                                                                      |
| **Input**      | `database` (string) - Database name to drop, `confirm` (boolean) - Must be true to proceed |
| **Output**     | `database` (string), `dropped` (boolean) - Success status, `message` (string)              |
| **Status**     | ✅ DONE                                                                                    |

---

### **1.5 - `database_stats`**

Get comprehensive statistics for a database including total size, document count, index count, storage details, and optional per-collection breakdown.

| Property       | Value                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                                                                            |
| **Read/Write** | Read                                                                                                                                                                                               |
| **Input**      | `database` (string) - Database name, `includeCollectionDetails` (boolean, optional) - Include per-collection statistics                                                                            |
| **Output**     | `database`, `sizeOnDisk`, `collections`, `documents`, `indexes`, `storageSize`, `dataSize`, `indexSize`, `avgObjSize`, `fsTotalSize`, `fsUsedSize`, `views`, `collectionDetails` (array, optional) |
| **Status**     | ✅ DONE                                                                                                                                                                                            |

---

### **1.6 - `list_collections`**

List all collections in a database with optional statistics (document count, size, index count) and name pattern filtering.

| Property       | Value                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                                   |
| **Read/Write** | Read                                                                                                                                                      |
| **Input**      | `database` (string) - Database name, `includeStats` (boolean, optional) - Include statistics, `namePattern` (string, optional) - Filter by name substring |
| **Output**     | `database`, `collections` (array of {name, type, documentCount, size, indexCount}), `totalCount`, `message`                                               |
| **Status**     | ✅ DONE                                                                                                                                                   |

---

### **1.7 - `create_collection`**

Create a new empty collection. Use field tools separately to define validation schema and indexes. Collection name supports letters, numbers, underscores (max 255 chars, no "system." prefix).

| Property       | Value                                          |
| -------------- | ---------------------------------------------- |
| **Category**   | Database Administration                        |
| **Read/Write** | Write                                          |
| **Input**      | `database` (string), `collection` (string)     |
| **Output**     | `database`, `collection`, `created`, `message` |
| **Status**     | ✅ DONE                                        |

---

### **1.8 - `drop_collection`**

Permanently delete a collection with confirmation toggle. System collections (system.\*) are protected.

| Property       | Value                                                           |
| -------------- | --------------------------------------------------------------- |
| **Category**   | Database Administration                                         |
| **Read/Write** | Write                                                           |
| **Input**      | `database` (string), `collection` (string), `confirm` (boolean) |
| **Output**     | `database`, `collection`, `dropped`, `message`                  |
| **Status**     | ✅ DONE                                                         |

---

### **1.9 - `rename_collection`**

Rename an existing collection to a new name. Returns document count of the renamed collection.

| Property       | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| **Category**   | Database Administration                                      |
| **Read/Write** | Write                                                        |
| **Input**      | `database` (string), `oldName` (string), `newName` (string)  |
| **Output**     | `database`, `oldName`, `newName`, `renamed`, `documentCount` |
| **Status**     | ✅ DONE                                                      |

---

### **1.10 - `collection_stats`**

Get comprehensive collection statistics including document count, sizes, all indexes with details (name, key, unique, sparse, TTL), and fields from the validator schema (name, type, required). Shows array item types and object properties for nested structures.

| Property       | Value                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                                                                |
| **Read/Write** | Read                                                                                                                                                                                   |
| **Input**      | `database` (string), `collection` (string)                                                                                                                                             |
| **Output**     | `database`, `collection`, `message`, `stats` ({documentCount, totalSize, avgDocumentSize, storageSize, totalIndexSize}), `indexes` (array), `fields` (array of {name, type, required}) |
| **Status**     | ✅ DONE                                                                                                                                                                                |

---

### **1.11 - `list_indexes`**

List all indexes on a collection with details: name, key fields, unique, sparse, and TTL properties.

| Property       | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                  |
| **Read/Write** | Read                                                                                                     |
| **Input**      | `database` (string), `collection` (string)                                                               |
| **Output**     | `database`, `collection`, `indexes` (array of {name, key, unique, sparse, ttl}), `totalCount`, `message` |
| **Status**     | ✅ DONE                                                                                                  |

---

### **1.12 - `add_index`**

Create an index on a field. Skips if index already exists. Supports unique, text search, sparse, and TTL options.

| Property       | Value                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                                                                                     |
| **Read/Write** | Write                                                                                                                                                                                       |
| **Input**      | `database` (string), `collection` (string), `field` (string), `unique` (boolean, optional), `textSearch` (boolean, optional), `sparse` (boolean, optional), `ttlSeconds` (number, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                       |
| **Status**     | ✅ DONE                                                                                                                                                                                     |

---

### **1.13 - `drop_index`**

Remove an index from a field. Finds the index by field name and drops it. Cannot drop the default `_id` index.

| Property       | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| **Category**   | Database Administration                                      |
| **Read/Write** | Write                                                        |
| **Input**      | `database` (string), `collection` (string), `field` (string) |
| **Output**     | `database`, `collection`, `field`, `dropped`, `message`      |
| **Status**     | ✅ DONE                                                      |

---

### **1.14 - `list_fields`**

List all fields in a collection with complete details: type, required status, validation rules (min/max, pattern, enum), indexes, and descriptions. Shows array item types and nested object properties.

| Property       | Value                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Database Administration                                                                                                         |
| **Read/Write** | Read                                                                                                                            |
| **Input**      | `database` (string), `collection` (string)                                                                                      |
| **Output**     | `database`, `collection`, `message`, `fields` (array of {name, type, required, validation, indexes, description}), `totalCount` |
| **Status**     | ✅ DONE                                                                                                                         |

---

## **PHASE 2: SCHEMA & FIELD MANAGEMENT**

Tools for defining collection schemas, adding fields with validation, indexes, and relationships.

---

### **2.1 - `add_string_field`**

Add a string/email/url/phone/zipCode field with validation (min/max length, regex pattern), required flag, unique index, and default value. Auto-applies regex patterns for email, url, phone, and zipCode types.

| Property       | Value                                                                                                                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Schema Management                                                                                                                                                                                                                                                                                                                      |
| **Read/Write** | Write                                                                                                                                                                                                                                                                                                                                  |
| **Input**      | `database` (string), `collection` (string), `name` (string), `type` (enum: string/email/url/phone/zipCode), `required` (boolean, optional), `unique` (boolean, optional), `minLength` (number, optional), `maxLength` (number, optional), `pattern` (string, optional), `default` (string, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                                                                                                                                                                  |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                                                                |

---

### **2.2 - `add_number_field`**

Add a number field with min/max validation, required flag, unique index, and default value.

| Property       | Value                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Schema Management                                                                                                                                                                                                                             |
| **Read/Write** | Write                                                                                                                                                                                                                                         |
| **Input**      | `database` (string), `collection` (string), `name` (string), `required` (boolean, optional), `unique` (boolean, optional), `min` (number, optional), `max` (number, optional), `default` (number, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                                                                         |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                       |

---

### **2.3 - `add_boolean_field`**

Add a boolean field with required flag and default value.

| Property       | Value                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**   | Schema Management                                                                                                                                            |
| **Read/Write** | Write                                                                                                                                                        |
| **Input**      | `database` (string), `collection` (string), `name` (string), `required` (boolean, optional), `default` (boolean, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                        |
| **Status**     | ✅ DONE                                                                                                                                                      |

---

### **2.4 - `add_date_field`**

Add a date field with min/max date validation, auto-set on insert, auto-update on every change, unique index, ascending/descending indexes, and TTL auto-delete support.

| Property       | Value                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Schema Management                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Read/Write** | Write                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Input**      | `database` (string), `collection` (string), `name` (string), `required` (boolean, optional), `autoSet` (boolean, optional) - Set once on insert, `autoUpdate` (boolean, optional) - Update on every change, `unique` (boolean, optional), `index` (boolean, optional), `descendingIndex` (boolean, optional), `minDate` (string, optional), `maxDate` (string, optional), `expireAfterSeconds` (number, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                                                                                                                                                                                                                                                                               |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

### **2.5 - `add_array_field`**

Add an array field with item type support (string, number, boolean, object, nested array), min/max items, unique items, and object property definitions for arrays of objects.

| Property       | Value                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Schema Management                                                                                                                                                                                                                                                                                                                                             |
| **Read/Write** | Write                                                                                                                                                                                                                                                                                                                                                         |
| **Input**      | `database` (string), `collection` (string), `name` (string), `itemType` (enum: string/number/boolean/object/array), `required` (boolean, optional), `minItems` (number, optional), `maxItems` (number, optional), `uniqueItems` (boolean, optional), `objectFields` (object, optional), `objectRequired` (string, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                                                                                                                                                                                         |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                                                                                       |

---

### **2.6 - `add_objectId_field`**

Add an ObjectId reference field with bidirectional relationship tracking. Verifies referenced collection exists, creates appropriate index (unique for 1:1, regular for 1:N), and stores relationship metadata in `_schema` on BOTH collections enabling AI to auto-build `$lookup` queries.

| Property       | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Schema Management                                                                                                                                                                                                                                                                                                                                                                                          |
| **Read/Write** | Write                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Input**      | `database` (string), `collection` (string) - The CHILD collection, `fieldName` (string), `referencesCollection` (string) - The PARENT collection, `referencesField` (string, optional, default: "\_id"), `relationshipType` (enum: one-to-one/one-to-many), `isRequired` (boolean, optional), `createIndex` (boolean, optional), `createSparseIndex` (boolean, optional), `description` (string, optional) |
| **Output**     | `database`, `collection`, `field`, `added`, `message`                                                                                                                                                                                                                                                                                                                                                      |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## **PHASE 3: CRUD OPERATIONS**

Tools for creating, reading, updating, and deleting documents with schema validation and auto-set fields.

---

### **3.1 - `insert_one`**

Insert a single document into a collection. Validates against collection schema (required fields), auto-sets date fields marked with `autoSet` (e.g., createdAt), reports extra fields not in schema, and returns schema info for reference.

| Property       | Value                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**   | CRUD                                                                                                                                                                                                   |
| **Read/Write** | Write                                                                                                                                                                                                  |
| **Input**      | `database` (string), `collection` (string), `document` (object) - Document to insert                                                                                                                   |
| **Output**     | `database`, `collection`, `insertedId`, `acknowledged`, `message`, `schema` (optional), `validatedFields` (optional), `missingFields` (optional), `extraFields` (optional), `autoSetFields` (optional) |
| **Status**     | ✅ DONE                                                                                                                                                                                                |

---

### **3.2 - `insert_many`**

Insert multiple documents in a single batch. Max 1000 documents. Auto-sets `createdAt` and `updatedAt` fields if they exist in the collection schema.

| Property       | Value                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Category**   | CRUD                                                                                             |
| **Read/Write** | Write                                                                                            |
| **Input**      | `database` (string), `collection` (string), `documents` (array of objects) - Documents to insert |
| **Output**     | `database`, `collection`, `insertedCount`, `insertedIds`, `acknowledged`, `message`              |
| **Status**     | ✅ DONE                                                                                          |

---

### **3.3 - `find_documents`**

Find documents with full MongoDB filter support ($and, $or, $in, $gte, $regex, $exists, deeply nested combinations), comma-separated projection, sort (field + asc/desc), and professional pagination (page, limit, hasNextPage, hasPreviousPage, nextPage, previousPage, totalDocuments, totalPages).

| Property       | Value                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                                                                                                                                                                                                                                    |
| **Read/Write** | Read                                                                                                                                                                                                                                                                                    |
| **Input**      | `database` (string), `collection` (string), `filter` (object, optional) - MongoDB filter query, `projection` (string, optional) - Comma-separated fields, `sortField` (string, optional), `sortOrder` (enum: asc/desc, optional), `page` (number, optional), `limit` (number, optional) |
| **Output**     | `database`, `collection`, `documents` (array), `pagination` ({page, limit, totalDocuments, totalPages, hasNextPage, hasPreviousPage, nextPage, previousPage}), `message`                                                                                                                |
| **Status**     | ✅ DONE                                                                                                                                                                                                                                                                                 |

---

### **3.4 - `find_one`**

Find a single document by MongoDB filter query with optional comma-separated projection.

| Property       | Value                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                                                                                           |
| **Read/Write** | Read                                                                                                                                           |
| **Input**      | `database` (string), `collection` (string), `filter` (object) - MongoDB filter query, `projection` (string, optional) - Comma-separated fields |
| **Output**     | `database`, `collection`, `document` (object, nullable), `found` (boolean), `message`                                                          |
| **Status**     | ✅ DONE                                                                                                                                        |

---

### **3.5 - `update_one`**

Update a single document by its `_id`. Only provided fields are updated, others remain unchanged. Auto-updates `updatedAt` field if it exists in the collection schema.

| Property       | Value                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                                                                            |
| **Read/Write** | Write                                                                                                                           |
| **Input**      | `database` (string), `collection` (string), `id` (string) - Document ID, `update` (object) - Fields to update                   |
| **Output**     | `database`, `collection`, `id`, `matchedCount`, `modifiedCount`, `acknowledged`, `message`, `updatedFields`, `autoUpdateFields` |
| **Status**     | ✅ DONE                                                                                                                         |

---

### **3.6 - `update_many`**

Update multiple documents by their IDs in a single batch using bulkWrite. Each update specifies the document ID and fields to update. Max 1000 updates per batch. Auto-updates `updatedAt` field.

| Property       | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                                                     |
| **Read/Write** | Write                                                                                                    |
| **Input**      | `database` (string), `collection` (string), `updates` (array of {id, fields}) - Updates to apply         |
| **Output**     | `database`, `collection`, `matchedCount`, `modifiedCount`, `acknowledged`, `message`, `autoUpdateFields` |
| **Status**     | ✅ DONE                                                                                                  |

---

### **3.7 - `delete_one`**

Delete a single document by its `_id`. Returns whether the document was found and deleted.

| Property       | Value                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                              |
| **Read/Write** | Write                                                                             |
| **Input**      | `database` (string), `collection` (string), `id` (string) - Document ID to delete |
| **Output**     | `database`, `collection`, `id`, `deleted`, `message`                              |
| **Status**     | ✅ DONE                                                                           |

---

### **3.8 - `delete_many`**

Delete multiple documents by their IDs in a single batch. Max 1000 IDs per batch.

| Property       | Value                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Category**   | CRUD                                                                                          |
| **Read/Write** | Write                                                                                         |
| **Input**      | `database` (string), `collection` (string), `ids` (array of strings) - Document IDs to delete |
| **Output**     | `database`, `collection`, `deletedCount`, `acknowledged`, `message`                           |
| **Status**     | ✅ DONE                                                                                       |

---

## **PHASE 4: AGGREGATION & ADVANCED QUERIES**

---

### **4.1 - `aggregate`**

Execute MongoDB aggregation pipeline for complex data analysis, transformations, and joins. Supports all stages: `$match`, `$group`, `$sort`, `$project`, `$lookup`, `$unwind`, `$limit`, `$skip`, `$addFields`, `$count`, `$facet`. Supports accumulators: `$sum`, `$avg`, `$min`, `$max`, `$push`, `$addToSet`, `$first`, `$last`. Works with `_schema` relationships stored by `add_objectId_field` for intelligent joins.

| Property       | Value                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**   | Query                                                                                                                                                                                   |
| **Read/Write** | Read                                                                                                                                                                                    |
| **Input**      | `database` (string), `collection` (string), `pipeline` (array of objects) - Aggregation stages, `allowDiskUse` (boolean, optional), `limit` (number, optional, default: 100, max: 1000) |
| **Output**     | `database`, `collection`, `results` (array), `count`, `executionTimeMs`, `message`                                                                                                      |
| **Status**     | ✅ DONE                                                                                                                                                                                 |

---

## **SUMMARY**

| Phase     | Category                  | Tools  | Completed |
| --------- | ------------------------- | ------ | --------- |
| 1         | Database Administration   | 14     | 14        |
| 2         | Schema & Field Management | 6      | 6         |
| 3         | CRUD Operations           | 8      | 8         |
| 4         | Aggregation & Queries     | 1      | 1         |
| **TOTAL** |                           | **29** | **29**    |

---

## **ERROR CODES**

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
| `BATCH_TOO_LARGE`             | Exceeded maximum batch size (1000)            |
| `INSERT_FAILED`               | Document insertion failed                     |
| `QUERY_FAILED`                | Query execution failed                        |
| `UPDATE_FAILED`               | Update operation failed                       |
| `DELETE_FAILED`               | Delete operation failed                       |
| `AGGREGATION_FAILED`          | Aggregation pipeline failed                   |
| `INDEX_OPERATION_FAILED`      | Index operation failed                        |
| `RENAME_FAILED`               | Collection rename failed                      |
| `STATS_FAILED`                | Failed to get statistics                      |
| `ADD_FIELD_FAILED`            | Failed to add field                           |
| `REMOVE_FIELDS_FAILED`        | Failed to remove fields                       |
| `LIST_FIELDS_FAILED`          | Failed to list fields                         |

---