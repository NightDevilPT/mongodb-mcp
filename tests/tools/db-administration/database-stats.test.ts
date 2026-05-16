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
import { databaseStatsTool } from "@/lib/mcp/tools/db-administration/database-stats";

describe("database_stats tool", () => {
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
		testDbName = `test_stats_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collections with data
		const usersCollection = db.collection("users");
		await usersCollection.insertMany([
			{ name: "User1", age: 25, email: "user1@test.com" },
			{ name: "User2", age: 30, email: "user2@test.com" },
			{ name: "User3", age: 35, email: "user3@test.com" },
		]);

		const productsCollection = db.collection("products");
		await productsCollection.insertMany([
			{ name: "Product1", price: 100, category: "A" },
			{ name: "Product2", price: 200, category: "B" },
			{ name: "Product3", price: 300, category: "A" },
			{ name: "Product4", price: 400, category: "C" },
		]);

		const ordersCollection = db.collection("orders");
		await ordersCollection.insertMany([
			{ userId: "user1", amount: 50, status: "completed" },
			{ userId: "user2", amount: 75, status: "pending" },
		]);

		// Create an index on products collection
		await productsCollection.createIndex({ category: 1 });
		await productsCollection.createIndex({ price: -1 });

		mockExtra = {
			requestInfo: {
				headers: {
					mongodb_url: mongoServer.getUri(),
				},
			},
		} as any;
	});

	afterEach(async () => {
		// Clean up test database
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
		it("should return database statistics without collection details", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.message).toBe(
				`Statistics retrieved for database '${testDbName}'`,
			);
			expect(content.stats).toBeDefined();

			// Verify stats structure
			expect(content.stats).toHaveProperty("sizeOnDisk");
			expect(content.stats).toHaveProperty("collections");
			expect(content.stats).toHaveProperty("documents");
			expect(content.stats).toHaveProperty("indexes");
			expect(content.stats).toHaveProperty("storageSize");
			expect(content.stats).toHaveProperty("dataSize");
			expect(content.stats).toHaveProperty("indexSize");
			expect(content.stats).toHaveProperty("avgObjSize");
			expect(content.stats).toHaveProperty("fsTotalSize");
			expect(content.stats).toHaveProperty("fsUsedSize");
			expect(content.stats).toHaveProperty("views");

			// Verify counts
			expect(content.stats.collections).toBe(3); // users, products, orders
			expect(content.stats.documents).toBe(3 + 4 + 2); // 9 total documents
			expect(content.stats.indexes).toBeGreaterThanOrEqual(2);

			// Collection details should be an empty array (not undefined)
			expect(content.collectionDetails).toBeDefined();
			expect(content.collectionDetails).toHaveLength(0);
		});

		it("should return database statistics with collection details", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName, includeCollectionDetails: true },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;

			expect(content.collectionDetails).toBeDefined();
			expect(Array.isArray(content.collectionDetails)).toBe(true);
			expect(content.collectionDetails).toHaveLength(3);

			// Verify collection details structure
			const usersDetail = content.collectionDetails.find(
				(c: any) => c.name === "users",
			);
			expect(usersDetail).toBeDefined();
			expect(usersDetail.documentCount).toBe(3);
			expect(usersDetail).toHaveProperty("size");
			expect(usersDetail).toHaveProperty("storageSize");
			expect(usersDetail).toHaveProperty("indexCount");
			expect(usersDetail).toHaveProperty("indexSize");
			expect(usersDetail).toHaveProperty("avgObjSize");
		});

		it("should return correct document counts per collection", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName, includeCollectionDetails: true },
				mockExtra,
			);

			const content = result.structuredContent as any;

			const usersDetail = content.collectionDetails.find(
				(c: any) => c.name === "users",
			);
			const productsDetail = content.collectionDetails.find(
				(c: any) => c.name === "products",
			);
			const ordersDetail = content.collectionDetails.find(
				(c: any) => c.name === "orders",
			);

			expect(usersDetail.documentCount).toBe(3);
			expect(productsDetail.documentCount).toBe(4);
			expect(ordersDetail.documentCount).toBe(2);
		});

		it("should return error for non-existent empty database", async () => {
			const emptyDbName = `empty_stats_db_${Date.now()}`;
			// Database doesn't exist (no collections created)

			const result = await databaseStatsTool.handler(
				{ database: emptyDbName },
				mockExtra,
			);

			// Should return error because database doesn't exist
			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_NOT_FOUND");
		});

		it("should format bytes correctly", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const content = result.structuredContent as any;

			// Verify size formats (should be like "1.23 KB", "45.67 MB", etc.)
			expect(content.stats.sizeOnDisk).toMatch(
				/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/,
			);
			expect(content.stats.storageSize).toMatch(
				/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/,
			);
			expect(content.stats.dataSize).toMatch(
				/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/,
			);
		});
	});

	// ============================================================
	// DATABASE VALIDATION TESTS
	// ============================================================

	describe("Database Validation", () => {
		it("should return error for empty database name", async () => {
			const result = await databaseStatsTool.handler(
				{ database: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_STATS_FAILED");
			expect(content.message).toContain("Database name cannot be empty");
		});

		it("should return error for whitespace database name", async () => {
			const result = await databaseStatsTool.handler(
				{ database: "   " },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_STATS_FAILED");
		});

		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await databaseStatsTool.handler(
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
	// INDEX STATISTICS TESTS
	// ============================================================

	describe("Index Statistics", () => {
		it("should correctly count indexes", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content.stats.indexes).toBeGreaterThanOrEqual(2);
		});

		it("should include index size in collection details", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName, includeCollectionDetails: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const productsDetail = content.collectionDetails.find(
				(c: any) => c.name === "products",
			);

			expect(productsDetail.indexCount).toBeGreaterThanOrEqual(2);
			expect(productsDetail.indexSize).toMatch(
				/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/,
			);
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("message");
			expect(content).toHaveProperty("stats");
		});

		it("should have all stats sub-fields", async () => {
			const result = await databaseStatsTool.handler(
				{ database: testDbName },
				mockExtra,
			);

			const stats = (result.structuredContent as any).stats;
			expect(stats).toHaveProperty("sizeOnDisk");
			expect(stats).toHaveProperty("collections");
			expect(stats).toHaveProperty("documents");
			expect(stats).toHaveProperty("indexes");
			expect(stats).toHaveProperty("storageSize");
			expect(stats).toHaveProperty("dataSize");
			expect(stats).toHaveProperty("indexSize");
			expect(stats).toHaveProperty("avgObjSize");
			expect(stats).toHaveProperty("fsTotalSize");
			expect(stats).toHaveProperty("fsUsedSize");
			expect(stats).toHaveProperty("views");
		});

		it("should return content as JSON string", async () => {
			const result = await databaseStatsTool.handler(
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
				expect(parsed.stats).toBeDefined();
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

			const result = await databaseStatsTool.handler(
				{ database: "test_db" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_STATS_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await databaseStatsTool.handler(
				{ database: "test_db" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_STATS_FAILED");
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should handle database with many collections (10+)", async () => {
			const manyCollectionsDb = mongoClient.db(
				`many_collections_${Date.now()}`,
			);

			// Create 10 collections
			for (let i = 0; i < 10; i++) {
				const collection = manyCollectionsDb.collection(
					`collection_${i}`,
				);
				await collection.insertOne({ id: i, data: `data_${i}` });
			}

			const result = await databaseStatsTool.handler(
				{ database: manyCollectionsDb.databaseName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.stats.collections).toBe(10);
			expect(content.stats.documents).toBe(10);

			await manyCollectionsDb.dropDatabase();
		});

		it("should handle database with nested objects", async () => {
			const nestedDb = mongoClient.db(`nested_db_${Date.now()}`);
			const collection = nestedDb.collection("nested_data");

			await collection.insertOne({
				name: "test",
				address: {
					street: "123 Main St",
					city: "Test City",
					coordinates: {
						lat: 123.45,
						lng: 67.89,
					},
				},
				tags: ["tag1", "tag2", "tag3"],
			});

			const result = await databaseStatsTool.handler(
				{ database: nestedDb.databaseName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.stats.documents).toBe(1);

			await nestedDb.dropDatabase();
		});

		it("should handle database name with special characters", async () => {
			const specialDbName = `test-stats_db_123_${Date.now()}`;
			const specialDb = mongoClient.db(specialDbName);
			await specialDb.createCollection("test");
			await specialDb.collection("test").insertOne({ test: true });

			const result = await databaseStatsTool.handler(
				{ database: specialDbName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.database).toBe(specialDbName);

			await specialDb.dropDatabase();
		});
	});

	// ============================================================
	// CONCURRENT REQUESTS TESTS
	// ============================================================

	describe("Concurrent Requests", () => {
		it("should handle multiple sequential stats requests", async () => {
			for (let i = 0; i < 5; i++) {
				const result = await databaseStatsTool.handler(
					{ database: testDbName },
					mockExtra,
				);
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).stats.documents).toBe(
					9,
				);
			}
		});

		it("should handle concurrent stats requests", async () => {
			const promises = [];
			for (let i = 0; i < 5; i++) {
				promises.push(
					databaseStatsTool.handler(
						{ database: testDbName },
						mockExtra,
					),
				);
			}

			const results = await Promise.all(promises);
			results.forEach((result) => {
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).stats.documents).toBe(
					9,
				);
			});
		});
	});
});
