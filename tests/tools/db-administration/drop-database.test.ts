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
import { dropDatabaseTool } from "@/lib/mcp/tools/db-administration/drop-database";

describe("drop_database tool", () => {
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

	beforeEach(async () => {
		createdDatabases.length = 0;
	});

	afterEach(async () => {
		// Clean up any remaining databases
		for (const dbName of createdDatabases) {
			try {
				const dbExists = await databaseExists(dbName);
				if (dbExists) {
					await mongoClient.db(dbName).dropDatabase();
				}
			} catch (e) {
				// Ignore errors
			}
		}
	});

	// Helper function to create a test database
	async function createTestDatabase(dbName: string): Promise<void> {
		const db = mongoClient.db(dbName);
		await db.createCollection("test_collection");
		await db.collection("test_collection").insertOne({ test: true });
		createdDatabases.push(dbName);
	}

	// Helper function to check if database exists
	async function databaseExists(dbName: string): Promise<boolean> {
		const adminDb = mongoClient.db("admin");
		const dbList = await adminDb.admin().listDatabases();
		return dbList.databases.some((db: any) => db.name === dbName);
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should drop an existing database with confirmation", async () => {
			const dbName = `test_db_drop_${Date.now()}`;
			await createTestDatabase(dbName);

			// Verify database exists
			expect(await databaseExists(dbName)).toBe(true);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(dbName);
			expect(content.dropped).toBe(true);
			expect(content.message).toBe(
				`Database '${dbName}' dropped successfully`,
			);

			// Verify database no longer exists
			expect(await databaseExists(dbName)).toBe(false);
		});

		it("should drop a database with multiple collections", async () => {
			const dbName = `test_db_multi_collection_${Date.now()}`;
			const db = mongoClient.db(dbName);
			await db.createCollection("users");
			await db.createCollection("products");
			await db.createCollection("orders");
			createdDatabases.push(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(true);
			expect(await databaseExists(dbName)).toBe(false);
		});

		it("should drop a database with large amount of data", async () => {
			const dbName = `test_db_large_${Date.now()}`;
			const db = mongoClient.db(dbName);
			const collection = db.collection("large_data");

			// Insert 100 documents
			for (let i = 0; i < 100; i++) {
				await collection.insertOne({ id: i, data: `data_${i}` });
			}
			createdDatabases.push(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(true);
			expect(await databaseExists(dbName)).toBe(false);
		});
	});

	// ============================================================
	// CONFIRMATION VALIDATION TESTS
	// ============================================================

	describe("Confirmation Validation", () => {
		it("should reject dropping database when confirm is false", async () => {
			const dbName = `test_db_no_confirm_${Date.now()}`;
			await createTestDatabase(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: false },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("CONFIRMATION_FAILED");
			expect(content.message).toContain(
				"Confirmation toggle must be checked",
			);

			// Database should still exist
			expect(await databaseExists(dbName)).toBe(true);
		});

		it("should reject dropping database when confirm is not provided", async () => {
			const dbName = `test_db_no_confirm_field_${Date.now()}`;
			await createTestDatabase(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName } as any,
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
		});
	});

	// ============================================================
	// SYSTEM DATABASE PROTECTION TESTS
	// ============================================================

	describe("System Database Protection", () => {
		it("should reject dropping admin database", async () => {
			const result = await dropDatabaseTool.handler(
				{ database: "admin", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(
				"SYSTEM_DATABASE_PROTECTED: Cannot drop system database 'admin'",
			);
		});

		it("should reject dropping config database", async () => {
			const result = await dropDatabaseTool.handler(
				{ database: "config", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(
				"SYSTEM_DATABASE_PROTECTED: Cannot drop system database 'config'",
			);
		});

		it("should reject dropping local database", async () => {
			const result = await dropDatabaseTool.handler(
				{ database: "local", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(
				"SYSTEM_DATABASE_PROTECTED: Cannot drop system database 'local'",
			);
		});
	});

	// ============================================================
	// NON-EXISTENT DATABASE TESTS
	// ============================================================

	describe("Non-existent Database", () => {
		it("should return error when trying to drop non-existent database", async () => {
			const nonExistentDb = `non_existent_db_${Date.now()}`;

			const result = await dropDatabaseTool.handler(
				{ database: nonExistentDb, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DATABASE_NOT_FOUND");
			expect(content.message).toContain(nonExistentDb);
		});
	});

	// ============================================================
	// IDEMPOTENCY TESTS
	// ============================================================

	describe("Idempotency", () => {
		it("should return error when dropping already dropped database", async () => {
			const dbName = `test_db_idempotent_${Date.now()}`;
			await createTestDatabase(dbName);

			// First drop - should succeed
			const firstResult = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second drop - should fail (database doesn't exist)
			const secondResult = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DATABASE_NOT_FOUND");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const dbName = `test_db_response_success_${Date.now()}`;
			await createTestDatabase(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await dropDatabaseTool.handler(
				{ database: "non_existent", confirm: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const dbName = `test_db_json_${Date.now()}`;
			await createTestDatabase(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
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
				expect(parsed.dropped).toBe(true);
			}
		});
	});

	// ============================================================
	// CONNECTION ERROR TESTS
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

			const result = await dropDatabaseTool.handler(
				{ database: "test_db", confirm: true },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_DATABASE_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await dropDatabaseTool.handler(
				{ database: "test_db", confirm: true },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_DATABASE_FAILED");
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should handle database name with special characters", async () => {
			const dbName = `test-db_special_123_${Date.now()}`;
			await createTestDatabase(dbName);

			const result = await dropDatabaseTool.handler(
				{ database: dbName, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(true);
			expect(await databaseExists(dbName)).toBe(false);
		});

		it("should handle database name with max length (63 chars)", async () => {
			const maxLengthName = "a".repeat(63);
			await createTestDatabase(maxLengthName);

			const result = await dropDatabaseTool.handler(
				{ database: maxLengthName, confirm: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(true);
			expect(await databaseExists(maxLengthName)).toBe(false);
		});

		it("should reject empty database name", async () => {
			const result = await dropDatabaseTool.handler(
				{ database: "", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
		});
	});

	// ============================================================
	// CONCURRENT OPERATION TESTS
	// ============================================================

	describe("Concurrent Operations", () => {
		it("should handle multiple sequential drop operations", async () => {
			const dbNames = [];
			for (let i = 0; i < 5; i++) {
				const dbName = `test_db_seq_${i}_${Date.now()}`;
				await createTestDatabase(dbName);
				dbNames.push(dbName);
			}

			for (const dbName of dbNames) {
				const result = await dropDatabaseTool.handler(
					{ database: dbName, confirm: true },
					mockExtra,
				);
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).dropped).toBe(true);
			}
		});
	});
});
