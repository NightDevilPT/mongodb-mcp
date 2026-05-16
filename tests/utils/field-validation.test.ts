import { describe, it, expect } from 'vitest';
import {
	COLLECTION_NAME_REGEX,
	MAX_COLLECTION_NAME_LENGTH,
	SYSTEM_PREFIX,
	PREDEFINED_PATTERNS,
	BSON_TYPE_MAP,
	STRING_TYPES,
	validateDatabaseName,
	validateCollectionName,
	buildFieldDef,
	buildIndexSpec,
	buildTTLIndex,
} from '@/lib/utils/field-validation';

describe('field-validation utilities', () => {
	describe('validateDatabaseName', () => {
		it('should return valid for correct database name', () => {
			const result = validateDatabaseName('my_database');
			expect(result.valid).toBe(true);
			expect(result.error).toBe('');
		});

		it('should return invalid for empty database name', () => {
			const result = validateDatabaseName('');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Database name cannot be empty');
		});

		it('should return invalid for whitespace-only database name', () => {
			const result = validateDatabaseName('   ');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Database name cannot be empty');
		});
	});

	describe('validateCollectionName', () => {
		it('should return valid for correct collection name', () => {
			const result = validateCollectionName('users');
			expect(result.valid).toBe(true);
			expect(result.error).toBe('');
		});

		it('should return invalid for empty collection name', () => {
			const result = validateCollectionName('');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Collection name cannot be empty');
		});

		it('should return invalid for name exceeding max length', () => {
			const longName = 'a'.repeat(MAX_COLLECTION_NAME_LENGTH + 1);
			const result = validateCollectionName(longName);
			expect(result.valid).toBe(false);
			expect(result.error).toContain(`Max ${MAX_COLLECTION_NAME_LENGTH}`);
		});

		it('should return invalid for name with invalid characters', () => {
			const result = validateCollectionName('user-name');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Only letters, numbers, and underscores allowed');
		});

		it('should return invalid for name starting with system prefix', () => {
			const result = validateCollectionName('system.users');
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Only letters, numbers, and underscores allowed");
		});

		it('should accept names with underscores', () => {
			const result = validateCollectionName('user_profiles');
			expect(result.valid).toBe(true);
		});

		it('should accept names with numbers', () => {
			const result = validateCollectionName('users123');
			expect(result.valid).toBe(true);
		});
	});

	describe('buildFieldDef', () => {
		it('should build string field definition', () => {
			const result = buildFieldDef('email', 'string', {
				minLength: 5,
				maxLength: 100,
				description: 'User email address',
			});

			expect(result.bsonType).toBe('string');
			expect(result.minLength).toBe(5);
			expect(result.maxLength).toBe(100);
			expect(result.description).toBe('User email address');
		});

		it('should build email field with predefined pattern', () => {
			const result = buildFieldDef('email', 'email', {
				description: 'Contact email',
			});

			expect(result.bsonType).toBe('string');
			expect(result.pattern).toBe(PREDEFINED_PATTERNS.email);
			expect(result.description).toBe('Contact email');
		});

		it('should build url field with predefined pattern', () => {
			const result = buildFieldDef('website', 'url');
			expect(result.bsonType).toBe('string');
			expect(result.pattern).toBe(PREDEFINED_PATTERNS.url);
		});

		it('should build phone field with predefined pattern', () => {
			const result = buildFieldDef('phone', 'phone');
			expect(result.bsonType).toBe('string');
			expect(result.pattern).toBe(PREDEFINED_PATTERNS.phone);
		});

		it('should build zipCode field with predefined pattern', () => {
			const result = buildFieldDef('zip', 'zipCode');
			expect(result.bsonType).toBe('string');
			expect(result.pattern).toBe(PREDEFINED_PATTERNS.zipCode);
		});

		it('should build number field with min/max', () => {
			const result = buildFieldDef('age', 'number', {
				min: 0,
				max: 150,
			});

			expect(result.bsonType).toBe('number');
			expect(result.minimum).toBe(0);
			expect(result.maximum).toBe(150);
		});

		it('should build boolean field', () => {
			const result = buildFieldDef('isActive', 'boolean');
			expect(result.bsonType).toBe('bool');
		});

		it('should build date field', () => {
			const result = buildFieldDef('createdAt', 'date', {
				minDate: '2020-01-01',
				maxDate: '2030-12-31',
			});

			expect(result.bsonType).toBe('date');
			expect(result.minimum).toBe('2020-01-01');
			expect(result.maximum).toBe('2030-12-31');
		});

		it('should build array field', () => {
			const result = buildFieldDef('tags', 'array', {
				minItems: 1,
				maxItems: 10,
				uniqueItems: true,
			});

			expect(result.bsonType).toBe('array');
			expect(result.minItems).toBe(1);
			expect(result.maxItems).toBe(10);
			expect(result.uniqueItems).toBe(true);
		});

		it('should build objectId field', () => {
			const result = buildFieldDef('userId', 'objectId');
			expect(result.bsonType).toBe('objectId');
		});
	});

	describe('buildIndexSpec', () => {
		it('should build unique index spec', () => {
			const result = buildIndexSpec('email', { unique: true, sparse: true });

			expect(result).not.toBeNull();
			expect(result?.spec).toEqual({ email: 1 });
			expect(result?.options.unique).toBe(true);
			expect(result?.options.sparse).toBe(true);
		});

		it('should build ascending index', () => {
			const result = buildIndexSpec('createdAt', { index: true });

			expect(result).not.toBeNull();
			expect(result?.spec).toEqual({ createdAt: 1 });
		});

		it('should build descending index', () => {
			const result = buildIndexSpec('createdAt', { descendingIndex: true });

			expect(result).not.toBeNull();
			expect(result?.spec).toEqual({ createdAt: -1 });
		});

		it('should build text index', () => {
			const result = buildIndexSpec('content', { textIndex: true });

			expect(result).not.toBeNull();
			expect(result?.spec).toEqual({ content: 'text' });
		});

		it('should return null when no index options provided', () => {
			const result = buildIndexSpec('field', {});
			expect(result).toBeNull();
		});
	});

	describe('buildTTLIndex', () => {
		it('should build TTL index spec', () => {
			const expireAfterSeconds = 86400;
			const result = buildTTLIndex('expiresAt', expireAfterSeconds);

			expect(result).not.toBeNull();
			expect(result?.spec).toEqual({ expiresAt: 1 });
			expect(result?.options.expireAfterSeconds).toBe(expireAfterSeconds);
		});
	});

	describe('Constants', () => {
		it('should have correct regex patterns', () => {
			expect(COLLECTION_NAME_REGEX.test('valid_name_123')).toBe(true);
			expect(COLLECTION_NAME_REGEX.test('invalid-name')).toBe(false);
		});

		it('should have correct max length', () => {
			expect(MAX_COLLECTION_NAME_LENGTH).toBe(255);
		});

		it('should have correct system prefix', () => {
			expect(SYSTEM_PREFIX).toBe('system.');
		});

		it('should have predefined patterns', () => {
			expect(PREDEFINED_PATTERNS.email).toBeDefined();
			expect(PREDEFINED_PATTERNS.url).toBeDefined();
			expect(PREDEFINED_PATTERNS.phone).toBeDefined();
			expect(PREDEFINED_PATTERNS.zipCode).toBeDefined();
		});

		it('should have BSON type mappings', () => {
			expect(BSON_TYPE_MAP.string).toBe('string');
			expect(BSON_TYPE_MAP.number).toBe('number');
			expect(BSON_TYPE_MAP.boolean).toBe('bool');
		});

		it('should have string types list', () => {
			expect(STRING_TYPES).toContain('string');
			expect(STRING_TYPES).toContain('email');
			expect(STRING_TYPES).toContain('url');
			expect(STRING_TYPES).toContain('phone');
			expect(STRING_TYPES).toContain('zipCode');
		});
	});
});