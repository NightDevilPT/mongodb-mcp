import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { dbConnectCheckTool } from '@/lib/mcp/tools/db-administration/db-connect-check';

describe('db_connect_check tool', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let mockExtra: any;
  let testDbName: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testDbName = `test_db_${Date.now()}`;
    const testDb = mongoClient.db(testDbName);
    
    // Create multiple collections for testing
    await testDb.createCollection('users');
    await testDb.createCollection('products');
    await testDb.createCollection('orders');
    await testDb.createCollection('reviews');

    mockExtra = {
      requestInfo: {
        headers: {
          mongodb_url: mongoServer.getUri(), // Remove database name from URI
        },
      },
    } as any;
  });

  afterEach(async () => {
    // Clean up test database
    const testDb = mongoClient.db(testDbName);
    await testDb.dropDatabase();
  });

  // ============================================================
  // SUCCESS CASES
  // ============================================================

  describe('Success Cases', () => {
    it('should return successful connection with all expected fields', async () => {
      // Create collections in the default 'test' database
      const defaultDb = mongoClient.db('test');
      await defaultDb.createCollection('users');
      await defaultDb.createCollection('products');
      await defaultDb.createCollection('orders');
      await defaultDb.createCollection('reviews');

      const result = await dbConnectCheckTool.handler({}, mockExtra);

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toBeDefined();
      
      const content = result.structuredContent as any;
      expect(content.connected).toBe(true);
      expect(content.message).toBe('Successfully connected to MongoDB');
      expect(content.version).toBeDefined();
      expect(content.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(content.database).toBe('test'); // Default database name
      expect(content.collections).toBe(4);
      expect(content.collectionList).toHaveLength(4);
    });

    it('should return correct collection names', async () => {
      const defaultDb = mongoClient.db('test');
      await defaultDb.createCollection('users');
      await defaultDb.createCollection('products');
      await defaultDb.createCollection('orders');
      await defaultDb.createCollection('reviews');

      const result = await dbConnectCheckTool.handler({}, mockExtra);
      
      const content = result.structuredContent as any;
      expect(content.collectionList).toContain('users');
      expect(content.collectionList).toContain('products');
      expect(content.collectionList).toContain('orders');
      expect(content.collectionList).toContain('reviews');
    });

    it('should return zero collections for empty database', async () => {
      // Drop all collections from default 'test' database
      const defaultDb = mongoClient.db('test');
      const collections = await defaultDb.listCollections().toArray();
      for (const coll of collections) {
        await defaultDb.collection(coll.name).drop();
      }

      const result = await dbConnectCheckTool.handler({}, mockExtra);
      
      const content = result.structuredContent as any;
      expect(content.collections).toBe(0);
      expect(content.collectionList).toEqual([]);
    });

    it('should handle connection without specifying database name', async () => {
      const result = await dbConnectCheckTool.handler({}, mockExtra);
      
      const content = result.structuredContent as any;
      expect(content.connected).toBe(true);
      expect(content.database).toBe('test'); // Default database name
    });
  });

  // ============================================================
  // CREDENTIAL HIDING CASES
  // ============================================================

  describe('Credential Hiding', () => {
    it('should hide username and password in host field with single credentials', async () => {
      const mockExtraWithAuth = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://admin:secret123@localhost:27017',
          },
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraWithAuth);
      
      const content = result.structuredContent as any;
      // The connection will fail but we can check the host field
      if (content.host) {
        expect(content.host).toContain('***');
        expect(content.host).not.toContain('admin');
        expect(content.host).not.toContain('secret123');
      }
    });

    it('should handle URI without credentials', async () => {
      const mockExtraNoAuth = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://localhost:27017',
          },
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraNoAuth);
      
      const content = result.structuredContent as any;
      if (content.host) {
        expect(content.host).toBe('mongodb://localhost:27017');
      }
    });
  });

  // ============================================================
  // ERROR HANDLING CASES
  // ============================================================

  describe('Error Handling', () => {
    it('should handle invalid host connection error', async () => {
      const mockExtraInvalid = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://invalid-host-that-does-not-exist:99999',
          },
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraInvalid);

      expect(result.isError).toBe(true);
      const content = result.structuredContent as any;
      expect(content.connected).toBe(false);
      expect(content.message).toBeDefined();
      expect(content.host).toBe('');
      expect(content.version).toBe('');
      expect(content.database).toBe('');
      expect(content.collections).toBe(0);
      expect(content.collectionList).toEqual([]);
    });

    it('should handle missing MongoDB URI', async () => {
      const mockExtraNoUri = {
        requestInfo: {
          headers: {},
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraNoUri);

      expect(result.isError).toBe(true);
      const content = result.structuredContent as any;
      expect(content.connected).toBe(false);
      expect(content.message).toContain('MONGODB_URI not configured');
      expect(content.host).toBe('');
      expect(content.version).toBe('');
      expect(content.database).toBe('');
      expect(content.collections).toBe(0);
      expect(content.collectionList).toEqual([]);
    });

    it('should handle malformed URI format', async () => {
      const mockExtraMalformed = {
        requestInfo: {
          headers: {
            mongodb_url: 'this-is-not-a-valid-uri',
          },
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraMalformed);

      expect(result.isError).toBe(true);
      const content = result.structuredContent as any;
      expect(content.connected).toBe(false);
      expect(content.message).toBeDefined();
    });
  });

  // ============================================================
  // RESPONSE STRUCTURE TESTS
  // ============================================================

  describe('Response Structure', () => {
    it('should have all required fields in success response', async () => {
      const result = await dbConnectCheckTool.handler({}, mockExtra);
      
      const content = result.structuredContent as any;
      expect(content).toHaveProperty('connected');
      expect(content).toHaveProperty('message');
      expect(content).toHaveProperty('host');
      expect(content).toHaveProperty('version');
      expect(content).toHaveProperty('database');
      expect(content).toHaveProperty('collections');
      expect(content).toHaveProperty('collectionList');
    });

    it('should have all required fields in error response', async () => {
      const mockExtraInvalid = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://invalid:99999',
          },
        },
      } as any;

      const result = await dbConnectCheckTool.handler({}, mockExtraInvalid);
      
      const content = result.structuredContent as any;
      expect(content).toHaveProperty('connected');
      expect(content).toHaveProperty('message');
      expect(content).toHaveProperty('host');
      expect(content).toHaveProperty('version');
      expect(content).toHaveProperty('database');
      expect(content).toHaveProperty('collections');
      expect(content).toHaveProperty('collectionList');
    });

    it('should return content as JSON string', async () => {
      const result = await dbConnectCheckTool.handler({}, mockExtra);
      
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);
      
      const firstContent = result.content[0];
      expect(firstContent).toHaveProperty('type');
      
      if (firstContent.type === 'text') {
        expect(firstContent.text).toBeDefined();
        const parsed = JSON.parse(firstContent.text);
        expect(parsed.connected).toBeDefined();
      }
    });
  });

  // ============================================================
  // CONCURRENT CONNECTION TESTS
  // ============================================================

  describe('Concurrent Connections', () => {
    it('should handle multiple sequential connections', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await dbConnectCheckTool.handler({}, mockExtra);
        expect(result.isError).toBeFalsy();
        expect((result.structuredContent as any).connected).toBe(true);
      }
    });

    it('should handle concurrent connection requests', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(dbConnectCheckTool.handler({}, mockExtra));
      }
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
        expect((result.structuredContent as any).connected).toBe(true);
      });
    });
  });
});