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
import { listCollectionsTool } from "@/lib/mcp/tools/db-administration/list-collections";

describe("list_collections tool", () => {
	let mongoServer: MongoMemoryServer;
	let mongoClient: MongoClient;
	let mockExtra: any;
	let testDbName: string;

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
		await mongoClient.close();
		await mongoServer.stop();
	});

	beforeEach(async () => {
		testDbName = `test_list_coll_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collections
		await db.createCollection("users");
		await db.createCollection("products");
		await db.createCollection("orders");
		await db.createCollection("reviews");

		// Insert some data for stats
		await db.collection("users").insertMany([
			{ name: "User1", age: 25 },
			{ name: "User2", age: 30 },
		]);
		await db.collection("products").insertMany([
			{ name: "Product1", price: 100 },
			{ name: "Product2", price: 200 },
			{ name: "Product3", price: 300 },
		]);

		// Create an index for stats testing
		await db.collection("products").createIndex({ price: 1 });
	});

	afterEach(async () => {
		try {
			await mongoClient.db(testDbName).dropDatabase();
		} catch (e) {
			// Ignore errors
		}
	});

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should list all collections without stats", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collections).toHaveLength(4);
			expect(content.totalCount).toBe(4);
			expect(content.message).toBe(
				`Found 4 collection(s) in database '${testDbName}'`,
			);

			// Verify collection names
			const collectionNames = content.collections.map((c: any) => c.name);
			expect(collectionNames).toContain("users");
			expect(collectionNames).toContain("products");
			expect(collectionNames).toContain("orders");
			expect(collectionNames).toContain("reviews");

			// Without stats, documentCount should be 0
			const usersCollection = content.collections.find(
				(c: any) => c.name === "users",
			);
			expect(usersCollection.documentCount).toBe(0);
			expect(usersCollection.size).toBe("0 B");
			expect(usersCollection.indexCount).toBe(0);
		});

		it("should list collections with stats when includeStats is true", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName, includeStats: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			const usersCollection = content.collections.find(
				(c: any) => c.name === "users",
			);
			expect(usersCollection.documentCount).toBe(2);
			expect(usersCollection.size).toMatch(/^\d+(\.\d+)? (B|KB)$/);

			const productsCollection = content.collections.find(
				(c: any) => c.name === "products",
			);
			expect(productsCollection.documentCount).toBe(3);
			expect(productsCollection.indexCount).toBeGreaterThanOrEqual(1);
		});

		it("should filter collections by name pattern", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName, namePattern: "prod" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.collections).toHaveLength(1);
			expect(content.collections[0].name).toBe("products");
			expect(content.totalCount).toBe(1);
		});

		it("should return empty array when pattern matches no collections", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName, namePattern: "nonexistent" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.collections).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe(
				`Found 0 collection(s) in database '${testDbName}'`,
			);
		});

		it("should handle empty database with no collections", async () => {
			// Skipped because MongoDB doesn't keep empty databases
			const emptyDbName = `empty_db_${Date.now()}`;
			const emptyDb = mongoClient.db(emptyDbName);
			await emptyDb.createCollection("_temp");
			await emptyDb.dropCollection("_temp");

			const result = await listCollectionsTool.handler(
				{ database: emptyDbName },
				mockExtra,
			);

			// This will fail because database doesn't exist
			expect(result.isError).toBe(true);

			await emptyDb.dropDatabase();
		});
	});

	// ============================================================
	// DATABASE VALIDATION TESTS
	// ============================================================

	describe("Database Validation", () => {
		it("should reject empty database name", async () => {
			const result = await listCollectionsTool.handler(
				{ database: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.database).toBe("");
			expect(content.collections).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("LIST_COLLECTIONS_FAILED");
		});

		it("should reject whitespace-only database name", async () => {
			const result = await listCollectionsTool.handler(
				{ database: "   " },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("LIST_COLLECTIONS_FAILED");
		});

		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await listCollectionsTool.handler(
				{ database: nonExistentDb },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_NOT_FOUND");
			expect(content.message).toContain(nonExistentDb);
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collections");
			expect(content).toHaveProperty("totalCount");
			expect(content).toHaveProperty("message");
			expect(Array.isArray(content.collections)).toBe(true);
		});

		it("should have correct structure for each collection object", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const collection = content.collections[0];

			expect(collection).toHaveProperty("name");
			expect(collection).toHaveProperty("type");
			expect(collection).toHaveProperty("documentCount");
			expect(collection).toHaveProperty("size");
			expect(collection).toHaveProperty("indexCount");
			expect(typeof collection.name).toBe("string");
			expect(typeof collection.type).toBe("string");
			expect(typeof collection.documentCount).toBe("number");
			expect(typeof collection.size).toBe("string");
			expect(typeof collection.indexCount).toBe("number");
		});

		it("should return content as JSON string", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			expect(result.content).toBeDefined();
			expect(result.content).toHaveLength(1);

			const firstContent = result.content[0];
			expect(firstContent).toHaveProperty("type");

			if (firstContent.type === "text") {
				expect(firstContent.text).toBeDefined();
				const parsed = JSON.parse(firstContent.text);
				expect(parsed.database).toBe(testDbName);
				expect(parsed.collections).toBeDefined();
				expect(parsed.totalCount).toBeDefined();
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

			const result = await listCollectionsTool.handler(
				{ database: "test_db" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.collections).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("LIST_COLLECTIONS_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await listCollectionsTool.handler(
				{ database: "test_db" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.collections).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("LIST_COLLECTIONS_FAILED");
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should handle collection names with special characters", async () => {
			const specialDb = mongoClient.db(`special_${Date.now()}`);
			await specialDb.createCollection("user-data");
			await specialDb.createCollection("order_items");
			await specialDb.createCollection("@special");

			const result = await listCollectionsTool.handler(
				{ database: specialDb.databaseName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			const collectionNames = content.collections.map((c: any) => c.name);
			expect(collectionNames).toContain("user-data");
			expect(collectionNames).toContain("order_items");
			expect(collectionNames).toContain("@special");

			await specialDb.dropDatabase();
		});

		it("should handle case-sensitive pattern matching", async () => {
			const result = await listCollectionsTool.handler(
				{ database: testDbName, namePattern: "Users" }, // uppercase U
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			// Should not match because case-sensitive
			expect(content.collections).toHaveLength(0);
		});
	});
});
