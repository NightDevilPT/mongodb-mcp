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
import { listFieldsTool } from "@/lib/mcp/tools/db-administration/list-fields";

describe("list_fields tool", () => {
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
		testDbName = `test_list_fields_db_${Date.now()}`;
		const db = mongoClient.db(testDbName);

		// Create collection with schema validation
		await db.createCollection("users", {
			validator: {
				$jsonSchema: {
					bsonType: "object",
					required: ["name", "email"],
					properties: {
						name: {
							bsonType: "string",
							description: "User full name",
							minLength: 2,
							maxLength: 100,
						},
						email: {
							bsonType: "string",
							description: "User email address",
							pattern:
								"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
						},
						age: {
							bsonType: "number",
							description: "User age",
							minimum: 0,
							maximum: 150,
						},
						status: {
							bsonType: "string",
							enum: ["active", "inactive", "pending"],
						},
						tags: {
							bsonType: "array",
							description: "User tags",
							items: { bsonType: "string" },
							minItems: 1,
							maxItems: 10,
							uniqueItems: true,
						},
						address: {
							bsonType: "object",
							description: "User address",
							properties: {
								street: { bsonType: "string" },
								city: { bsonType: "string" },
								zipCode: { bsonType: "string" },
							},
						},
					},
				},
			},
		});

		// Create indexes
		await db
			.collection("users")
			.createIndex({ email: 1 }, { unique: true });
		await db.collection("users").createIndex({ age: -1 });
		await db
			.collection("users")
			.createIndex({ status: 1 }, { sparse: true });

		// Insert some data
		await db.collection("users").insertMany([
			{
				name: "User1",
				email: "user1@test.com",
				age: 25,
				status: "active",
				tags: ["user", "premium"],
			},
			{
				name: "User2",
				email: "user2@test.com",
				age: 30,
				status: "active",
				tags: ["user"],
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
		it("should list all fields with their properties", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toBeDefined();

			const content = result.structuredContent as any;
			expect(content.database).toBe(testDbName);
			expect(content.collection).toBe("users");
			expect(content.message).toContain("Found");
			expect(content.totalCount).toBeGreaterThan(0);
			expect(Array.isArray(content.fields)).toBe(true);
		});

		it("should return correct field information for string field with validation", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const nameField = content.fields.find(
				(f: any) => f.name === "name",
			);

			expect(nameField).toBeDefined();
			expect(nameField.type).toBe("string");
			expect(nameField.required).toBe(true);
			expect(nameField.description).toBe("User full name");
			expect(nameField.validation.minLength).toBe(2);
			expect(nameField.validation.maxLength).toBe(100);
		});

		it("should return correct field information for email with pattern validation", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const emailField = content.fields.find(
				(f: any) => f.name === "email",
			);

			expect(emailField).toBeDefined();
			expect(emailField.type).toBe("string");
			expect(emailField.required).toBe(true);
			expect(emailField.validation.pattern).toContain("@");
		});

		it("should return correct field information for number with min/max", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const ageField = content.fields.find((f: any) => f.name === "age");

			expect(ageField).toBeDefined();
			expect(ageField.type).toBe("number");
			expect(ageField.required).toBe(false);
			expect(ageField.validation.minimum).toBe(0);
			expect(ageField.validation.maximum).toBe(150);
		});

		it("should return correct field information for enum field", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const statusField = content.fields.find(
				(f: any) => f.name === "status",
			);

			expect(statusField).toBeDefined();
			expect(statusField.type).toBe("string");
			expect(statusField.validation.enum).toEqual([
				"active",
				"inactive",
				"pending",
			]);
		});

		it('should return correct field information for array field', async () => {
			const result = await listFieldsTool.handler(
			  { database: testDbName, collection: 'users' },
			  mockExtra,
			);
		  
			const content = result.structuredContent as any;
			const tagsField = content.fields.find(
			  (f: any) => f.name === 'tags',
			);
		  
			expect(tagsField).toBeDefined();
			expect(tagsField.type).toContain('array');
			// The validation properties might be null
			expect(tagsField.validation.minLength).toBeNull();
			expect(tagsField.validation.maxLength).toBeNull();
		  });

		it("should return correct field information for object field", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const addressField = content.fields.find(
				(f: any) => f.name === "address",
			);

			expect(addressField).toBeDefined();
			expect(addressField.type).toContain("object");
		});

		it("should return index information for fields", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const emailField = content.fields.find(
				(f: any) => f.name === "email",
			);

			expect(emailField.indexes).toBeDefined();
			expect(emailField.indexes.length).toBeGreaterThan(0);
			expect(emailField.indexes[0].unique).toBe(true);
		});

		it("should return empty fields for collection without schema", async () => {
			const db = mongoClient.db(testDbName);
			await db.createCollection("no_schema");

			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "no_schema" },
				mockExtra,
			);

			expect(result.isError).toBeFalsy();
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Found 0 field(s) in 'no_schema'");
		});
	});

	// ============================================================
	// VALIDATION TESTS
	// ============================================================

	describe("Validation Tests", () => {
		it("should reject empty database name", async () => {
			const result = await listFieldsTool.handler(
				{ database: "", collection: "users" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Database name required");
		});

		it("should reject empty collection name", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Collection name required");
		});
	});

	// ============================================================
	// COLLECTION EXISTENCE TESTS
	// ============================================================

	describe("Collection Existence", () => {
		it("should return error for non-existent collection", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "non_existent" },
				mockExtra,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toBe("Collection 'non_existent' not found");
		});
	});

	// ============================================================
	// RESPONSE STRUCTURE TESTS
	// ============================================================

	describe("Response Structure", () => {
		it("should have all required fields in success response", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			expect(content).toHaveProperty("database");
			expect(content).toHaveProperty("collection");
			expect(content).toHaveProperty("message");
			expect(content).toHaveProperty("fields");
			expect(content).toHaveProperty("totalCount");
		});

		it("should have correct structure for each field object", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const field = content.fields[0];

			expect(field).toHaveProperty("name");
			expect(field).toHaveProperty("type");
			expect(field).toHaveProperty("required");
			expect(field).toHaveProperty("validation");
			expect(field).toHaveProperty("indexes");
			expect(field).toHaveProperty("description");
		});

		it("should have correct validation object structure", async () => {
			const result = await listFieldsTool.handler(
				{ database: testDbName, collection: "users" },
				mockExtra,
			);

			const content = result.structuredContent as any;
			const field = content.fields[0];

			expect(field.validation).toHaveProperty("minLength");
			expect(field.validation).toHaveProperty("maxLength");
			expect(field.validation).toHaveProperty("minimum");
			expect(field.validation).toHaveProperty("maximum");
			expect(field.validation).toHaveProperty("pattern");
			expect(field.validation).toHaveProperty("enum");
		});

		it("should return content as JSON string", async () => {
			const result = await listFieldsTool.handler(
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
				expect(parsed.fields).toBeDefined();
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

			const result = await listFieldsTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraInvalid,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("LIST_FIELDS_FAILED");
		});

		it("should handle missing MongoDB URI", async () => {
			const mockExtraNoUri = {
				requestInfo: {
					headers: {},
				},
			} as any;

			const result = await listFieldsTool.handler(
				{ database: "test_db", collection: "users" },
				mockExtraNoUri,
			);

			expect(result.isError).toBe(true);
			const content = result.structuredContent as any;
			expect(content.fields).toEqual([]);
			expect(content.totalCount).toBe(0);
			expect(content.message).toContain("LIST_FIELDS_FAILED");
		});
	});
});
