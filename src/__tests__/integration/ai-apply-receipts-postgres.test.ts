// @vitest-environment node
/**
 * The apply receipts' SQL (lib/ai-platform/apply-receipts) on PostgreSQL, against the table exactly as the db-setup
 * migration creates it (as a TEMP table: pg_temp comes first, so application data is never touched):
 * TC-AISEC-100 — one receipt per change set: the first apply takes it, a second gets "busy" while it is fresh and
 *   takes it over once the first attempt is older than the claim hold; an applied receipt answers with its stored
 *   result; another workspace's receipt is never touched; a refused apply drops only its own receipt.
 * TC-AISEC-102 — the undo receipt is an upsert to `reverted` (also without an approve receipt); a reinstate turns a
 *   reverted receipt back to applied.
 * TC-AISEC-103 — the sweep reads unrecorded applied / reverted receipts older than a minute and younger than the undo
 *   window, oldest first, at most the limit; recorded ones and fresh ones are left out; a deferred one goes last.
 * Skipped without DATABASE_URI.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ payload: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.payload) }))
vi.mock('@payload-config', () => ({ default: {} }))

import {
    abandonApply,
    beginApply,
    deferReceipt,
    markApplied,
    markRecorded,
    markReinstated,
    markReverted,
    readReceipt,
    STALE_APPLYING_MS,
    unrecordedReceipts,
} from '@/lib/ai-platform/apply-receipts'

const connectionString = process.env.DATABASE_URI
const { MIGRATIONS } = createRequire(import.meta.url)(path.resolve(__dirname, '../../../scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
const migration = (name: string) => MIGRATIONS.find((m) => m.name === name)!.sql
const result = { entities: [{ kind: 'lead_reply', id: '2' }], links: [{ label: 'Open contact leads', href: '/contact-leads' }] }
const start = (changeSetId: string, requestId = 'req-1', tenantId = '7') => beginApply({ changeSetId, tenantId, userId: 3, requestId })

describe.skipIf(!connectionString)('[TC-AISEC-100/102/103] apply receipts on PostgreSQL', () => {
    let pool: Pool

    beforeAll(async () => {
        pool = new Pool({ connectionString, ssl: false, max: 1 })
        await pool.query(migration('ai_change_set_applies.create_table').replace('CREATE TABLE IF NOT EXISTS ai_change_set_applies', 'CREATE TEMP TABLE ai_change_set_applies'))
        await pool.query(migration('ai_change_set_applies.unrecorded_idx'))
        h.payload = { db: { drizzle: drizzle(pool) } }
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
    })
    beforeEach(async () => {
        await pool.query('DELETE FROM ai_change_set_applies')
    })
    const age = (changeSetId: string, ms: number, column = 'updated_at') => pool.query(`UPDATE ai_change_set_applies SET ${column} = now() - ($2 || ' milliseconds')::interval WHERE change_set_id = $1`, [changeSetId, String(ms)])

    it('one receipt per change set: started, then busy while fresh, taken over once stale [TC-AISEC-100]', async () => {
        expect(await start('cs_1')).toEqual({ kind: 'started', takeover: false })
        expect(await start('cs_1', 'req-2')).toEqual({ kind: 'busy', state: 'applying' })

        await age('cs_1', STALE_APPLYING_MS + 1_000)
        expect(await start('cs_1', 'req-3')).toEqual({ kind: 'started', takeover: true })
        expect(await readReceipt('cs_1')).toMatchObject({ state: 'applying', requestId: 'req-3', tenantId: '7', userId: '3' })
    })

    it('an applied receipt answers with its stored result and note; markApplied needs the holder [TC-AISEC-100]', async () => {
        await start('cs_1')
        await expect(markApplied('cs_1', 'someone-else', result, 'ok')).rejects.toThrow('not held')
        await markApplied('cs_1', 'req-1', result, 'ok')

        const again = await start('cs_1', 'req-2')

        expect(again).toMatchObject({ kind: 'applied', receipt: { state: 'applied', result, note: 'ok', recordedAt: null } })
    })

    it('never touches another workspace\'s receipt, and a refused apply drops only its own [TC-AISEC-100]', async () => {
        await start('cs_1', 'req-1', '7')

        expect(await start('cs_1', 'req-x', '8')).toEqual({ kind: 'busy', state: 'applying' })
        expect(await readReceipt('cs_1', '8')).toBeNull()
        await abandonApply('cs_1', 'req-other')
        expect(await readReceipt('cs_1')).not.toBeNull()
        await abandonApply('cs_1', 'req-1')
        expect(await readReceipt('cs_1')).toBeNull()
    })

    it('undo: upsert to reverted (with or without an approve receipt), reinstate back to applied [TC-AISEC-102]', async () => {
        await start('cs_1')
        await markApplied('cs_1', 'req-1', result, undefined)
        await markRecorded('cs_1', 'applied')
        const undone = { entities: [], links: [] }

        await markReverted({ changeSetId: 'cs_1', tenantId: '7', userId: 3, requestId: 'req-u', result: undone })
        await markReverted({ changeSetId: 'cs_old', tenantId: '7', userId: 3, requestId: 'req-u', result: undone })

        expect(await readReceipt('cs_1')).toMatchObject({ state: 'reverted', result: undone, recordedAt: null })
        expect(await readReceipt('cs_old')).toMatchObject({ state: 'reverted' })
        expect(await start('cs_1', 'req-2')).toEqual({ kind: 'busy', state: 'reverted' })
        await markReinstated('cs_1')
        expect(await readReceipt('cs_1')).toMatchObject({ state: 'applied' })
        expect((await readReceipt('cs_1'))!.recordedAt).not.toBeNull()
    })

    it('the sweep reads unrecorded receipts older than a minute, oldest first, within the undo window and the limit [TC-AISEC-103]', async () => {
        for (const id of ['cs_a', 'cs_b', 'cs_c', 'cs_fresh', 'cs_done', 'cs_busy', 'cs_old']) {
            await start(id)
            if (id !== 'cs_busy') await markApplied(id, 'req-1', result, undefined)
        }
        await markRecorded('cs_done', 'applied')
        await age('cs_a', 180_000)
        await age('cs_b', 300_000)
        await age('cs_c', 120_000)
        await age('cs_done', 600_000)
        await age('cs_busy', 600_000)
        await age('cs_old', 8 * 86_400_000, 'created_at')
        await age('cs_old', 8 * 86_400_000)

        expect((await unrecordedReceipts()).map((r) => r.changeSetId)).toEqual(['cs_b', 'cs_a', 'cs_c'])
        expect((await unrecordedReceipts(2)).map((r) => r.changeSetId)).toEqual(['cs_b', 'cs_a'])

        await deferReceipt('cs_b')
        await age('cs_b', 61_000)
        expect((await unrecordedReceipts()).map((r) => r.changeSetId)).toEqual(['cs_a', 'cs_c', 'cs_b'])
    })
})
