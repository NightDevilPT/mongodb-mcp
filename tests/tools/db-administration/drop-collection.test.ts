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
import { dropCollectionTool } from "@/lib/mcp/tools/db-administration/drop-collection";

describe("drop_collection tool", () => {
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
		testDbName = `test_drop_coll_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collections
		await db.createCollection("users");
		await db.createCollection("products");
		await db.createCollection("orders");

		// Insert some data
		await db.collection("users").insertMany([
			{ name: "User1", age: 25 },
			{ name: "User2", age: 30 },
		]);
		await db.collection("products").insertMany([
			{ name: "Product1", price: 100 },
			{ name: "Product2", price: 200 },
		]);
	});

	afterEach(async () => {
		try {
			await mongoClient.db(testDbName).dropDatabase();
		} catch (e) {
			// Ignore errors
		}
	});

	// Helper function to check if collection exists
	async function collectionExists(
		dbName: string,
		collectionName: string,
	): Promise<boolean> {
		const db = mongoClient.db(dbName);
		const collections = await db.listCollections().toArray();
		return collections.some((c) => c.name === collectionName);
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should drop an existing collection with confirmation", async () => {
			const collectionName = "users";

			// Verify collection exists
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);

			const result = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: collectionName,
					confirm: true,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe(collectionName);
			expect(content.dropped).toBe(true);
			expect(content.message).toBe(
				`Collection '${collectionName}' dropped successfully from database '${testDbName}'`,
			);

			// Verify collection no longer exists
			expect(await collectionExists(testDbName, collectionName)).toBe(
				false,
			);
		});

		it("should drop multiple collections sequentially", async () => {
			const collectionsToDrop = ["users", "products"];

			for (const collectionName of collectionsToDrop) {
				const result = await dropCollectionTool.handler(
					{
						database: testDbName,
						collection: collectionName,
						confirm: true,
					},
					mockExtra,
				);
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).dropped).toBe(true);
				expect(await collectionExists(testDbName, collectionName)).toBe(
					false,
				);
			}

			// Verify remaining collection still exists
			expect(await collectionExists(testDbName, "orders")).toBe(true);
		});

		it("should drop collection with special characters in name", async () => {
			const specialDb = mongoClient.db(`special_${Date.now()}`);
			const collectionName = "user-data";
			await specialDb.createCollection(collectionName);

			const result = await dropCollectionTool.handler(
				{
					database: specialDb.databaseName,
					collection: collectionName,
					confirm: true,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(true);

			await specialDb.dropDatabase();
		});
	});

	// ============================================================
	// CONFIRMATION VALIDATION TESTS
	// ============================================================

	describe("Confirmation Validation", () => {
		it("should reject dropping collection when confirm is false", async () => {
			const collectionName = "users";

			const result = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: collectionName,
					confirm: false,
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("CONFIRMATION_FAILED");
			expect(content.message).toContain(
				"Confirmation toggle must be checked",
			);

			// Verify collection still exists
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should reject dropping collection when confirm is not provided", async () => {
			const result = await dropCollectionTool.handler(
				{ database: testDbName, collection: "users" } as any,
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
		});
	});

	// ============================================================
	// SYSTEM COLLECTION PROTECTION TESTS
	// ============================================================

	describe("System Collection Protection", () => {
		it("should reject dropping system collection", async () => {
			const result = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: "system.users",
					confirm: true,
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(
				`SYSTEM_COLLECTION_PROTECTED: Cannot drop system collection 'system.users'`,
			);
		});
	});

	// ============================================================
	// DATABASE VALIDATION TESTS
	// ============================================================

	describe("Database Validation", () => {
		it("should reject empty database name", async () => {
			const result = await dropCollectionTool.handler(
				{ database: "", collection: "users", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_COLLECTION_FAILED");
			expect(content.message).toContain("Database name cannot be empty");
		});

		it("should reject whitespace-only database name", async () => {
			const result = await dropCollectionTool.handler(
				{ database: "   ", collection: "users", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_COLLECTION_FAILED");
		});

		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await dropCollectionTool.handler(
				{ database: nonExistentDb, collection: "users", confirm: true },
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
	// COLLECTION VALIDATION TESTS
	// ============================================================

	describe("Collection Validation", () => {
		it("should reject empty collection name", async () => {
			const result = await dropCollectionTool.handler(
				{ database: testDbName, collection: "", confirm: true },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("COLLECTION_NOT_FOUND");
			expect(content.message).toContain(
				"Collection name cannot be empty",
			);
		});

		it("should return error for non-existent collection", async () => {
			const result = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: "non_existent_collection",
					confirm: true,
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("COLLECTION_NOT_FOUND");
			expect(content.message).toContain("does not exist");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await dropCollectionTool.handler(
				{ database: testDbName, collection: "orders", confirm: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await dropCollectionTool.handler(
				{ database: "", collection: "test", confirm: true },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const result = await dropCollectionTool.handler(
				{ database: testDbName, collection: "orders", confirm: true },
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
				expect(parsed.collection).toBe("orders");
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

			const result = await dropCollectionTool.handler(
				{
					database: "test_db",
					collection: "test_collection",
					confirm: true,
				},
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_COLLECTION_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await dropCollectionTool.handler(
				{
					database: "test_db",
					collection: "test_collection",
					confirm: true,
				},
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("DROP_COLLECTION_FAILED");
		});
	});

	// ============================================================
	// IDEMPOTENCY TESTS
	// ============================================================

	describe("Idempotency", () => {
		it("should return error when dropping already dropped collection", async () => {
			const collectionName = "orders";

			// First drop - should succeed
			const firstResult = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: collectionName,
					confirm: true,
				},
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second drop - should fail (collection doesn't exist)
			const secondResult = await dropCollectionTool.handler(
				{
					database: testDbName,
					collection: collectionName,
					confirm: true,
				},
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("COLLECTION_NOT_FOUND");
		});
	});
});
