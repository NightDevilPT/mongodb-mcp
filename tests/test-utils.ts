import { MongoClient, ObjectId } from 'mongodb';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { expect } from 'vitest';

// Mock extra object for MCP tools
export function createMockExtra(uri?: string): RequestHandlerExtra<ServerRequest, ServerNotification> {
  return {
    requestInfo: {
      headers: {
        mongodb_url: uri || (global as any).__MONGO_URI__,
      },
    } as any,
    signal: new AbortController().signal,
  } as RequestHandlerExtra<ServerRequest, ServerNotification>;
}

// Create a unique test database name
export function getTestDbName(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Generate a valid MongoDB ObjectId string
export function generateTestId(): string {
  return new ObjectId().toString();
}

// Sample test data
export const sampleUser = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  isActive: true,
};

export const sampleUser2 = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 25,
  isActive: true,
};

export const sampleProduct = {
  name: 'Laptop',
  price: 999.99,
  category: 'electronics',
  inStock: 10,
};

export const sampleOrder = {
  quantity: 2,
  total: 1999.98,
  status: 'pending',
};

// Helper to wait for async operations
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Assertion helpers
export function expectToolSuccess(result: any) {
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toBeDefined();
  expect(result.content).toBeDefined();
  expect(result.content[0].text).toBeDefined();
}

export function expectToolError(result: any) {
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toBeDefined();
}

// Create a test collection with sample data
export async function seedTestCollection(
  client: MongoClient, 
  dbName: string, 
  collectionName: string, 
  data: any[]
) {
  const db = client.db(dbName);
  const collection = db.collection(collectionName);
  await collection.insertMany(data);
  return { db, collection };
}