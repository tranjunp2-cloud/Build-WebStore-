import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'

type TransactionRequest = Pick<PayloadRequest, 'transactionID'>
type TransactionSessionDb = {
    execute: (query: unknown) => Promise<unknown>
}

type LockPool = {
    connect: () => Promise<unknown>
    options?: { max?: number }
}

type LockDatabase = {
    pool: LockPool
    drizzle: {
        transaction: <T>(
            operation: (transaction: TransactionSessionDb) => Promise<T>,
            options?: unknown,
        ) => Promise<T>
    }
    sessions: Record<string, { db: TransactionSessionDb }>
    transactionOptions?: unknown
}
type PoolMutationGate = { active: boolean; waiters: Array<() => void> }

const CATEGORY_LOCK_TIMEOUT_MS = 2_000
export const CATEGORY_LOCK_BUSY_ERROR = 'CATEGORY_BUSY_RETRY'

const poolMutationGates = new WeakMap<object, PoolMutationGate>()

export function isCategoryLockTimeoutError(error: unknown): boolean {
    let current = error
    const seen = new Set<object>()

    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current)
        const candidate = current as { code?: unknown; message?: unknown; cause?: unknown }
        if (candidate.code === '55P03') return true
        if (typeof candidate.message === 'string' && candidate.message.includes('lock timeout')) return true
        current = candidate.cause
    }

    return false
}

function getPoolMutationGate(pool: LockPool): PoolMutationGate {
    const existing = poolMutationGates.get(pool)
    if (existing) return existing

    const poolMax = pool.options?.max ?? 10
    if (!Number.isInteger(poolMax) || poolMax < 2) {
        throw new Error('The database pool needs at least two connections for category-safe AI saves')
    }

    const gate = { active: false, waiters: [] }
    poolMutationGates.set(pool, gate)
    return gate
}

async function acquireMutationGate(gate: PoolMutationGate): Promise<void> {
    if (!gate.active) {
        gate.active = true
        return
    }
    await new Promise<void>(resolve => gate.waiters.push(resolve))
}

function releaseMutationGate(gate: PoolMutationGate): void {
    const next = gate.waiters.shift()
    if (next) {
        next()
        return
    }
    gate.active = false
}

/** Serialize category lock/delete critical sections that share one Payload pool. */
export async function withCategoryMutationGate<T>(
    payload: Payload,
    operation: () => Promise<T>,
): Promise<T> {
    const database = payload.db as unknown as LockDatabase
    if (!database.pool?.connect) throw new Error('Database row locking is unavailable')

    const gate = getPoolMutationGate(database.pool)
    await acquireMutationGate(gate)
    try {
        return await operation()
    } finally {
        releaseMutationGate(gate)
    }
}

/** Hold an active tenant category row and write its dependent Product in one transaction. */
export async function withActiveCategoryRowLock<T>(
    payload: Payload,
    categoryId: string | number,
    tenantId: string | number,
    operation: (
        canonicalCategoryId: string | number,
        req: TransactionRequest,
    ) => Promise<T>,
): Promise<T | null> {
    const database = payload.db as unknown as LockDatabase
    if (!database.drizzle?.transaction) throw new Error('Database transactions are unavailable')

    return withCategoryMutationGate(payload, async () => {
        try {
            // Payload's adapter commit helper swallows PostgreSQL COMMIT errors. Use the
            // Drizzle callback transaction directly so a failed final commit rejects, while
            // registering the transaction as a temporary Payload session lets Local API writes
            // participate through req.transactionID.
            return await database.drizzle.transaction(async transaction => {
                const transactionID = crypto.randomUUID()
                database.sessions[transactionID] = { db: transaction }

                try {
                    await transaction.execute(sql`
                        SELECT set_config(
                            'lock_timeout',
                            ${`${CATEGORY_LOCK_TIMEOUT_MS}ms`},
                            true
                        )
                    `)
                    const result = await transaction.execute(sql`
                        SELECT id
                        FROM categories
                        WHERE id = ${categoryId}
                          AND tenant_id = ${tenantId}
                          AND deleted_at IS NULL
                        FOR KEY SHARE
                    `) as { rows: Array<{ id: string | number }> }
                    const canonicalCategoryId = result.rows[0]?.id
                    if (canonicalCategoryId == null) return null

                    // Bound only the category lock acquisition. Product creation can legitimately
                    // wait on unrelated indexes/rows and must not be mislabeled as CATEGORY_BUSY.
                    await transaction.execute(sql`
                        SELECT set_config('lock_timeout', ${'0'}, true)
                    `)
                    return await operation(canonicalCategoryId, { transactionID })
                } finally {
                    delete database.sessions[transactionID]
                }
            }, database.transactionOptions)
        } catch (error) {
            if (isCategoryLockTimeoutError(error)) {
                throw new Error(CATEGORY_LOCK_BUSY_ERROR)
            }
            throw error
        }
    })
}
