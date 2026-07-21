import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'

type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type TransactionCapableDb = Payload['db'] & {
    sessions: Record<string, {
        db: { execute: (query: unknown) => Promise<unknown> }
    }>
}

/** Serialize mutations that must read and update the same tenant consistently. */
export async function withTenantRowLock<T>(
    payload: Payload,
    tenantId: string | number,
    operation: (req: TransactionRequest) => Promise<T>,
): Promise<T> {
    const db = payload.db as TransactionCapableDb
    const transactionID = await db.beginTransaction()
    if (transactionID == null) throw new Error('Database transactions are unavailable')

    const session = db.sessions[String(transactionID)]
    if (!session) {
        await db.rollbackTransaction(transactionID)
        throw new Error('Database transaction session was not created')
    }

    try {
        await session.db.execute(sql`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`)
        const result = await operation({ transactionID })
        await db.commitTransaction(transactionID)
        return result
    } catch (error) {
        await db.rollbackTransaction(transactionID)
        throw error
    }
}
