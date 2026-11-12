import type { Payload, PayloadRequest } from "payload";
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

/** Makes all evidence rows visible together; Payload Local API joins the Drizzle transaction by transactionID. */
export async function withQaIngestTransaction<T>(
  payload: Payload,
  operation: (req: TransactionRequest) => Promise<T>,
): Promise<T> {
  const db = payload.db as unknown as TransactionCapableDb;
  if (!db.drizzle?.transaction)
    throw new Error("Database transactions are unavailable");
  return db.drizzle.transaction(async (transaction) => {
    const session = registerTransactionSession(db, transaction);
    try {
      const result = await operation(session.req);
      session.assertActive();
      return result;
    } finally {
      session.release();
    }
  }, db.transactionOptions);
}
