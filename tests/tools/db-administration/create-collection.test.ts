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
import { createCollectionTool } from "@/lib/mcp/tools/db-administration/create-collection";

describe("create_collection tool", () => {
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
		testDbName = `test_create_coll_db_${Date.now()}`;
		// Create database by creating a permanent collection
		const db = mongoClient.db(testDbName);
		await db.createCollection("_keep");
	});

	afterEach(async () => {
		// Clean up test database
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
		it("should create a new collection successfully", async () => {
			const collectionName = "test_collection";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe(collectionName);
			expect(content.created).toBe(true);
			expect(content.message).toBe(
				`Collection '${collectionName}' created successfully in database '${testDbName}'`,
			);

			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should create multiple collections in the same database", async () => {
			const collectionNames = ["users", "products", "orders"];

			for (const collectionName of collectionNames) {
				const result = await createCollectionTool.handler(
					{ database: testDbName, collection: collectionName },
					mockExtra,
				);
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).created).toBe(true);
			}

			for (const collectionName of collectionNames) {
				expect(await collectionExists(testDbName, collectionName)).toBe(
					true,
				);
			}
		});

		it("should create collection with name containing underscores", async () => {
			const collectionName = "user_profiles_data";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should create collection with name containing numbers", async () => {
			const collectionName = "data_2024_01";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should create collection with max valid length (63 chars)", async () => {
			const maxLengthName = "a".repeat(63);

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: maxLengthName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, maxLengthName)).toBe(
				true,
			);
		});
	});

	// ============================================================
	// DATABASE VALIDATION TESTS
	// ============================================================

	describe("Database Validation", () => {
		it("should reject empty database name", async () => {
			const result = await createCollectionTool.handler(
				{ database: "", collection: "test_collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("INVALID_DATABASE_NAME");
		});

		it("should reject whitespace-only database name", async () => {
			const result = await createCollectionTool.handler(
				{ database: "   ", collection: "test_collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("INVALID_DATABASE_NAME");
		});

		it("should reject non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await createCollectionTool.handler(
				{ database: nonExistentDb, collection: "test_collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("DATABASE_NOT_FOUND");
		});
	});

	// ============================================================
	// COLLECTION NAME VALIDATION TESTS
	// ============================================================

	describe("Collection Name Validation", () => {
		it("should reject empty collection name", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("INVALID_COLLECTION_NAME");
		});

		it("should reject collection name with spaces", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "test collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, and underscores allowed",
			);
		});

		it("should reject collection name with hyphens", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "test-collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, and underscores allowed",
			);
		});

		it("should reject collection name with special characters", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "test@collection!" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, and underscores allowed",
			);
		});

		it("should reject collection name exceeding max length (256 chars)", async () => {
			const tooLongName = "a".repeat(256);

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: tooLongName },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("Max 255 characters allowed");
		});

		it("should reject collection name starting with system prefix", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "system.users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			// The validation checks regex first, so it fails with invalid characters
			expect(content.message).toContain(
				"Only letters, numbers, and underscores allowed",
			);
		});
	});

	// ============================================================
	// DUPLICATE COLLECTION TESTS
	// ============================================================

	describe("Duplicate Collection", () => {
		it("should reject creating collection that already exists", async () => {
			const collectionName = "duplicate_collection";

			// First creation - should succeed
			const firstResult = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);
			expect(firstResult.isError).toBeFalsy();

			// Second creation - should fail
			const secondResult = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(secondResult.isError).toBe(true);
			const content = secondResult.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toBe(
				`COLLECTION_EXISTS: Collection '${collectionName}' already exists`,
			);
		});

		it("should allow same collection name in different databases", async () => {
			const dbName2 = `test_db_2_${Date.now()}`;
			// Create second database with a permanent collection
			const db2 = mongoClient.db(dbName2);
			await db2.createCollection("_keep");

			const collectionName = "same_name_collection";

			// Create in first database
			const result1 = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);
			expect(result1.isError).toBeFalsy();

			// Create in second database
			const result2 = await createCollectionTool.handler(
				{ database: dbName2, collection: collectionName },
				mockExtra,
			);
			expect(result2.isError).toBeFalsy();

			// Verify both collections exist
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
			expect(await collectionExists(dbName2, collectionName)).toBe(true);

			await db2.dropDatabase();
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const collectionName = "response_test";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("created");
			expect(content).toHaveProperty("message");
			expect(content.created).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await createCollectionTool.handler(
				{ database: "", collection: "test" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("created");
			expect(content).toHaveProperty("message");
			expect(content.created).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const collectionName = "json_test";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
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
				expect(parsed.collection).toBe(collectionName);
				expect(parsed.created).toBe(true);
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

			const result = await createCollectionTool.handler(
				{ database: "test_db", collection: "test_collection" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("CREATE_COLLECTION_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await createCollectionTool.handler(
				{ database: "test_db", collection: "test_collection" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain("CREATE_COLLECTION_FAILED");
		});
	});

	// ============================================================
	// EDGE CASES
	// ============================================================

	describe("Edge Cases", () => {
		it("should create collection with name containing only underscores", async () => {
			const collectionName = "_____";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should create collection with name containing mixed case", async () => {
			const collectionName = "TestCollectionMiXeDCase";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should create collection with numeric name", async () => {
			const collectionName = "12345";

			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: collectionName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.created).toBe(true);
			expect(await collectionExists(testDbName, collectionName)).toBe(
				true,
			);
		});

		it("should reject collection name with dots", async () => {
			const result = await createCollectionTool.handler(
				{ database: testDbName, collection: "test.collection" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.created).toBe(false);
			expect(content.message).toContain(
				"Only letters, numbers, and underscores allowed",
			);
		});
	});

	// ============================================================
	// CONCURRENT OPERATION TESTS
	// ============================================================

	describe("Concurrent Operations", () => {
		it("should handle multiple sequential collection creations", async () => {
			for (let i = 0; i < 5; i++) {
				const collectionName = `seq_collection_${i}`;
				const result = await createCollectionTool.handler(
					{ database: testDbName, collection: collectionName },
					mockExtra,
				);
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).created).toBe(true);
			}
		});

		it("should handle concurrent collection creation requests", async () => {
			const promises = [];
			for (let i = 0; i < 5; i++) {
				const collectionName = `concurrent_collection_${i}`;
				promises.push(
					createCollectionTool.handler(
						{ database: testDbName, collection: collectionName },
						mockExtra,
					),
				);
			}

			const results = await Promise.all(promises);
			results.forEach((result) => {
				expect(result.isError).toBeFalsy();
				expect((result.structuredContent as any).created).toBe(true);
			});
		});
	});
});
