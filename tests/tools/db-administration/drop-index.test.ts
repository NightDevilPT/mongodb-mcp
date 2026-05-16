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
import { dropIndexTool } from "@/lib/mcp/tools/db-administration/drop-index";
import { addIndexTool } from "@/lib/mcp/tools/db-administration/add-index";

describe("drop_index tool", () => {
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
		testDbName = `test_drop_index_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collection
		await db.createCollection("users");

		// Insert some data
		await db.collection("users").insertMany([
			{ name: "User1", email: "user1@test.com", age: 25 },
			{ name: "User2", email: "user2@test.com", age: 30 },
			{ name: "User3", email: "user3@test.com", age: 35 },
		]);

		// Create indexes using addIndexTool
		await addIndexTool.handler(
			{
				database: testDbName,
				collection: "users",
				field: "email",
				unique: true,
			},
			mockExtra,
		);
		await addIndexTool.handler(
			{ database: testDbName, collection: "users", field: "age" },
			mockExtra,
		);
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
		fieldName: string,
	): Promise<boolean> {
		const db = mongoClient.db(dbName);
		const indexes = await db
			.collection(collectionName)
			.listIndexes()
			.toArray();
		return indexes.some((idx: any) => {
			const keys = Object.keys(idx.key);
			return keys.length === 1 && keys[0] === fieldName;
		});
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should drop an existing index by field name", async () => {
			// Verify index exists
			expect(await indexExists(testDbName, "users", "email")).toBe(true);

			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe("users");
			expect(content.field).toBe("email");
			expect(content.dropped).toBe(true);
			expect(content.message).toContain(
				`Index 'email_1' dropped from 'users.email'`,
			);

			// Verify index no longer exists
			expect(await indexExists(testDbName, "users", "email")).toBe(false);
		});

		it("should drop multiple indexes sequentially", async () => {
			// Drop email index
			const result1 = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);
			expect(result1.isError).toBeFalsy();
			expect((result1.structuredContent as any).dropped).toBe(true);

			// Drop age index
			const result2 = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "age" },
				mockExtra,
			);
			expect(result2.isError).toBeFalsy();
			expect((result2.structuredContent as any).dropped).toBe(true);

			// Verify both indexes are gone
			expect(await indexExists(testDbName, "users", "email")).toBe(false);
			expect(await indexExists(testDbName, "users", "age")).toBe(false);
		});
	});

	// ============================================================
	// VALIDATION TESTS
	// ============================================================

	describe("Validation Tests", () => {
		it("should reject empty database name", async () => {
			const result = await dropIndexTool.handler(
				{ database: "", collection: "users", field: "email" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe("Database name required");
		});

		it("should reject empty collection name", async () => {
			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "", field: "email" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe("Collection name required");
		});

		it("should reject empty field name", async () => {
			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe("Field name required");
		});

		it("should reject dropping _id index", async () => {
			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "_id" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe("Cannot drop _id index");
		});
	});

	// ============================================================
	// NON-EXISTENT INDEX TESTS
	// ============================================================

	describe("Non-existent Index", () => {
		it("should return error when trying to drop non-existent index", async () => {
			const result = await dropIndexTool.handler(
				{
					database: testDbName,
					collection: "users",
					field: "non_existent_field",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(
				`No index found on 'users.non_existent_field'`,
			);
		});
	});

	// ============================================================
	// DATABASE AND COLLECTION EXISTENCE TESTS
	// ============================================================

	describe("Database and Collection Existence", () => {
		it("should return error for non-existent collection", async () => {
			const result = await dropIndexTool.handler(
				{
					database: testDbName,
					collection: "non_existent",
					field: "email",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe("Collection 'non_existent' not found");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("field");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await dropIndexTool.handler(
				{ database: "", collection: "users", field: "email" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("field");
			expect(content).toHaveProperty("dropped");
			expect(content).toHaveProperty("message");
			expect(content.dropped).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const result = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
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
				expect(parsed.field).toBe("email");
				expect(parsed.dropped).toBe(true);
			}
		});
	});

	// ============================================================
	// IDEMPOTENCY TESTS
	// ============================================================

	describe("Idempotency", () => {
		it("should return error when dropping already dropped index", async () => {
			// First drop - should succeed
			const firstResult = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second drop - should fail (index doesn't exist)
			const secondResult = await dropIndexTool.handler(
				{ database: testDbName, collection: "users", field: "email" },
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toBe(`No index found on 'users.email'`);
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

			const result = await dropIndexTool.handler(
				{ database: "test_db", collection: "users", field: "email" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("Failed:");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await dropIndexTool.handler(
				{ database: "test_db", collection: "users", field: "email" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.dropped).toBe(false);
			expect(content.message).toContain("Failed:");
		});
	});
});
