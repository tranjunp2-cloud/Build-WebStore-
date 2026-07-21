import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'

type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type TransactionSessionDb = {
    execute: (query: unknown) => Promise<unknown>
}
type TransactionCapableDb = {
    drizzle: {
        transaction: <T>(
            operation: (transaction: TransactionSessionDb) => Promise<T>,
            options?: unknown,
        ) => Promise<T>
    }
    sessions: Record<string, { db: TransactionSessionDb }>
    transactionOptions?: unknown
}

/** Serialize mutations that must read and update the same tenant consistently. */
export async function withTenantRowLock<T>(
    payload: Payload,
    tenantId: string | number,
    operation: (req: TransactionRequest) => Promise<T>,
): Promise<T> {
    const db = payload.db as unknown as TransactionCapableDb
    if (!db.drizzle?.transaction) throw new Error('Database transactions are unavailable')

    // Payload's begin/commit adapter swallows PostgreSQL COMMIT errors. Using Drizzle's
    // callback transaction directly preserves commit failures while the temporary session
    // lets Payload Local API operations participate through req.transactionID.
    return db.drizzle.transaction(async (transaction) => {
        const transactionID = crypto.randomUUID()
        db.sessions[transactionID] = { db: transaction }

        try {
            await transaction.execute(sql`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`)
            return await operation({ transactionID })
        } finally {
            delete db.sessions[transactionID]
        }
    }, db.transactionOptions)
}
