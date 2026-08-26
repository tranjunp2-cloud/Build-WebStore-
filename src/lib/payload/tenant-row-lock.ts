import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'

export type TenantTransactionRequest = Pick<PayloadRequest, 'transactionID'>
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
    operation: (req: TenantTransactionRequest) => Promise<T>,
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

/** Lock the selected tenant site rows inside an active tenant transaction. */
export async function lockTenantSiteRows(
    payload: Payload,
    tenantId: string | number,
    siteIds: number[],
    req: TenantTransactionRequest,
): Promise<void> {
    if (siteIds.length < 1 || siteIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
        throw new Error('Tenant site lock requires positive integer site IDs')
    }
    const db = payload.db as unknown as TransactionCapableDb
    const siteIdArray = '{' + siteIds.join(',') + '}'
    const transactionID = await req.transactionID
    if (typeof transactionID !== 'string') {
        throw new Error('Tenant site lock requires a transaction ID')
    }
    const session = db.sessions[transactionID]
    if (!session) throw new Error('Tenant site lock requires an active transaction')
    await session.db.execute(
        sql`SELECT id FROM sites
            WHERE tenant_id = ${tenantId}
              AND id = ANY(${siteIdArray}::integer[])
            FOR UPDATE`,
    )
}
