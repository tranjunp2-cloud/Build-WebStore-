import { sql } from "drizzle-orm";
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

/**
 * Serializes capacity decisions for one staging fixture. PostgreSQL advisory
 * transaction locks are released on commit/rollback, including process errors,
 * and avoid an expiring-row uniqueness predicate (which PostgreSQL forbids).
 */
export async function withQaTargetedDispatchTransaction<T>(
  payload: Payload,
  environment: "staging",
  fixtureKey: string,
  operation: (req: TransactionRequest) => Promise<T>,
  quotaProfile?: "smoke" | "regression",
): Promise<T> {
  const db = payload.db as unknown as TransactionCapableDb;
  if (!db.drizzle?.transaction)
    throw new Error("Database transactions are unavailable");

  return db.drizzle.transaction(async (transaction) => {
    const session = registerTransactionSession(db, transaction);
    try {
      if (quotaProfile)
        await transaction.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`${environment}:qa-profile:${quotaProfile}`}))`,
        );
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`${environment}:${fixtureKey}`}))`,
      );
      const result = await operation(session.req);
      session.assertActive();
      return result;
    } finally {
      session.release();
    }
  }, db.transactionOptions);
}

/** Acquires the same fixture lock inside an existing Payload transaction. */
export async function lockQaTargetedFixture(
  payload: Payload,
  environment: "staging",
  fixtureKey: string,
  req: TransactionRequest,
): Promise<void> {
  const db = payload.db as unknown as TransactionCapableDb;
  const transactionID = await req.transactionID;
  if (typeof transactionID !== "string")
    throw new Error("Targeted fixture lock requires a transaction ID");
  const session = db.sessions[transactionID];
  if (!session) throw new Error("Targeted fixture lock requires an active transaction");
  await session.db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`${environment}:${fixtureKey}`}))`,
  );
}
