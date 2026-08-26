import crypto from "crypto";
import { sql } from "drizzle-orm";
import type { BasePayload, PayloadRequest } from "payload";

type TransactionRequest = Pick<PayloadRequest, "transactionID">;
type TransactionSessionDb = { execute: (query: unknown) => Promise<unknown> };
type TransactionCapableDb = {
  drizzle: {
    transaction: <T>(
      operation: (transaction: TransactionSessionDb) => Promise<T>,
      options?: unknown,
    ) => Promise<T>;
  };
  sessions: Record<string, { db: TransactionSessionDb }>;
  transactionOptions?: unknown;
};

/** Serializes a promotion decision for one durable finding. */
export async function withQaFindingRowLock<T>(
  payload: BasePayload,
  findingId: string | number,
  operation: (req: TransactionRequest) => Promise<T>,
): Promise<T> {
  const db = payload.db as unknown as TransactionCapableDb;
  if (!db.drizzle?.transaction)
    throw new Error("Database transactions are unavailable");

  return db.drizzle.transaction(async (transaction) => {
    const transactionID = crypto.randomUUID();
    db.sessions[transactionID] = { db: transaction };
    try {
      await transaction.execute(
        sql`SELECT id FROM qa_findings WHERE id = ${findingId} FOR UPDATE`,
      );
      return await operation({ transactionID });
    } finally {
      delete db.sessions[transactionID];
    }
  }, db.transactionOptions);
}
