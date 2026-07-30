import type { Payload } from 'payload'

type LockClient = {
    query: (
        text: string,
        values?: Array<string | number>,
    ) => Promise<{ rows: Array<{ id: string | number }> }>
    release: () => void
}

type LockPool = {
    connect: () => Promise<LockClient>
    options?: { max?: number }
}

type LockDatabase = { pool: LockPool }
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

/** Hold an active tenant category row while its dependent Product is auto-committed. */
export async function withActiveCategoryRowLock<T>(
    payload: Payload,
    categoryId: string | number,
    tenantId: string | number,
    operation: (canonicalCategoryId: string | number) => Promise<T>,
): Promise<T | null> {
    const database = payload.db as unknown as LockDatabase
    if (!database.pool?.connect) throw new Error('Database row locking is unavailable')

    return withCategoryMutationGate(payload, async () => {
        let client: LockClient | undefined
        try {
            client = await database.pool.connect()
            await client.query('BEGIN')
            await client.query(
                "SELECT set_config('lock_timeout', $1, true)",
                [`${CATEGORY_LOCK_TIMEOUT_MS}ms`],
            )
            const result = await client.query(
                `
                SELECT id
                FROM categories
                WHERE id = $1
                  AND tenant_id = $2
                  AND deleted_at IS NULL
                FOR KEY SHARE
                `,
                [categoryId, tenantId],
            )
            const canonicalCategoryId = result.rows[0]?.id
            if (canonicalCategoryId == null) {
                await client.query('COMMIT')
                return null
            }

            const value = await operation(canonicalCategoryId)
            await client.query('COMMIT')
            return value
        } catch (error) {
            if (client) {
                try {
                    await client.query('ROLLBACK')
                } catch (rollbackError) {
                    void rollbackError
                }
            }
            if (isCategoryLockTimeoutError(error)) {
                throw new Error(CATEGORY_LOCK_BUSY_ERROR)
            }
            throw error
        } finally {
            client?.release()
        }
    })
}
