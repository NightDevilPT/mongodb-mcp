import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { getMongoURI, connectDB } from '@/lib/utils/connection';

describe('connection utilities', () => {
  let mongoServer: MongoMemoryServer;
  let realUri: string;
  const originalEnv = process.env;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    realUri = mongoServer.getUri();
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getMongoURI', () => {
    it('should return URI from header when provided', () => {
      const mockExtra = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://header-uri:27017',
          },
        },
      } as any;

      const result = getMongoURI(mockExtra);
      expect(result).toBe('mongodb://header-uri:27017');
    });

    it('should handle array header values', () => {
      const mockExtra = {
        requestInfo: {
          headers: {
            mongodb_url: ['mongodb://array-uri:27017'],
          },
        },
      } as any;

      const result = getMongoURI(mockExtra);
      expect(result).toBe('mongodb://array-uri:27017');
    });

    it('should return URI from environment variable when no header', () => {
      process.env.MONGODB_URI = 'mongodb://env-uri:27017';
      const result = getMongoURI();
      expect(result).toBe('mongodb://env-uri:27017');
    });

    it('should prioritize header over environment variable', () => {
      process.env.MONGODB_URI = 'mongodb://env-uri:27017';
      const mockExtra = {
        requestInfo: {
          headers: {
            mongodb_url: 'mongodb://header-uri:27017',
          },
        },
      } as any;

      const result = getMongoURI(mockExtra);
      expect(result).toBe('mongodb://header-uri:27017');
    });

    it('should return undefined when no URI is available', () => {
      delete process.env.MONGODB_URI;
      const result = getMongoURI();
      expect(result).toBeUndefined();
    });
  });

  describe('connectDB', () => {
    it('should throw error when no URI is configured', async () => {
      delete process.env.MONGODB_URI;
      
      await expect(connectDB()).rejects.toThrow(
        'MONGODB_URI not configured. Set it in MCP Inspector Environment Variables.'
      );
    });

    it('should connect with default database name "test"', async () => {
      process.env.MONGODB_URI = realUri;
      
      const result = await connectDB();
      
      expect(result.client).toBeDefined();
      expect(result.db).toBeDefined();
      expect(result.db.databaseName).toBe('test');
      
      await result.client.close();
    });

    it('should connect with specified database name', async () => {
      process.env.MONGODB_URI = realUri;
      
      const result = await connectDB(undefined, 'my_custom_db');
      
      expect(result.client).toBeDefined();
      expect(result.db).toBeDefined();
      expect(result.db.databaseName).toBe('my_custom_db');
      
      await result.client.close();
    });

    it('should use URI from extra header', async () => {
      const mockExtra = {
        requestInfo: {
          headers: {
            mongodb_url: realUri,
          },
        },
      } as any;

      const result = await connectDB(mockExtra);
      
      expect(result.client).toBeDefined();
      expect(result.db).toBeDefined();
      
      await result.client.close();
    });
  });
});