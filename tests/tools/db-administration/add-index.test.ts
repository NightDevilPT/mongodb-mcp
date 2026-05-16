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
import { addIndexTool } from "@/lib/mcp/tools/db-administration/add-index";

describe("add_index tool", () => {
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
		testDbName = `test_index_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collection
		await db.createCollection("users");

		// Insert some data
		await db.collection("users").insertMany([
			{
				name: "User1",
				email: "user1@test.com",
				age: 25,
				createdAt: new Date(),
			},
			{
				name: "User2",
				email: "user2@test.com",
				age: 30,
				createdAt: new Date(),
			},
			{
				name: "User3",
				email: "user3@test.com",
				age: 35,
				createdAt: new Date(),
			},
		]);
	});

	afterEach(async () => {
		try {
			await mongoClient.db(testDbName).dropDatabase();
		} catch (e) {
			// Ignore errors
		}
	});

	// Helper function to check if index exists
	async function indexExists(
		dbName: string,
		collectionName: string,
		indexName: string,
	): Promise<boolean> {
		const db = mongoClient.db(dbName);
		const indexes = await db
			.collection(collectionName)
			.listIndexes()
			.toArray();
		return indexes.some((idx: any) => idx.name === indexName);
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should create a basic ascending index", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe("users");
			expect(content.field).toBe("age");
			expect(content.added).toBe(true);
			expect(content.message).toBe("Index created on 'users.age'");

			// Verify index was created
			expect(await indexExists(testDbName, "users", "age_1")).toBe(true);
		});

		it("should create a unique index", async () => {
			const result = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "email",
					unique: true,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.added).toBe(true);
			expect(content.message).toContain("unique");
			expect(await indexExists(testDbName, "users", "email_1")).toBe(
				true,
			);
		});

		it("should create a sparse index", async () => {
			const result = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "optionalField",
					sparse: true,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.added).toBe(true);
			expect(content.message).toContain("sparse");
		});

		it("should create a text search index", async () => {
			const result = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "name",
					textSearch: true,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.added).toBe(true);
			expect(content.message).toContain("text search");
		});

		it("should create a TTL index on date field", async () => {
			const result = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "createdAt",
					ttlSeconds: 3600,
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.added).toBe(true);
			expect(content.message).toContain("TTL 3600s");
		});

		it("should create multiple indexes on different fields", async () => {
			const result1 = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "name" },
				mockExtra,
			);
			const result2 = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "email",
					unique: true,
				},
				mockExtra,
			);

			expect(result1.isError).toBeFalsy();
			expect(result2.isError).toBeFalsy();
			expect(await indexExists(testDbName, "users", "name_1")).toBe(true);
			expect(await indexExists(testDbName, "users", "email_1")).toBe(
				true,
			);
		});
	});

	// ============================================================
	// VALIDATION TESTS
	// ============================================================

	describe("Validation Tests", () => {
		it("should reject empty database name", async () => {
			const result = await addIndexTool.handler(
				{ database: "", collection: "users", field: "age" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toBe("Database name required");
		});

		it("should reject empty collection name", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "", field: "age" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toBe("Collection name required");
		});

		it("should reject empty field name", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toBe("Field name required");
		});

		it("should reject creating index on _id field", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "_id" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toBe("_id already has index by default");
		});
	});

	// ============================================================
	// DATABASE AND COLLECTION EXISTENCE TESTS
	// ============================================================

	describe("Database and Collection Existence", () => {
		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await addIndexTool.handler(
				{ database: nonExistentDb, collection: "users", field: "age" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			// Tool checks collection existence first
			expect(content.message).toBe("Collection 'users' not found");
		});

		it("should return error for non-existent collection", async () => {
			const result = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "non_existent",
					field: "age",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toBe("Collection 'non_existent' not found");
		});
	});

	// ============================================================
	// DUPLICATE INDEX TESTS
	// ============================================================

	describe("Duplicate Index", () => {
		it("should reject creating index that already exists", async () => {
			// First creation - should succeed
			const firstResult = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second creation - should fail
			const secondResult = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toContain("already exists");
		});

		it("should not allow creating different index on same field", async () => {
			// First create basic index
			const firstResult = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Try to create unique index on same field - should fail
			const secondResult = await addIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "email",
					unique: true,
				},
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.added).toBe(false);
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("field");
			expect(content).toHaveProperty("added");
			expect(content).toHaveProperty("message");
			expect(content.added).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await addIndexTool.handler(
				{ database: "", collection: "users", field: "age" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection"); // Fixed: was 'tohaveProperty'
			expect(content).toHaveProperty("field");
			expect(content).toHaveProperty("added");
			expect(content).toHaveProperty("message");
			expect(content.added).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const result = await addIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
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
				expect(parsed.collection).toBe("users");
				expect(parsed.field).toBe("age");
				expect(parsed.added).toBe(true);
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

			const result = await addIndexTool.handler(
				{ database: "test_db", collection: "users", field: "age" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toContain("Failed:");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await addIndexTool.handler(
				{ database: "test_db", collection: "users", field: "age" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.added).toBe(false);
			expect(content.message).toContain("Failed:");
		});
	});
});
