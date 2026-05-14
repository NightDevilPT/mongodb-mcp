// lib/utils/connection.ts
import { MongoClient, Db } from "mongodb";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerRequest,
	ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ============================================================
// GET MONGODB URI FROM HEADER OR ENV
// ============================================================
export function getMongoURI(extra?: Extra): string | undefined {
	if (extra) {
		const headerValue = extra.requestInfo?.headers?.["mongodb_url"];
		const fromHeader = Array.isArray(headerValue)
			? headerValue[0]
			: headerValue;
		if (fromHeader) return fromHeader;
	}
	return process.env.MONGODB_URI;
}

// ============================================================
// CONNECT TO MONGODB AND RETURN DB INSTANCE
// ============================================================
export async function connectDB(
	extra?: Extra,
	dbName?: string,
): Promise<{ client: MongoClient; db: Db }> {
	const uri = getMongoURI(extra);
	if (!uri) {
		throw new Error(
			"MONGODB_URI not configured. Set it in MCP Inspector Environment Variables.",
		);
	}

	const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
	await client.connect();

	const database = dbName || "test";
	const db = client.db(database);

	return { client, db };
}
