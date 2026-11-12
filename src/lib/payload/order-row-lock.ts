import { sql } from 'drizzle-orm'
import type { BasePayload, PayloadRequest } from 'payload'
import { registerTransactionSession } from './transaction-session'

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

/** Serialize mutations that must read and update the same order consistently. */
export async function withOrderRowLock<T>(
    payload: BasePayload,
    orderId: string | number,
    operation: (req: TransactionRequest) => Promise<T>,
): Promise<T> {
    const db = payload.db as unknown as TransactionCapableDb
    if (!db.drizzle?.transaction) throw new Error('Database transactions are unavailable')

    return db.drizzle.transaction(async (transaction) => {
        const session = registerTransactionSession(db, transaction)

        try {
            await transaction.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`)
            const result = await operation(session.req)
            session.assertActive()
            return result
        } finally {
            session.release()
        }
    }, db.transactionOptions)
}
