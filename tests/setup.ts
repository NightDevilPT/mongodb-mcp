import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;

// Global test setup - runs once before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  
  // Store connection info globally for tests to access
  (global as any).__MONGO_URI__ = uri;
  (global as any).__MONGO_CLIENT__ = mongoClient;
});

// Cleanup - runs once after all tests
afterAll(async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clean up databases after each test
afterEach(async () => {
  if (mongoClient) {
    const databases = await mongoClient.db().admin().listDatabases();
    for (const db of databases.databases) {
      // Don't drop system databases
      if (!['admin', 'local', 'config'].includes(db.name)) {
        await mongoClient.db(db.name).dropDatabase();
      }
    }
  }
});