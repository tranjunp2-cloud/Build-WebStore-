// @vitest-environment node
/**
 * TC-AICP-233 — the cron's marker on PostgreSQL: it is merged into what the workspace stored (stored switches
 * survive), creates the json for a workspace that never stored settings, and is scoped to its own workspace.
 * TC-AICP-234 — the cron's listing SQL: only active / trialing workspaces with a usable website, a workspace finished
 * today is skipped (and picked up again tomorrow, or with force), cursor and single-workspace filters, and the real
 * batch marks the day through the real marker SQL. TEMP tables (helpers/ops-temp-schema.ts); skipped without DATABASE_URI.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createOpsTempSchema } from '../helpers/ops-temp-schema'

const run = vi.hoisted(() => ({ runTenantAutomations: vi.fn() }))
vi.mock('@/lib/automations/automation-runner', () => run)

import { runAutomationBatch } from '@/lib/automations/automation-batch'
import { markAutomationRun } from '@/lib/automations/automation-store'

const connectionString = process.env.DATABASE_URI
const NOW = new Date('2026-10-27T01:00:00Z') // 2026-10-27 in Kuala Lumpur
describe.skipIf(!connectionString)('[TC-AICP-233/234] shop automations on PostgreSQL', () => {
    let pool: Pool
    let payload: { db: { drizzle: ReturnType<typeof drizzle> } }

    beforeAll(async () => {
        pool = new Pool({ connectionString, ssl: false, max: 1 })
        await createOpsTempSchema(pool)
        await pool.query(`
            CREATE TYPE pg_temp.enum_tenants_status AS ENUM ('active','trialing','past_due','cancelled','suspended');
            CREATE TEMP TABLE tenants (id integer PRIMARY KEY, name varchar, status pg_temp.enum_tenants_status NOT NULL DEFAULT 'active', settings_automations jsonb);
        `)
        payload = { db: { drizzle: drizzle(pool) } }
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
    })
    beforeEach(async () => {
        await pool.query('DELETE FROM tenants; DELETE FROM sites;')
        run.runTenantAutomations.mockReset()
        run.runTenantAutomations.mockImplementation(async (_p: unknown, tenant: { id: number }) => ({ tenantId: tenant.id, status: 'done', reminders: 1, notifications: 1 }))
    })

    const tenant = (id: number, over: { status?: string; automations?: unknown; site?: string | null | false } = {}) =>
        pool.query('INSERT INTO tenants (id, name, status, settings_automations) VALUES ($1, $2, $3, $4)', [id, `Shop ${id}`, over.status ?? 'active', over.automations == null ? null : JSON.stringify(over.automations)])
            .then(() => (over.site === false ? null : pool.query('INSERT INTO sites (tenant_id, generation_status) VALUES ($1, $2)', [id, over.site === undefined ? 'completed' : over.site])))
    const stored = async (id: number) => (await pool.query('SELECT settings_automations FROM tenants WHERE id = $1', [id])).rows[0].settings_automations
    const visited = () => run.runTenantAutomations.mock.calls.map(([, t]) => t.id)

    describe('marker [TC-AICP-233]', () => {
        it('merges the marker into the stored switches, and creates the json for a workspace that stored nothing', async () => {
            await tenant(1, { automations: { enabled: { stock: false }, lastRunDay: '2026-10-26' } })
            await tenant(2)

            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-27' })
            await markAutomationRun(payload as never, 2, { lastRunDay: '2026-10-27' })

            expect(await stored(1)).toEqual({ enabled: { stock: false }, lastRunDay: '2026-10-27' })
            expect(await stored(2)).toEqual({ lastRunDay: '2026-10-27' })
        })

        it('touches only its own workspace', async () => {
            await tenant(1)
            await tenant(2, { automations: { enabled: { stock: false } } })

            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-27' })

            expect(await stored(2)).toEqual({ enabled: { stock: false } })
        })

        it('refuses a tenant id that is not a positive integer before any SQL', async () => {
            await expect(markAutomationRun(payload as never, 0, { lastRunDay: '2026-10-27' })).rejects.toThrow('valid tenant id')
            await expect(markAutomationRun(payload as never, '1; DROP TABLE tenants', { lastRunDay: '2026-10-27' })).rejects.toThrow('valid tenant id')
        })
    })

    describe('listing and markers [TC-AICP-234]', () => {
        it('visits active and trialing workspaces that have a usable website, in id order', async () => {
            await tenant(1)
            await tenant(2, { status: 'trialing', site: 'none' })
            await tenant(3, { status: 'cancelled' })
            await tenant(4, { status: 'suspended' })
            await tenant(5, { site: false })
            await tenant(6, { site: 'generating' })
            await tenant(7, { site: 'failed' })
            await tenant(8, { status: 'past_due' })

            const result = await runAutomationBatch(payload as never, { now: NOW })

            expect(visited()).toEqual([1, 2])
            expect(result).toMatchObject({ scanned: 2, done: 2, complete: true })
        })

        it('marks the day done, then skips the workspace until tomorrow (or force)', async () => {
            await tenant(1)
            await tenant(2, { automations: { enabled: { stock: false } } })

            await runAutomationBatch(payload as never, { now: NOW })
            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
            expect(await stored(2)).toMatchObject({ enabled: { stock: false }, lastRunDay: '2026-10-27' })

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000) })
            expect(visited()).toEqual([])

            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000), force: true })
            expect(visited()).toEqual([1, 2])

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 86_400_000) })
            expect(visited()).toEqual([1, 2])
        })

        it('uses the Kuala Lumpur day for the marker (00:30 KL is still the previous UTC day)', async () => {
            await tenant(1)

            await runAutomationBatch(payload as never, { now: new Date('2026-10-26T16:30:00Z') })

            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
        })

        it('continues after the cursor and can target one workspace', async () => {
            for (const id of [1, 2, 3]) await tenant(id)

            await runAutomationBatch(payload as never, { now: NOW, cursor: 1 })
            expect(visited()).toEqual([2, 3])

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: NOW, tenantId: 3, force: true })
            expect(visited()).toEqual([3])
        })

        it('leaves a workspace unmarked when the run asks for a retry', async () => {
            await tenant(1)
            run.runTenantAutomations.mockResolvedValueOnce({ tenantId: 1, status: 'retry_later', reminders: 1, notifications: 1 })

            await runAutomationBatch(payload as never, { now: NOW })

            expect(await stored(1)).toBeNull()
        })

        it('marks a workspace with nothing due or nobody to tell as finished, so the next pass skips it', async () => {
            await tenant(1)
            await tenant(2)
            run.runTenantAutomations
                .mockResolvedValueOnce({ tenantId: 1, status: 'nothing_due', reminders: 0, notifications: 0 })
                .mockResolvedValueOnce({ tenantId: 2, status: 'no_recipients', reminders: 0, notifications: 0 })

            await runAutomationBatch(payload as never, { now: NOW })
            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000) })

            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
            expect(visited()).toEqual([])
        })
    })
})
