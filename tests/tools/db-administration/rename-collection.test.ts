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
import { renameCollectionTool } from "@/lib/mcp/tools/db-administration/rename-collection";

describe("rename_collection tool", () => {
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
		testDbName = `test_rename_coll_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create test collections
		await db.createCollection("old_users");
		await db.createCollection("products");

		// Insert data into collection to be renamed
		await db.collection("old_users").insertMany([
			{ name: "User1", age: 25 },
			{ name: "User2", age: 30 },
			{ name: "User3", age: 35 },
		]);
	});

	afterEach(async () => {
		try {
			await mongoClient.db(testDbName).dropDatabase();
		} catch (e) {
			// Ignore errors
		}
	});

	// Helper functions
	async function collectionExists(
		dbName: string,
		collectionName: string,
	): Promise<boolean> {
		const db = mongoClient.db(dbName);
		const collections = await db.listCollections().toArray();
		return collections.some((c) => c.name === collectionName);
	}

	async function getDocumentCount(
		dbName: string,
		collectionName: string,
	): Promise<number> {
		const db = mongoClient.db(dbName);
		return await db.collection(collectionName).countDocuments();
	}

	// ============================================================
	// SUCCESS CASES
	// ============================================================

	describe("Success Cases", () => {
		it("should rename collection successfully", async () => {
			const oldName = "old_users";
			const newName = "new_users";

			// Verify old collection exists
			expect(await collectionExists(testDbName, oldName)).toBe(true);
			expect(await collectionExists(testDbName, newName)).toBe(false);

			const result = await renameCollectionTool.handler(
				{ database: testDbName, oldName, newName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.oldName).toBe(oldName);
			expect(content.newName).toBe(newName);
			expect(content.renamed).toBe(true);
			expect(content.documentCount).toBe(3);

			// Verify old collection no longer exists, new collection exists
			expect(await collectionExists(testDbName, oldName)).toBe(false);
			expect(await collectionExists(testDbName, newName)).toBe(true);
			expect(await getDocumentCount(testDbName, newName)).toBe(3);
		});

		it("should preserve all data after rename", async () => {
			const oldName = "old_users";
			const newName = "renamed_users";

			// Get original data
			const originalData = await mongoClient
				.db(testDbName)
				.collection(oldName)
				.find()
				.toArray();

			await renameCollectionTool.handler(
				{ database: testDbName, oldName, newName },
				mockExtra,
			);

			// Get data after rename
			const renamedData = await mongoClient
				.db(testDbName)
				.collection(newName)
				.find()
				.toArray();

			expect(renamedData).toHaveLength(originalData.length);
			expect(renamedData[0].name).toBe(originalData[0].name);
		});

		it("should rename collection with underscores in name", async () => {
			const oldName = "old_users";
			const newName = "new_users_data_v1";

			const result = await renameCollectionTool.handler(
				{ database: testDbName, oldName, newName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(true);
			expect(await collectionExists(testDbName, newName)).toBe(true);
		});

		it("should rename collection with numbers in name", async () => {
			const oldName = "old_users";
			const newName = "users_2024_01";

			const result = await renameCollectionTool.handler(
				{ database: testDbName, oldName, newName },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(true);
			expect(await collectionExists(testDbName, newName)).toBe(true);
		});
	});

	// ============================================================
	// VALIDATION TESTS
	// ============================================================

	describe("Validation Tests", () => {
		it("should reject empty database name", async () => {
			const result = await renameCollectionTool.handler(
				{ database: "", oldName: "old_users", newName: "new_users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject empty old collection name", async () => {
			const result = await renameCollectionTool.handler(
				{ database: testDbName, oldName: "", newName: "new_users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject empty new collection name", async () => {
			const result = await renameCollectionTool.handler(
				{ database: testDbName, oldName: "old_users", newName: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject new name with spaces", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "new users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject new name with hyphens", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "new-users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject new name with special characters", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "new@users!",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject new name exceeding max length (256 chars)", async () => {
			const tooLongName = "a".repeat(256);
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: tooLongName,
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject when old name equals new name", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "old_users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});
	});

	// ============================================================
	// SYSTEM COLLECTION PROTECTION TESTS
	// ============================================================

	describe("System Collection Protection", () => {
		it("should reject renaming system collection", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "system.users",
					newName: "users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should reject new name with system prefix", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "system.users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});
	});

	// ============================================================
	// DATABASE AND COLLECTION EXISTENCE TESTS
	// ============================================================

	describe("Database and Collection Existence", () => {
		it("should return error for non-existent database", async () => {
			const nonExistentDb = `non_existent_${Date.now()}`;

			const result = await renameCollectionTool.handler(
				{
					database: nonExistentDb,
					oldName: "old_users",
					newName: "new_users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should return error for non-existent old collection", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "non_existent",
					newName: "new_users",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should return error when new collection name already exists", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "products",
				},
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "new_users",
				},
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("oldName");
			expect(content).toHaveProperty("newName");
			expect(content).toHaveProperty("renamed");
			expect(content).toHaveProperty("documentCount");
			expect(content.renamed).toBe(true);
		});

		it("should have all required fields in error response", async () => {
			const result = await renameCollectionTool.handler(
				{ database: "", oldName: "old_users", newName: "new_users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("oldName");
			expect(content).toHaveProperty("newName");
			expect(content).toHaveProperty("renamed");
			expect(content).toHaveProperty("documentCount");
			expect(content.renamed).toBe(false);
		});

		it("should return content as JSON string", async () => {
			const result = await renameCollectionTool.handler(
				{
					database: testDbName,
					oldName: "old_users",
					newName: "new_users",
				},
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
				expect(parsed.oldName).toBe("old_users");
				expect(parsed.newName).toBe("new_users");
				expect(parsed.renamed).toBe(true);
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

			const result = await renameCollectionTool.handler(
				{
					database: "test_db",
					oldName: "old_users",
					newName: "new_users",
				},
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await renameCollectionTool.handler(
				{
					database: "test_db",
					oldName: "old_users",
					newName: "new_users",
				},
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.renamed).toBe(false);
		});
	});
});
