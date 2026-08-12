import crypto from "crypto";
import { sql } from "drizzle-orm";
import type { Payload, PayloadRequest } from "payload";

type TransactionRequest = Pick<PayloadRequest, "transactionID">;
type TransactionSessionDb = { execute: (query: unknown) => Promise<{ rows?: Array<{ locked?: boolean }> }> };
type TransactionCapableDb = {
  drizzle: { transaction: <T>(operation: (transaction: TransactionSessionDb) => Promise<T>, options?: unknown) => Promise<T> };
  sessions: Record<string, { db: TransactionSessionDb }>;
  transactionOptions?: unknown;
};

/** Cross-instance lock for GitHub App quota and mirror writes; released on rollback/commit. */
export async function withQaGithubSyncLock<T>(payload: Payload, operation: (req: TransactionRequest) => Promise<T>): Promise<T> {
  const db = payload.db as unknown as TransactionCapableDb;
  if (!db.drizzle?.transaction) throw new Error("Database transactions are unavailable");
  return db.drizzle.transaction(async (transaction) => {
    const lock = await transaction.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext('qa-github-issue-sync')) AS locked`);
    if (lock.rows?.[0]?.locked !== true) throw new Error("GitHub issue synchronization is already running");
    const transactionID = crypto.randomUUID();
    db.sessions[transactionID] = { db: transaction };
    try {
      return await operation({ transactionID });
    } finally {
      delete db.sessions[transactionID];
    }
  }, db.transactionOptions);
}
