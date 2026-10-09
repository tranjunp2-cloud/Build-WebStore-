import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { MigrationError } from './pw1-errors'
type Tx = { execute(query: unknown): Promise<unknown> }
type Database = { drizzle: { transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }; sessions: Record<string, { db: Tx; reject: () => Promise<void> }> }
/** PostgreSQL owns rollback, including process death. Media stays outside this transaction for reuse. */
export async function withAtomicSiteWrite<T>(payload: Payload, snapshot: { id: number; updatedAt: string }, pages: Array<{ id: number; updatedAt: string }>, operation: (scoped: Payload, beginWrite: () => Promise<void>, tx: Tx) => Promise<T>, acquireWrite?: () => Promise<() => void>): Promise<T> {
    const db = payload.db as unknown as Database
    let liveTx: Tx | undefined
    let transaction: Promise<unknown> | undefined
    let complete!: () => void, abort!: (error: unknown) => void
    let release: (() => void) | undefined
    const tx: Tx = { execute: query => {
        if (!liveTx) throw new Error('Call beginWrite before transaction operations')
        return liveTx.execute(query)
    } }
    {
        const transactionID = randomUUID()
        let failure: unknown

        let writing = false
        const methods = new Set(['find','findByID','count','create','update','delete','findVersions','findVersionByID'])
        const scoped = new Proxy(payload, {
            get(target, key, receiver) {
                const original = Reflect.get(target, key, receiver)
                if (typeof key !== 'string' || !methods.has(key) || typeof original !== 'function') return original
                return async (args: Record<string, unknown>) => {
                    const siteData = ['sites','pages'].includes(String(args.collection))
                    if (siteData && !writing && ['create','update','delete'].includes(key)) throw new Error('Website mutation before beginWrite is forbidden')
                    const inTransaction = writing && siteData
                    if (inTransaction && (failure || !db.sessions[transactionID])) throw failure ?? new MigrationError('TRANSACTION_ABORTED', 'Migration transaction no longer exists')
                    try { return await original.call(target, inTransaction ? { ...args, req: { ...(args.req as object ?? {}), transactionID } } : args) }
                    catch (error) { if (inTransaction) failure = error; throw error }
                }
            },
        })
        const startWrite = async () => {
            if (writing) return
            release = await acquireWrite?.()
            let ready!: () => void, notReady!: (error: unknown) => void
            const started = new Promise<void>((resolve, reject) => { ready = resolve; notReady = reject })
            const finished = new Promise<void>((resolve, reject) => { complete = resolve; abort = reject })
            void finished.catch(() => undefined) // May never be consumed if opening the transaction fails.
            transaction = db.drizzle.transaction(async actual => {
                liveTx = actual
                db.sessions[transactionID] = { db: actual, reject: async () => { failure ??= new MigrationError('TRANSACTION_ABORTED', 'Payload aborted the migration transaction') } }
                ready()
                await finished
            })
            // Observe early failures immediately; the caller still awaits the original transaction below.
            void transaction.catch(notReady)
            await started
            const result = await tx.execute(sql`SELECT updated_at FROM sites WHERE id=${snapshot.id} FOR UPDATE`) as { rows: Array<{ updated_at: Date }> }
            if (!result.rows[0] || new Date(result.rows[0].updated_at).getTime() !== new Date(snapshot.updatedAt).getTime()) throw new MigrationError('CONCURRENT_EDIT', 'Site changed during generation; retry after editing stops')
            const current = await tx.execute(sql`SELECT id,updated_at FROM pages WHERE site_id=${snapshot.id} ORDER BY id FOR UPDATE`) as { rows: Array<{ id: number; updated_at: Date }> }
            const expected = pages.map(p => `${p.id}:${new Date(p.updatedAt).getTime()}`).sort()
            const actual = current.rows.map(p => `${p.id}:${new Date(p.updated_at).getTime()}`).sort()
            if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new MigrationError('CONCURRENT_EDIT', 'Pages changed during generation; retry after editing stops')
            writing = true
        }
        const beginWrite = async () => {
            if (failure) throw failure
            try { await startWrite() } catch (error) { failure = error; throw error }
        }
        try {
            const result = await operation(scoped, beginWrite, tx)
            if (failure || (transaction && !db.sessions[transactionID])) throw failure ?? new MigrationError('TRANSACTION_ABORTED', 'Migration transaction no longer exists')
            complete?.()
            if (transaction) await transaction
            return result
        } catch (error) {
            abort?.(error)
            if (transaction) await transaction.catch(() => undefined) // Preserve the original operation/commit error.
            throw error
        } finally { delete db.sessions[transactionID]; release?.() }
    }
}
