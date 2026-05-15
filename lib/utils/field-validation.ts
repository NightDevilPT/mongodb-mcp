// ============================================================
// CONSTANTS
// ============================================================
export const COLLECTION_NAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const MAX_COLLECTION_NAME_LENGTH = 255;
export const SYSTEM_PREFIX = "system.";

export const PREDEFINED_PATTERNS: Record<string, string> = {
	email: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
	url: "^(https?|ftp)://[^\\s/$.?#].[^\\s]*$",
	phone: "^\\+?[1-9]\\d{1,14}$",
	zipCode: "^\\d{5}(-\\d{4})?$",
};

export const BSON_TYPE_MAP: Record<string, string> = {
	string: "string",
	number: "number",
	boolean: "bool",
	array: "array",
	object: "object",
	date: "date",
	objectId: "objectId",
	email: "string",
	url: "string",
	phone: "string",
	zipCode: "string",
};

export const STRING_TYPES = ["string", "email", "url", "phone", "zipCode"];

// ============================================================
// VALIDATION RESULT
// ============================================================
export interface ValidationResult {
	valid: boolean;
	error: string;
}

// ============================================================
// VALIDATE DATABASE NAME
// ============================================================
export function validateDatabaseName(database: string): ValidationResult {
	if (!database || database.trim() === "") {
		return { valid: false, error: "Database name cannot be empty" };
	}
	return { valid: true, error: "" };
}

// ============================================================
// VALIDATE COLLECTION NAME
// ============================================================
export function validateCollectionName(collection: string): ValidationResult {
	if (!collection || collection.trim() === "") {
		return { valid: false, error: "Collection name cannot be empty" };
	}
	if (collection.length > MAX_COLLECTION_NAME_LENGTH) {
		return {
			valid: false,
			error: `Max ${MAX_COLLECTION_NAME_LENGTH} characters allowed`,
		};
	}
	if (!COLLECTION_NAME_REGEX.test(collection)) {
		return {
			valid: false,
			error: "Only letters, numbers, and underscores allowed",
		};
	}
	if (collection.toLowerCase().startsWith(SYSTEM_PREFIX)) {
		return { valid: false, error: "Cannot start with 'system.'" };
	}
	return { valid: true, error: "" };
}

// ============================================================
// BUILD FIELD DEFINITION FOR MONGODB VALIDATOR
// ============================================================
export function buildFieldDef(
	fieldName: string,
	fieldType: string,
	options: Record<string, unknown> = {},
): Record<string, unknown> {
	const bsonType = BSON_TYPE_MAP[fieldType] || fieldType;
	const def: Record<string, unknown> = {
		bsonType,
		description: (options.description as string) || `${fieldName} field`,
	};

	// String validations
	if (STRING_TYPES.includes(fieldType)) {
		if (options.minLength !== undefined) def.minLength = options.minLength;
		if (options.maxLength !== undefined) def.maxLength = options.maxLength;
		if (options.pattern) {
			def.pattern = options.pattern;
		} else if (PREDEFINED_PATTERNS[fieldType]) {
			def.pattern = PREDEFINED_PATTERNS[fieldType];
		}
		if (options.enumValues && String(options.enumValues).trim() !== "") {
			def.enum = String(options.enumValues)
				.split(",")
				.map((v) => v.trim());
		}
	}

	// Number validations
	if (fieldType === "number") {
		if (options.min !== undefined) def.minimum = options.min;
		if (options.max !== undefined) def.maximum = options.max;
		if (options.multipleOf !== undefined)
			def.multipleOf = options.multipleOf;
	}

	// Array validations
	if (fieldType === "array") {
		if (options.minItems !== undefined) def.minItems = options.minItems;
		if (options.maxItems !== undefined) def.maxItems = options.maxItems;
		if (options.uniqueItems) def.uniqueItems = true;
	}

	// Date validations
	if (fieldType === "date") {
		if (options.minDate) def.minimum = options.minDate;
		if (options.maxDate) def.maximum = options.maxDate;
	}

	return def;
}

// ============================================================
// BUILD INDEX SPEC
// ============================================================
export function buildIndexSpec(
	fieldName: string,
	options: Record<string, unknown> = {},
): {
	spec: Record<string, 1 | -1 | "text">;
	options: Record<string, unknown>;
} | null {
	if (options.unique) {
		return {
			spec: { [fieldName]: 1 },
			options: {
				unique: true,
				background: true,
				...(options.sparse ? { sparse: true } : {}),
			},
		};
	}
	if (options.index) {
		return { spec: { [fieldName]: 1 }, options: { background: true } };
	}
	if (options.descendingIndex) {
		return { spec: { [fieldName]: -1 }, options: { background: true } };
	}
	if (options.textIndex) {
		return { spec: { [fieldName]: "text" }, options: { background: true } };
	}
	return null;
}

// ============================================================
// BUILD TTL INDEX
// ============================================================
export function buildTTLIndex(
	fieldName: string,
	expireAfterSeconds: number,
): { spec: Record<string, 1>; options: Record<string, unknown> } | null {
	return {
		spec: { [fieldName]: 1 },
		options: { expireAfterSeconds, background: true },
	};
}

// ============================================================
// UPDATE COLLECTION VALIDATOR (adds field to existing schema)
// ============================================================
export async function updateCollectionValidator(
	db: any,
	collection: string,
	fieldName: string,
	fieldDef: Record<string, unknown>,
	required: boolean = false,
): Promise<void> {
	// Get existing validator
	let existingValidator: Record<string, unknown> = {};
	const collInfo = await db.listCollections({ name: collection }).toArray();
	if (collInfo.length > 0) {
		const options = (collInfo[0] as any).options;
		if (options?.validator?.$jsonSchema) {
			existingValidator = options.validator.$jsonSchema;
		}
	}

	const properties =
		(existingValidator.properties as Record<string, unknown>) || {};
	const requiredFields = (existingValidator.required as string[]) || [];

	// Add new field
	properties[fieldName] = fieldDef;
	if (required) requiredFields.push(fieldName);

	// Update validator
	const jsonSchema: Record<string, unknown> = {
		bsonType: "object",
		properties,
		additionalProperties: true,
	};
	if (requiredFields.length > 0) jsonSchema.required = requiredFields;

	await db.command({
		collMod: collection,
		validator: { $jsonSchema: jsonSchema },
		validationLevel: "moderate",
		validationAction: "warn",
	});
}
