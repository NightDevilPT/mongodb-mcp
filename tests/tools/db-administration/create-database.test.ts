import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
} from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createDatabaseTool } from "@/lib/mcp/tools/db-administration/create-database";

describe("create_database tool", () => {
	let mongoServer: MongoMemoryServer;
	let mongoClient: MongoClient;
	let mockExtra: any;
	const createdDatabases: string[] = [];

	beforeAll(async () => {
		mongoServer = await MongoMemoryServer.create();
		const uri = mongoServer.getUri();
		mongoClient = new MongoClient(uri);
		await mongoClient.connect();

		mockExtra = {
			requestInfo: {
				headers: {
					mongodb_url: uri,
				},
			},
		} as any;
	});

	afterAll(async () => {
		// Clean up all created databases
		for (const dbName of createdDatabases) {
			try {
				await mongoClient.db(dbName).dropDatabase();
			} catch (e) {
				// Ignore errors
			}
		}
		await mongoClient.close();
		await mongoServer.stop();
	});

	beforeEach(() => {
		// Clear created databases list
		createdDatabases.length = 0;
	});

	afterEach(async () => {
		// Clean up databases created during tests
		for (const dbName of createdDatabases) {
			try {
				await mongoClient.db(dbName).dropDatabase();
			} catch (e) {
				// Ignore errors
			}
		}
	});

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should create a new database with default collection name", async () => {
			const dbName = `test_db_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(dbName);
			expect(content.created).toBe(true);
			expect(content.message).toContain(
				`Database '${dbName}' created successfully`,
			);
			expect(content.message).toContain("collection '_setup'");

			// Verify database was actually created
			const adminDb = mongoClient.db("admin");
			const dbList = await adminDb.admin().listDatabases();
			const dbExists = dbList.databases.some(
				(db: any) => db.name === dbName,
			);
			expect(dbExists).toBe(true);

			// Verify initial collection was created
			const db = mongoClient.db(dbName);
			const collections = await db.listCollections().toArray();
			const collectionNames = collections.map((c) => c.name);
			expect(collectionNames).toContain("_setup");
		});

		it("should create a new database with custom collection name", async () => {
			const dbName = `test_db_custom_${Date.now()}`;
			const customCollection = "init_data";
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName, collection: customCollection },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.message).toContain(
				`collection '${customCollection}'`,
			);

			// Verify custom collection was created
			const db = mongoClient.db(dbName);
			const collections = await db.listCollections().toArray();
			const collectionNames = collections.map((c) => c.name);
			expect(collectionNames).toContain(customCollection);
		});

		it("should create database with valid name containing hyphens", async () => {
			const dbName = `test-db-with-hyphens-${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.database).toBe(dbName);
		});

		it("should create database with valid name containing underscores", async () => {
			const dbName = `test_db_with_underscores_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.database).toBe(dbName);
		});

		it("should create database with valid name containing numbers", async () => {
			const dbName = `test_db_123_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.database).toBe(dbName);
		});

		it("should create multiple databases sequentially", async () => {
			const dbName1 = `test_db_seq1_${Date.now()}`;
			const dbName2 = `test_db_seq2_${Date.now()}`;
			createdDatabases.push(dbName1, dbName2);

			const result1 = await createDatabaseTool.handler(
				{ database: dbName1 },
				mockExtra,
			);
			const result2 = await createDatabaseTool.handler(
				{ database: dbName2 },
				mockExtra,
			);

			expect(result1.isError).toBeFalsy();
			expect(result2.isError).toBeFalsy();
			expect((result1.structuredContent as any).created).toBe(true);
			expect((result2.structuredContent as any).created).toBe(true);
		});
	});

	// ============================================================
	// VALIDATION ERROR CASES
	// ============================================================

	describe("Validation Errors", () => {
		it("should reject empty database name", async () => {
			const result = await createDatabaseTool.handler(
				{ database: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				"INVALID_DATABASE_NAME: Database name cannot be empty",
			);
		});

		it("should reject database name exceeding max length (64 chars)", async () => {
			const longName = "a".repeat(65);
			const result = await createDatabaseTool.handler(
				{ database: longName },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("exceeds 64 characters");
		});

		it("should reject database name with invalid characters (spaces)", async () => {
			const result = await createDatabaseTool.handler(
				{ database: "test database" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, underscores, and hyphens allowed",
			);
		});

		it("should reject database name with invalid characters (dots)", async () => {
			const result = await createDatabaseTool.handler(
				{ database: "test.database" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, underscores, and hyphens allowed",
			);
		});

		it("should reject database name with invalid characters (special chars)", async () => {
			const result = await createDatabaseTool.handler(
				{ database: "test@database!" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, underscores, and hyphens allowed",
			);
		});

		it('should reject system database "admin"', async () => {
			const result = await createDatabaseTool.handler(
				{ database: "admin" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				"INVALID_DATABASE_NAME: Cannot create system database",
			);
		});

		it('should reject system database "config"', async () => {
			const result = await createDatabaseTool.handler(
				{ database: "config" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				"INVALID_DATABASE_NAME: Cannot create system database",
			);
		});

		it('should reject system database "local"', async () => {
			const result = await createDatabaseTool.handler(
				{ database: "local" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				"INVALID_DATABASE_NAME: Cannot create system database",
			);
		});
	});

	// ============================================================
	// DUPLICATE DATABASE CASES
	// ============================================================

	describe("Duplicate Database Errors", () => {
		it("should reject creating database that already exists", async () => {
			const dbName = `test_db_duplicate_${Date.now()}`;
			createdDatabases.push(dbName);

			// First creation should succeed
			const firstResult = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second creation should fail
			const secondResult = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				"DATABASE_EXISTS: Database already exists",
			);
		});
	});

	// ============================================================
	// INITIAL COLLECTION CONTENT TESTS
	// ============================================================

	describe("Initial Collection Content", () => {
		it("should create initial collection with correct document structure", async () => {
			const dbName = `test_db_content_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);
			expect(result.isError).toBeFalsy();

			const db = mongoClient.db(dbName);
			const setupDoc = await db.collection("_setup").findOne({});

			expect(setupDoc).toBeDefined();
			expect(setupDoc).toHaveProperty("_created");
			expect(setupDoc).toHaveProperty("_message", "Database initialized");
			expect(setupDoc?._created instanceof Date).toBe(true);
		});

		it("should create custom initial collection with correct document structure", async () => {
			const dbName = `test_db_custom_content_${Date.now()}`;
			const customCollection = "my_init";
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName, collection: customCollection },
				mockExtra,
			);
			expect(result.isError).toBeFalsy();

			const db = mongoClient.db(dbName);
			const setupDoc = await db.collection(customCollection).findOne({});

			expect(setupDoc).toBeDefined();
			expect(setupDoc).toHaveProperty("_created");
			expect(setupDoc).toHaveProperty("_message", "Database initialized");
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should handle database name with max length (63 chars)", async () => {
			const maxLengthName = "a".repeat(63);
			createdDatabases.push(maxLengthName);

			const result = await createDatabaseTool.handler(
				{ database: maxLengthName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.database).toBe(maxLengthName);
		});

		it("should reject database name exceeding max length", async () => {
			const tooLongName = "a".repeat(64);
			const result = await createDatabaseTool.handler(
				{ database: tooLongName },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"db name must be at most 63 characters",
			);
		});

		it("should handle database name with mixed valid characters", async () => {
			const mixedName = `Test_DB-123_${Date.now()}`;
			createdDatabases.push(mixedName);

			const result = await createDatabaseTool.handler(
				{ database: mixedName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.database).toBe(mixedName);
		});

		it("should handle collection name with special characters", async () => {
			const dbName = `test_db_special_coll_${Date.now()}`;
			const specialCollection = "init-data_v1";
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName, collection: specialCollection },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(content.message).toContain(specialCollection);
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const dbName = `test_db_response_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("created");
			expect(content).toHaveProperty("message");
			expect(content.created).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await createDatabaseTool.handler(
				{ database: "" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("created");
			expect(content).toHaveProperty("message");
			expect(content.created).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const dbName = `test_db_json_${Date.now()}`;
			createdDatabases.push(dbName);

			const result = await createDatabaseTool.handler(
				{ database: dbName },
				mockExtra,
			);

			expect(result.content).toBeDefined();
			expect(result.content).toHaveLength(1);

			const firstContent = result.content[0];
			expect(firstContent).toHaveProperty("type");

			if (firstContent.type === "text") {
				expect(firstContent.text).toBeDefined();
				const parsed = JSON.parse(firstContent.text);
				expect(parsed.database).toBe(dbName);
				expect(parsed.created).toBe(true);
			}
		});
	});

	// ============================================================
	// CONNECTION ERROR CASES
	// ============================================================

	describe("Connection Errors", () => {
		it("should handle connection error gracefully", async () => {
			const mockExtraInvalid = {
				requestInfo: {
					headers: {
						mongodb_url: "mongodb://invalid-host:99999",
					},
				},
			} as any;

			const result = await createDatabaseTool.handler(
				{ database: "test_db" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("CREATE_DATABASE_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await createDatabaseTool.handler(
				{ database: "test_db" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("CREATE_DATABASE_FAILED");
		});
	});
});
