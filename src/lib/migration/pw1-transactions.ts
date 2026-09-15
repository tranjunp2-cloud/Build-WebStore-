import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { Payload } from 'payload'

const configured = new WeakSet<object>()

/** CLI-only: pin each transaction to one connection, including Payload upload transactions.
 * Different installed pg copies can make Drizzle's `instanceof Pool` check fail,
 * accidentally dispatching BEGIN and later statements to different pool connections.
 */
export function configureMigrationTransactions(payload: Payload): void {
    const db = payload.db as unknown as { pool: Pool; schema: Record<string, unknown>; drizzle: ReturnType<typeof drizzle> }
    if (configured.has(db.drizzle)) return
    db.drizzle.transaction = async (operation, options) => {
        const client = await db.pool.connect()
        try {
            const pinned = drizzle({ client, schema: db.schema })
            return await pinned.transaction(operation, options)
        } finally { client.release() }
    }
    configured.add(db.drizzle)
}
