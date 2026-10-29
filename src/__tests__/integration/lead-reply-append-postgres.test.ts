// @vitest-environment node
/**
 * TC-AISEC-117 — concurrent lead replies keep every `replies` entry: `appendLeadReply` (lib/leads/lead-reply) locks the
 * lead row and inserts one `contact_submissions_replies` row (Payload array table: `_parent_id`, `_order`) in a
 * transaction. Ten replies sent at the same moment from separate connections are all kept, numbered 1..10 after the
 * reply that was there, and the lead's `updated_at` moves; an unknown lead is refused and nothing is written.
 * Runs in a scratch schema of its own (dropped at the end), so application data is never touched; the replies table
 * is the db-setup migration's. Skipped without DATABASE_URI.
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { appendLeadReply } from '@/lib/leads/lead-reply'

const connectionString = process.env.DATABASE_URI
const schema = `rh_lead_reply_${randomUUID().replace(/-/g, '').slice(0, 12)}`
const { MIGRATIONS } = createRequire(import.meta.url)(path.resolve(__dirname, '../../../scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }

describe.skipIf(!connectionString)('[TC-AISEC-117] lead replies appended under a row lock on PostgreSQL', () => {
    let admin: Pool
    let pool: Pool

    beforeAll(async () => {
        admin = new Pool({ connectionString, ssl: false, max: 1 })
        await admin.query(`CREATE SCHEMA ${schema}`)
        pool = new Pool({ connectionString, ssl: false, max: 10, options: `-c search_path=${schema}` })
        await pool.query(`CREATE TABLE contact_submissions (id serial PRIMARY KEY, email varchar, updated_at timestamp(3) with time zone NOT NULL DEFAULT now() - interval '1 day')`)
        await pool.query(MIGRATIONS.find((m) => m.name === 'contact_submissions_replies.create_table')!.sql)
        await pool.query(`INSERT INTO contact_submissions (id, email) VALUES (1, 'ahmad@x.my')`)
        await pool.query(`INSERT INTO contact_submissions_replies (_order, _parent_id, subject, body, sent_at, sent_by) VALUES (1, 1, 'Earlier', 'Hi', now(), 'a@b.my')`)
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
        await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
        await admin?.end()
    })

    it('ten replies at once: all kept, in distinct order after the earlier one, and the lead moved', async () => {
        const payload = { db: { drizzle: drizzle(pool) } } as unknown as Payload
        const before = (await pool.query('SELECT updated_at FROM contact_submissions WHERE id = 1')).rows[0].updated_at as Date

        await Promise.all(Array.from({ length: 10 }, (_, i) => appendLeadReply(payload, 1, { subject: `Reply ${i}`, body: `Body ${i}`, sentAt: new Date().toISOString(), sentBy: 'owner@kedai.my' })))

        const rows = (await pool.query('SELECT subject, _order FROM contact_submissions_replies WHERE _parent_id = 1 ORDER BY _order')).rows as Array<{ subject: string; _order: number }>
        expect(rows).toHaveLength(11)
        expect(rows[0]).toEqual({ subject: 'Earlier', _order: 1 })
        expect(rows.map((r) => r._order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        expect(new Set(rows.slice(1).map((r) => r.subject)).size).toBe(10)
        const after = (await pool.query('SELECT updated_at FROM contact_submissions WHERE id = 1')).rows[0].updated_at as Date
        expect(after.getTime()).toBeGreaterThan(before.getTime())
    })

    it('refuses an unknown lead and writes nothing', async () => {
        const payload = { db: { drizzle: drizzle(pool) } } as unknown as Payload

        await expect(appendLeadReply(payload, 999, { subject: 's', body: 'b', sentAt: new Date().toISOString(), sentBy: null })).rejects.toThrow('lead 999 not found')

        expect((await pool.query('SELECT count(*)::int AS n FROM contact_submissions_replies WHERE _parent_id = 999')).rows[0].n).toBe(0)
    })
})
