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
import { collectionStatsTool } from "@/lib/mcp/tools/db-administration/collection-stats";

describe("collection_stats tool", () => {
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
		testDbName = `test_stats_coll_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create collection with schema validation
		await db.createCollection("users", {
			validator: {
				$jsonSchema: {
					bsonType: "object",
					required: ["name", "email"],
					properties: {
						name: { bsonType: "string", description: "User name" },
						email: {
							bsonType: "string",
							description: "User email",
						},
						age: { bsonType: "number", minimum: 0, maximum: 150 },
						isActive: { bsonType: "bool" },
					},
				},
			},
		});

		// Insert documents
		await db.collection("users").insertMany([
			{ name: "User1", email: "user1@test.com", age: 25, isActive: true },
			{ name: "User2", email: "user2@test.com", age: 30, isActive: true },
			{
				name: "User3",
				email: "user3@test.com",
				age: 35,
				isActive: false,
			},
		]);

		// Create indexes
		await db
			.collection("users")
			.createIndex({ email: 1 }, { unique: true });
		await db.collection("users").createIndex({ age: -1 });

		// Create another collection without schema
		await db.createCollection("products");
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

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should return collection statistics successfully", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe("users");
			expect(content.message).toBe(
				`Stats retrieved for collection 'users'`,
			);

			// Verify stats
			expect(content.stats).toHaveProperty("documentCount");
			expect(content.stats).toHaveProperty("totalSize");
			expect(content.stats).toHaveProperty("avgDocumentSize");
			expect(content.stats).toHaveProperty("storageSize");
			expect(content.stats).toHaveProperty("totalIndexSize");

			expect(content.stats.documentCount).toBe(3);
			expect(content.stats.totalSize).toMatch(/^\d+(\.\d+)? (B|KB)$/);
			expect(content.stats.avgDocumentSize).toMatch(
				/^\d+(\.\d+)? (B|KB)$/,
			);
		});

		it("should return indexes information", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content.indexes).toBeDefined();
			expect(Array.isArray(content.indexes)).toBe(true);
			expect(content.indexes.length).toBeGreaterThanOrEqual(2); // _id index + email index + age index

			// Check index structure
			const emailIndex = content.indexes.find(
				(idx: any) => idx.name === "email_1",
			);
			expect(emailIndex).toBeDefined();
			expect(emailIndex.unique).toBe(true);
			expect(emailIndex.key).toHaveProperty("email");
		});

		it("should return fields from schema validator", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content.fields).toBeDefined();
			expect(Array.isArray(content.fields)).toBe(true);
			expect(content.fields.length).toBeGreaterThan(0);

			// Check field structure
			const nameField = content.fields.find(
				(f: any) => f.name === "name",
			);
			expect(nameField).toBeDefined();
			expect(nameField.type).toBe("string");
			expect(nameField.required).toBe(true);

			const ageField = content.fields.find((f: any) => f.name === "age");
			expect(ageField).toBeDefined();
			expect(ageField.type).toBe("number");
		});

		it("should return empty fields array for collection without schema", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "products" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
		});

		it("should return correct document count for empty collection", async () => {
			const emptyDb = mongoClient.db(`empty_${Date.now()}`);
			await emptyDb.createCollection("empty_collection");

			const result = await collectionStatsTool.handler(
				{
					database: emptyDb.databaseName,
					collection: "empty_collection",
				},
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.stats.documentCount).toBe(0);
			expect(content.stats.totalSize).toBe("0 B");

			await emptyDb.dropDatabase();
		});
	});

	// ============================================================
	// DATABASE VALIDATION TESTS
	// ============================================================

	describe("Database Validation", () => {
		it("should reject empty database name", async () => {
			const result = await collectionStatsTool.handler(
				{ database: "", collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("STATS_FAILED");
			expect(content.message).toContain("Database name cannot be empty");
		});

		it("should reject whitespace-only database name", async () => {
			const result = await collectionStatsTool.handler(
				{ database: "   ", collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("STATS_FAILED");
		});

		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await collectionStatsTool.handler(
				{ database: nonExistentDb, collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("DATABASE_NOT_FOUND");
			expect(content.message).toContain(nonExistentDb);
		});
	});

	// ============================================================
	// COLLECTION VALIDATION TESTS
	// ============================================================

	describe("Collection Validation", () => {
		it("should reject empty collection name", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("STATS_FAILED");
			expect(content.message).toContain(
				"Collection name cannot be empty",
			);
		});

		it("should return error for non-existent collection", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "non_existent_collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("COLLECTION_NOT_FOUND");
			expect(content.message).toContain("does not exist");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("message");
			expect(content).toHaveProperty("stats");
			expect(content).toHaveProperty("indexes");
			expect(content).toHaveProperty("fields");
		});

		it("should have all stats sub-fields", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const stats = (result.structuredContent as any).stats;
			expect(stats).toHaveProperty("documentCount");
			expect(stats).toHaveProperty("totalSize");
			expect(stats).toHaveProperty("avgDocumentSize");
			expect(stats).toHaveProperty("storageSize");
			expect(stats).toHaveProperty("totalIndexSize");
		});

		it("should return content as JSON string", async () => {
			const result = await collectionStatsTool.handler(
				{ database: testDbName, collection: "users" },
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

			const result = await collectionStatsTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("STATS_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await collectionStatsTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.message).toContain("STATS_FAILED");
		});
	});
});
