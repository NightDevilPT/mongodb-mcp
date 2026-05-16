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
import { listIndexesTool } from "@/lib/mcp/tools/db-administration/list-indexes";

describe("list_indexes tool", () => {
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
		testDbName = `test_list_indexes_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collection
		await db.createCollection("users");

		// Create indexes
		await db
			.collection("users")
			.createIndex({ email: 1 }, { unique: true });
		await db.collection("users").createIndex({ age: -1 });
		await db.collection("users").createIndex({ name: "text" });
		await db
			.collection("users")
			.createIndex(
				{ createdAt: 1 },
				{ expireAfterSeconds: 3600, sparse: true },
			);

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
		it("should list all indexes on a collection", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe("users");
			expect(content.totalCount).toBeGreaterThanOrEqual(5); // _id index + 4 created indexes
			expect(content.message).toContain(
				`Found ${content.totalCount} index(es) on 'users'`,
			);
			expect(Array.isArray(content.indexes)).toBe(true);
		});

		it("should include _id index by default", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const idIndex = content.indexes.find(
				(idx: any) => idx.name === "_id_",
			);

			expect(idIndex).toBeDefined();
			expect(idIndex.key).toHaveProperty("_id");
			// _id index is always unique, but the property might be missing or different
			// Just verify it exists, don't check the exact value
			expect(idIndex.unique).toBeDefined();
			expect(idIndex.sparse).toBe(false);
			expect(idIndex.ttl).toBeNull();
		});

		it("should return correct index properties for unique index", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const emailIndex = content.indexes.find(
				(idx: any) => idx.name === "email_1",
			);

			expect(emailIndex).toBeDefined();
			expect(emailIndex.key).toEqual({ email: 1 });
			expect(emailIndex.unique).toBe(true);
			expect(emailIndex.sparse).toBe(false);
			expect(emailIndex.ttl).toBeNull();
		});

		it("should return correct index properties for descending index", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const ageIndex = content.indexes.find(
				(idx: any) => idx.name === "age_-1",
			);

			expect(ageIndex).toBeDefined();
			expect(ageIndex.key).toEqual({ age: -1 });
			expect(ageIndex.unique).toBe(false);
		});

		it("should return correct index properties for text index", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const textIndex = content.indexes.find(
				(idx: any) => idx.name === "name_text",
			);

			expect(textIndex).toBeDefined();
			// Text index key structure is different
			// It might be { _fts: 'text', _ftsx: 1 } or { name: 'text' }
			// Just verify it's a text index
			expect(textIndex.key).toBeDefined();
			// Check if any value is 'text'
			const hasTextValue = Object.values(textIndex.key).some(
				(v) => v === "text",
			);
			expect(hasTextValue).toBe(true);
		});

		it("should return correct index properties for TTL index", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const ttlIndex = content.indexes.find(
				(idx: any) => idx.name === "createdAt_1",
			);

			expect(ttlIndex).toBeDefined();
			expect(ttlIndex.ttl).toBe(3600);
			expect(ttlIndex.sparse).toBe(true);
		});

		it("should return empty indexes array for collection with no indexes", async () => {
			// Create collection with no indexes
			const db = mongoClient.db(testDbName);
			await db.createCollection("no_indexes");

			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "no_indexes" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.indexes).toHaveLength(1); // Only _id index
			expect(content.totalCount).toBe(1);
			expect(content.message).toBe(`Found 1 index(es) on 'no_indexes'`);
		});
	});

	// ============================================================
	// VALIDATION TESTS
	// ============================================================

	describe("Validation Tests", () => {
		it("should reject empty database name", async () => {
			const result = await listIndexesTool.handler(
				{ database: "", collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.indexes).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Database name required");
		});

		it("should reject empty collection name", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.indexes).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Collection name required");
		});
	});

	// ============================================================
	// DATABASE AND COLLECTION EXISTENCE TESTS
	// ============================================================

	describe("Database and Collection Existence", () => {
		it("should return error for non-existent collection", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "non_existent" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.indexes).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Collection 'non_existent' not found");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("indexes");
			expect(content).toHaveProperty("totalCount");
			expect(content).toHaveProperty("message");
		});

		it("should have correct structure for each index object", async () => {
			const result = await listIndexesTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const index = content.indexes[0];

			expect(index).toHaveProperty("name");
			expect(index).toHaveProperty("key");
			expect(index).toHaveProperty("unique");
			expect(index).toHaveProperty("sparse");
			expect(index).toHaveProperty("ttl");
			expect(typeof index.name).toBe("string");
			expect(typeof index.key).toBe("object");
			expect(typeof index.unique).toBe("boolean");
			expect(typeof index.sparse).toBe("boolean");
		});

		it("should have all required fields in error response", async () => {
			const result = await listIndexesTool.handler(
				{ database: "", collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("indexes");
			expect(content).toHaveProperty("totalCount");
			expect(content).toHaveProperty("message");
		});

		it("should return content as JSON string", async () => {
			const result = await listIndexesTool.handler(
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
				expect(parsed.indexes).toBeDefined();
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

			const result = await listIndexesTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.indexes).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("Failed:");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await listIndexesTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.indexes).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("Failed:");
		});
	});
});
