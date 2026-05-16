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
import { listDatabasesTool } from "@/lib/mcp/tools/db-administration/list-databases";

describe("list_databases tool", () => {
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

	// Helper function to create test databases
	async function createTestDatabase(
		dbName: string,
		withCollection: boolean = true,
	) {
		const db = mongoClient.db(dbName);
		if (withCollection) {
			await db.createCollection("test_collection");
			await db.collection("test_collection").insertOne({ test: true });
		}
		createdDatabases.push(dbName);
		return db;
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should list databases excluding system databases by default", async () => {
			// Create test databases
			await createTestDatabase("test_db_1");
			await createTestDatabase("test_db_2");

			const result = await listDatabasesTool.handler({}, mockExtra);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.databases).toBeDefined();
			expect(content.totalCount).toBeGreaterThanOrEqual(2);

			// Should not include system databases
			const dbNames = content.databases.map((db: any) => db.name);
			expect(dbNames).not.toContain("admin");
			expect(dbNames).not.toContain("config");
			expect(dbNames).not.toContain("local");
			expect(dbNames).toContain("test_db_1");
			expect(dbNames).toContain("test_db_2");
		});

		it("should include system databases when includeSystemDatabases is true", async () => {
			const result = await listDatabasesTool.handler(
				{ includeSystemDatabases: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			const dbNames = content.databases.map((db: any) => db.name);
			expect(dbNames).toContain("admin");
			expect(dbNames).toContain("config");
			expect(dbNames).toContain("local");
		});

		it("should return zero size when includeSize is false", async () => {
			await createTestDatabase("test_db_size_false");

			const result = await listDatabasesTool.handler(
				{ includeSize: false },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			const testDb = content.databases.find(
				(db: any) => db.name === "test_db_size_false",
			);
			expect(testDb).toBeDefined();
			expect(testDb.sizeOnDisk).toBe(0);
			expect(testDb.empty).toBe(true);
		});

		it("should return actual size when includeSize is true", async () => {
			await createTestDatabase("test_db_size_true");

			const result = await listDatabasesTool.handler(
				{ includeSize: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			const testDb = content.databases.find(
				(db: any) => db.name === "test_db_size_true",
			);
			expect(testDb).toBeDefined();
			expect(testDb.sizeOnDisk).toBeGreaterThanOrEqual(0);
		});

		it("should handle empty database list", async () => {
			// Don't create any databases, just use default ones
			const result = await listDatabasesTool.handler({}, mockExtra);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.databases).toBeDefined();
			expect(content.totalCount).toBeDefined();
		});

		it("should list multiple databases created", async () => {
			await createTestDatabase("db_a");
			await createTestDatabase("db_b");
			await createTestDatabase("db_c");

			const result = await listDatabasesTool.handler({}, mockExtra);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			const dbNames = content.databases.map((db: any) => db.name);
			expect(dbNames).toContain("db_a");
			expect(dbNames).toContain("db_b");
			expect(dbNames).toContain("db_c");
			expect(content.totalCount).toBeGreaterThanOrEqual(3);
		});
	});

	// ============================================================
	// SYSTEM DATABASE FILTERING TESTS
	// ============================================================

	describe("System Database Filtering", () => {
		it("should exclude all system databases by default", async () => {
			const result = await listDatabasesTool.handler({}, mockExtra);

			const content = result.structuredContent as any;
			const dbNames = content.databases.map((db: any) => db.name);

			expect(dbNames).not.toContain("admin");
			expect(dbNames).not.toContain("config");
			expect(dbNames).not.toContain("local");
		});

		it("should include system databases when explicitly requested", async () => {
			const result = await listDatabasesTool.handler(
				{ includeSystemDatabases: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const dbNames = content.databases.map((db: any) => db.name);

			expect(dbNames).toContain("admin");
			expect(dbNames).toContain("config");
			expect(dbNames).toContain("local");
		});

		it("should filter system databases when includeSystemDatabases is false", async () => {
			const result = await listDatabasesTool.handler(
				{ includeSystemDatabases: false },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const dbNames = content.databases.map((db: any) => db.name);

			expect(dbNames).not.toContain("admin");
			expect(dbNames).not.toContain("config");
			expect(dbNames).not.toContain("local");
		});
	});

	// ============================================================
	// SIZE INFORMATION TESTS
	// ============================================================

	describe("Size Information", () => {
		it("should set sizeOnDisk to 0 when includeSize is false", async () => {
			await createTestDatabase("test_db_no_size");

			const result = await listDatabasesTool.handler(
				{ includeSize: false },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const testDb = content.databases.find(
				(db: any) => db.name === "test_db_no_size",
			);

			expect(testDb.sizeOnDisk).toBe(0);
		});

		it("should set empty flag to true when includeSize is false", async () => {
			await createTestDatabase("test_db_empty_flag");

			const result = await listDatabasesTool.handler(
				{ includeSize: false },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const testDb = content.databases.find(
				(db: any) => db.name === "test_db_empty_flag",
			);

			expect(testDb.empty).toBe(true);
		});

		it("should set empty flag correctly when includeSize is true for non-empty db", async () => {
			await createTestDatabase("test_db_non_empty");

			const result = await listDatabasesTool.handler(
				{ includeSize: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const testDb = content.databases.find(
				(db: any) => db.name === "test_db_non_empty",
			);

			expect(testDb.empty).toBe(false);
		});
	});

	// ============================================================
	// TOTAL COUNT TESTS
	// ============================================================

	describe("Total Count", () => {
		it("should return correct total count excluding system databases", async () => {
			await createTestDatabase("test_count_1");
			await createTestDatabase("test_count_2");

			const result = await listDatabasesTool.handler({}, mockExtra);

			const content = result.structuredContent as any;
			const userDbCount = content.databases.filter(
				(db: any) => !["admin", "config", "local"].includes(db.name),
			).length;

			expect(content.totalCount).toBe(userDbCount);
		});

		it("should return correct total count including system databases", async () => {
			const result = await listDatabasesTool.handler(
				{ includeSystemDatabases: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const allDbCount = content.databases.length;

			expect(content.totalCount).toBe(allDbCount);
			expect(content.totalCount).toBeGreaterThanOrEqual(3); // At least admin, config, local
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in response", async () => {
			const result = await listDatabasesTool.handler({}, mockExtra);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("databases");
			expect(content).toHaveProperty("totalCount");
			expect(Array.isArray(content.databases)).toBe(true);
			expect(typeof content.totalCount).toBe("number");
		});

		it("should have correct structure for each database object", async () => {
			await createTestDatabase("test_db_structure");

			const result = await listDatabasesTool.handler(
				{ includeSize: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const db = content.databases.find(
				(d: any) => d.name === "test_db_structure",
			);

			expect(db).toHaveProperty("name");
			expect(db).toHaveProperty("sizeOnDisk");
			expect(db).toHaveProperty("empty");
			expect(typeof db.name).toBe("string");
			expect(typeof db.sizeOnDisk).toBe("number");
			expect(typeof db.empty).toBe("boolean");
		});

		it("should return content as JSON string", async () => {
			const result = await listDatabasesTool.handler({}, mockExtra);

			expect(result.content).toBeDefined();
			expect(result.content).toHaveLength(1);

			const firstContent = result.content[0];
			expect(firstContent).toHaveProperty("type");

			if (firstContent.type === "text") {
				expect(firstContent.text).toBeDefined();
				const parsed = JSON.parse(firstContent.text);
				expect(parsed).toHaveProperty("databases");
				expect(parsed).toHaveProperty("totalCount");
			}
		});
	});

	// ============================================================
	// ERROR HANDLING CASES
	// ============================================================

	describe("Error Handling", () => {
		it("should handle connection error gracefully", async () => {
			const mockExtraInvalid = {
				requestInfo: {
					headers: {
						mongodb_url: "mongodb://invalid-host:99999",
					},
				},
			} as any;

			const result = await listDatabasesTool.handler(
				{},
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.databases).toEqual([]);
			expect(content.totalCount).toBe(0);
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await listDatabasesTool.handler({}, mockExtraNoUri);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.databases).toEqual([]);
			expect(content.totalCount).toBe(0);
		});

		it("should return empty array on error", async () => {
			const mockExtraInvalid = {
				requestInfo: {
					headers: {
						mongodb_url: "mongodb://invalid:99999",
					},
				},
			} as any;

			const result = await listDatabasesTool.handler(
				{ includeSize: true },
				mockExtraInvalid,
			);

			const content = result.structuredContent as any;
			expect(content.databases).toEqual([]);
			expect(content.totalCount).toBe(0);
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should handle database with special characters in name", async () => {
			await createTestDatabase("test-db_special_123");

			const result = await listDatabasesTool.handler({}, mockExtra);

			const content = result.structuredContent as any;
			const dbNames = content.databases.map((db: any) => db.name);
			expect(dbNames).toContain("test-db_special_123");
		});

		it("should handle many databases (20+)", async () => {
			// Create 20 test databases
			for (let i = 0; i < 20; i++) {
				await createTestDatabase(`many_db_${i}`);
			}

			const result = await listDatabasesTool.handler({}, mockExtra);

			const content = result.structuredContent as any;
			const userDbCount = content.databases.filter((db: any) =>
				db.name.startsWith("many_db_"),
			).length;

			expect(userDbCount).toBe(20);
			expect(content.totalCount).toBeGreaterThanOrEqual(20);
		});

		it("should handle database with minimal collections", async () => {
			const dbName = `minimal_db_${Date.now()}`;
			const db = mongoClient.db(dbName);

			// Create a permanent collection so database persists
			await db.createCollection("_keep");
			await db.collection("_keep").insertOne({ placeholder: true });
			createdDatabases.push(dbName);

			const result = await listDatabasesTool.handler(
				{ includeSize: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const foundDb = content.databases.find(
				(db: any) => db.name === dbName,
			);

			expect(foundDb).toBeDefined();
			if (foundDb) {
				expect(foundDb.sizeOnDisk).toBeGreaterThanOrEqual(0);
				expect(foundDb.empty).toBe(false);
			}
		});
	});

	// ============================================================
	// CONCURRENT CONNECTION TESTS
	// ============================================================

	describe("Concurrent Connections", () => {
		it("should handle multiple sequential list requests", async () => {
			for (let i = 0; i < 5; i++) {
				const result = await listDatabasesTool.handler({}, mockExtra);
				expect(result.isError).toBeFalsy();
				expect(
					(result.structuredContent as any).totalCount,
				).toBeDefined();
			}
		});

		it("should handle concurrent list requests", async () => {
			const promises = [];
			for (let i = 0; i < 5; i++) {
				promises.push(listDatabasesTool.handler({}, mockExtra));
			}

			const results = await Promise.all(promises);
			results.forEach((result) => {
				expect(result.isError).toBeFalsy();
				expect(
					(result.structuredContent as any).totalCount,
				).toBeDefined();
			});
		});
	});
});
