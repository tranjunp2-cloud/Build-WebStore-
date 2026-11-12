import { sql } from "drizzle-orm";
import type { BasePayload, PayloadRequest } from "payload";
import { registerTransactionSession } from "./transaction-session";

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
    const session = registerTransactionSession(db, transaction);
    try {
      await transaction.execute(
        sql`SELECT id FROM qa_findings WHERE id = ${findingId} FOR UPDATE`,
      );
      const result = await operation(session.req);
      session.assertActive();
      return result;
    } finally {
      session.release();
    }
  }, db.transactionOptions);
}
