import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'
import { registerTransactionSession } from './transaction-session'

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

type QueryRowsResult<Row> = {
    rows: Row[]
}

export class TenantSiteLockError extends Error {
    readonly code = 'TENANT_SITE_LOCK_FAILED'
    readonly missingSiteIds: number[]

    constructor(missingSiteIds: number[]) {
        super('One or more tenant sites could not be locked')
        this.name = 'TenantSiteLockError'
        this.missingSiteIds = missingSiteIds
    }
}

function getTransactionSession(
    payload: Payload,
    req: TenantTransactionRequest,
): Promise<TransactionSessionDb> {
    return Promise.resolve(req.transactionID).then((transactionID) => {
        if (typeof transactionID !== 'string') {
            throw new Error('Tenant transaction requires a transaction ID')
        }
        const db = payload.db as unknown as TransactionCapableDb
        const session = db.sessions[transactionID]
        if (!session) throw new Error('Tenant transaction requires an active transaction')
        return session.db
    })
}

/** Execute raw SQL on the same database session used by Payload Local API writes. */
export async function executeTenantTransaction<Result>(
    payload: Payload,
    req: TenantTransactionRequest,
    query: unknown,
): Promise<Result> {
    const session = await getTransactionSession(payload, req)
    return session.execute(query) as Promise<Result>
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
        const session = registerTransactionSession(db, transaction)

        try {
            await transaction.execute(sql`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`)
            const result = await operation(session.req)
            session.assertActive()
            return result
        } finally {
            session.release()
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
    const siteIdArray = '{' + siteIds.join(',') + '}'
    const result = await executeTenantTransaction<QueryRowsResult<{ id: number }>>(
        payload,
        req,
        sql`SELECT id FROM sites
            WHERE tenant_id = ${tenantId}
              AND id = ANY(${siteIdArray}::integer[])
            FOR UPDATE`,
    )

    const lockedIds = new Set(result.rows.map(row => Number(row.id)))
    const missingSiteIds = siteIds.filter(id => !lockedIds.has(id))
    if (missingSiteIds.length > 0) throw new TenantSiteLockError(missingSiteIds)
}
