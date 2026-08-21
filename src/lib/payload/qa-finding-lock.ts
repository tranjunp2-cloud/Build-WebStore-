import { sql } from "drizzle-orm";
import type { PayloadRequest } from "payload";

type TransactionRequest = Pick<PayloadRequest, "transactionID">;
type SessionDb = { execute: (query: unknown) => Promise<unknown> };
type FindingDb = { sessions: Record<string, { db: SessionDb }> };

/** Serializes a single fingerprint within the already-open ingest transaction. */
export async function lockQaFindingFingerprint(
  payload: { db: unknown },
  fingerprint: string,
  req: TransactionRequest,
): Promise<void> {
  const db = payload.db as FindingDb;
  const transactionID = await req.transactionID;
  if (typeof transactionID !== "string" || !db.sessions[transactionID])
    throw new Error("QA finding lock requires an active transaction");
  await db.sessions[transactionID].db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`qa-finding:${fingerprint}`}))`,
  );
}
