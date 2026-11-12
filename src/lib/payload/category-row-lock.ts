import type { Payload } from 'payload'
import { isPoolAcquireTimeout } from '@/lib/db/pool-errors'

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
type GateWaiter = {
    active: boolean
    resolve: () => void
    timer: ReturnType<typeof setTimeout>
}
type PoolMutationGate = {
    active: boolean
    waiters: GateWaiter[]
}

const CATEGORY_LOCK_TIMEOUT_MS = 2_000
export const CATEGORY_POOL_CONNECT_TIMEOUT_MS = 5_000
export const CATEGORY_GATE_TIMEOUT_MS = 5_000
export const CATEGORY_LOCK_BUSY_ERROR = 'CATEGORY_BUSY_RETRY'

const poolMutationGates = new WeakMap<object, PoolMutationGate>()
const stalledPoolCheckouts = new WeakMap<LockPool, Promise<LockClient>>()

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

    await new Promise<void>((resolve, reject) => {
        const waiter = {} as GateWaiter
        waiter.active = true
        waiter.resolve = () => {
            if (!waiter.active) return
            waiter.active = false
            clearTimeout(waiter.timer)
            resolve()
        }
        waiter.timer = setTimeout(() => {
            if (!waiter.active) return
            waiter.active = false
            const waiterIndex = gate.waiters.indexOf(waiter)
            if (waiterIndex >= 0) gate.waiters.splice(waiterIndex, 1)
            reject(new Error(CATEGORY_LOCK_BUSY_ERROR))
        }, CATEGORY_GATE_TIMEOUT_MS)
        gate.waiters.push(waiter)
    })
}

function releaseMutationGate(gate: PoolMutationGate): void {
    while (gate.waiters.length > 0) {
        const next = gate.waiters.shift()
        if (!next?.active) continue
        next.resolve()
        return
    }
    gate.active = false
}

async function connectWithTimeout(pool: LockPool): Promise<LockClient> {
    // `pg-pool` cannot cancel a Promise-based checkout unless its global
    // connectionTimeoutMillis is configured. Do not enqueue another category checkout while a
    // timed-out one is still pending; the late result below releases itself and clears this guard.
    if (stalledPoolCheckouts.has(pool)) throw new Error(CATEGORY_LOCK_BUSY_ERROR)

    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const pendingConnection = pool.connect()
    let connection: Promise<LockClient>
    connection = pendingConnection.then(
        client => {
            if (!timedOut) return client
            try {
                client.release()
            } finally {
                if (stalledPoolCheckouts.get(pool) === connection) {
                    stalledPoolCheckouts.delete(pool)
                }
            }
            throw new Error(CATEGORY_LOCK_BUSY_ERROR)
        },
        error => {
            if (timedOut && stalledPoolCheckouts.get(pool) === connection) {
                stalledPoolCheckouts.delete(pool)
            }
            // The pool's own acquire timeout (3 s, pool-options.ts) fires before ours: same meaning, busy.
            if (isPoolAcquireTimeout(error)) throw new Error(CATEGORY_LOCK_BUSY_ERROR)
            throw error
        }
    )

    try {
        return await Promise.race([
            connection,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => {
                    timedOut = true
                    stalledPoolCheckouts.set(pool, connection)
                    reject(new Error(CATEGORY_LOCK_BUSY_ERROR))
                }, CATEGORY_POOL_CONNECT_TIMEOUT_MS)
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
        // A checkout that resolves after the timeout is released by `connection` above. Attach
        // a rejection handler so that late cleanup never becomes an unhandled rejection.
        void connection.catch(() => undefined)
    }
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
        let productOperationStarted = false
        try {
            client = await connectWithTimeout(database.pool)
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

            productOperationStarted = true
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
            if (!productOperationStarted && isCategoryLockTimeoutError(error)) {
                throw new Error(CATEGORY_LOCK_BUSY_ERROR)
            }
            throw error
        } finally {
            client?.release()
        }
    })
}
