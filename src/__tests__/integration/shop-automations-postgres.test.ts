// @vitest-environment node
/**
 * TC-AICP-233 — automation settings storage on PostgreSQL: a save keeps the cron's markers (even ones written after
 * the form was read), the markers merge into what the merchant stored (their switches survive), every statement is
 * scoped to its own workspace.
 * TC-AICP-276 — the digest claim on PostgreSQL: of two overlapping runs exactly one gets the day, the day can be
 * given back when every email failed (to the previous value or none), another day's claim is not touched.
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
import { defaultAutomationSettings } from '@/lib/automations/automation-config'
import { claimDigestDay, markAutomationRun, readAutomationSettings, releaseDigestDay, saveAutomationSettings } from '@/lib/automations/automation-store'

const connectionString = process.env.DATABASE_URI
const NOW = new Date('2026-10-27T01:00:00Z') // 2026-10-27 in Kuala Lumpur
const INPUT = {
    enabled: { discounts: true, stock: false, orders_waiting: true, leads: true, site_health: false },
    digest: { enabled: true, frequency: 'weekly' as const },
}

describe.skipIf(!connectionString)('[TC-AICP-233/234/276] shop automations on PostgreSQL', () => {
    let pool: Pool
    let payload: { db: { drizzle: ReturnType<typeof drizzle> }; findByID: (args: { id: number | string }) => Promise<unknown> }

    beforeAll(async () => {
        pool = new Pool({ connectionString, ssl: false, max: 1 })
        await createOpsTempSchema(pool)
        await pool.query(`
            CREATE TYPE pg_temp.enum_tenants_status AS ENUM ('active','trialing','past_due','cancelled','suspended');
            CREATE TEMP TABLE tenants (id integer PRIMARY KEY, name varchar, status pg_temp.enum_tenants_status NOT NULL DEFAULT 'active', settings_automations jsonb);
        `)
        payload = {
            db: { drizzle: drizzle(pool) },
            findByID: async ({ id }) => {
                const { rows } = await pool.query('SELECT settings_automations FROM tenants WHERE id = $1', [id])
                return { settings: { automations: rows[0]?.settings_automations ?? null } }
            },
        }
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
    })
    beforeEach(async () => {
        await pool.query('DELETE FROM tenants; DELETE FROM sites;')
        run.runTenantAutomations.mockReset()
        run.runTenantAutomations.mockImplementation(async (_p: unknown, tenant: { id: number }) => ({ tenantId: tenant.id, status: 'done', reminders: 1, notifications: 1, digests: 0, digestFailures: 0, digestSent: false }))
    })

    const tenant = (id: number, over: { status?: string; automations?: unknown; site?: string | null | false } = {}) =>
        pool.query('INSERT INTO tenants (id, name, status, settings_automations) VALUES ($1, $2, $3, $4)', [id, `Shop ${id}`, over.status ?? 'active', over.automations == null ? null : JSON.stringify(over.automations)])
            .then(() => (over.site === false ? null : pool.query('INSERT INTO sites (tenant_id, generation_status) VALUES ($1, $2)', [id, over.site === undefined ? 'completed' : over.site])))
    const stored = async (id: number) => (await pool.query('SELECT settings_automations FROM tenants WHERE id = $1', [id])).rows[0].settings_automations
    const visited = () => run.runTenantAutomations.mock.calls.map(([, t]) => t.id)

    describe('storage [TC-AICP-233]', () => {
        it('reads the defaults for a workspace that never saved, and what was saved after', async () => {
            await tenant(1)
            expect(await readAutomationSettings(payload as never, 1)).toEqual(defaultAutomationSettings())

            await saveAutomationSettings(payload as never, 1, INPUT)

            expect(await readAutomationSettings(payload as never, 1)).toMatchObject({ enabled: INPUT.enabled, digest: INPUT.digest, lastRunDay: null })
        })

        it('keeps the cron markers when the merchant saves, and the merchant\'s switches when the cron marks', async () => {
            await tenant(1)
            await saveAutomationSettings(payload as never, 1, INPUT)
            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-27' })
            await claimDigestDay(payload as never, 1, '2026-10-27')

            const afterMark = await readAutomationSettings(payload as never, 1)
            expect(afterMark).toMatchObject({ enabled: INPUT.enabled, digest: INPUT.digest, lastRunDay: '2026-10-27', lastDigestDay: '2026-10-27' })

            await saveAutomationSettings(payload as never, 1, { ...INPUT, digest: { enabled: false, frequency: 'daily' } })
            expect(await readAutomationSettings(payload as never, 1)).toMatchObject({ digest: { enabled: false, frequency: 'daily' }, lastRunDay: '2026-10-27', lastDigestDay: '2026-10-27' })

            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-28' })
            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-28', lastDigestDay: '2026-10-27' })
        })

        it('a save does not undo a marker the cron wrote after the form was read', async () => {
            await tenant(1)
            await saveAutomationSettings(payload as never, 1, INPUT)
            // the merchant opens the form (reads), the cron finishes the workspace, then the merchant presses Save
            const opened = await readAutomationSettings(payload as never, 1)
            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-27' })
            await claimDigestDay(payload as never, 1, '2026-10-27')
            expect(opened.lastRunDay).toBeNull()

            const saved = await saveAutomationSettings(payload as never, 1, { ...INPUT, enabled: { ...INPUT.enabled, stock: true } })

            expect(saved).toMatchObject({ lastRunDay: '2026-10-27', lastDigestDay: '2026-10-27', enabled: { stock: true } })
            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27', lastDigestDay: '2026-10-27' })
        })

        it('a first save on a workspace that never stored settings creates them', async () => {
            await tenant(1)

            const saved = await saveAutomationSettings(payload as never, 1, INPUT)

            expect(saved).toMatchObject({ enabled: INPUT.enabled, digest: INPUT.digest, lastRunDay: null })
            expect(await stored(1)).toEqual({ enabled: INPUT.enabled, digest: INPUT.digest })
        })

        it('touches only its own workspace', async () => {
            await tenant(1)
            await tenant(2, { automations: { enabled: { stock: false } } })

            await saveAutomationSettings(payload as never, 1, INPUT)
            await markAutomationRun(payload as never, 1, { lastRunDay: '2026-10-27' })

            expect(await stored(2)).toEqual({ enabled: { stock: false } })
        })

        it('refuses a tenant id that is not a positive integer before any SQL', async () => {
            await expect(saveAutomationSettings(payload as never, "1; DROP TABLE tenants", INPUT)).rejects.toThrow('valid tenant id')
            await expect(markAutomationRun(payload as never, 0, { lastRunDay: '2026-10-27' })).rejects.toThrow('valid tenant id')
            await expect(claimDigestDay(payload as never, '1 OR 1=1', '2026-10-27')).rejects.toThrow('valid tenant id')
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

            const result = await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test' })

            expect(visited()).toEqual([1, 2])
            expect(result).toMatchObject({ scanned: 2, done: 2, complete: true })
        })

        it('marks the day done, then skips the workspace until tomorrow (or force)', async () => {
            await tenant(1)
            await tenant(2, { automations: { enabled: { stock: false } } })

            await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test' })
            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
            expect(await stored(2)).toMatchObject({ enabled: { stock: false }, lastRunDay: '2026-10-27' })

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000), baseUrl: 'https://shop.test' })
            expect(visited()).toEqual([])

            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000), baseUrl: 'https://shop.test', force: true })
            expect(visited()).toEqual([1, 2])

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 86_400_000), baseUrl: 'https://shop.test' })
            expect(visited()).toEqual([1, 2])
        })

        it('uses the Kuala Lumpur day for the marker (00:30 KL is still the previous UTC day)', async () => {
            await tenant(1)

            await runAutomationBatch(payload as never, { now: new Date('2026-10-26T16:30:00Z'), baseUrl: 'https://shop.test' })

            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
        })

        it('continues after the cursor and can target one workspace', async () => {
            for (const id of [1, 2, 3]) await tenant(id)

            await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test', cursor: 1 })
            expect(visited()).toEqual([2, 3])

            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test', tenantId: 3, force: true })
            expect(visited()).toEqual([3])
        })

        it('leaves a workspace unmarked when the run asks for a retry', async () => {
            await tenant(1)
            run.runTenantAutomations.mockResolvedValueOnce({ tenantId: 1, status: 'retry_later', reminders: 1, notifications: 1, digests: 0, digestFailures: 1, digestSent: false })

            await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test' })

            expect(await stored(1)).toBeNull()
        })

        it('marks a workspace with nothing due or nobody to tell as finished, so the next pass skips it', async () => {
            await tenant(1)
            await tenant(2)
            run.runTenantAutomations
                .mockResolvedValueOnce({ tenantId: 1, status: 'nothing_due', reminders: 0, notifications: 0, digests: 0, digestFailures: 0, digestSent: false })
                .mockResolvedValueOnce({ tenantId: 2, status: 'no_recipients', reminders: 0, notifications: 0, digests: 0, digestFailures: 0, digestSent: false })

            await runAutomationBatch(payload as never, { now: NOW, baseUrl: 'https://shop.test' })
            run.runTenantAutomations.mockClear()
            await runAutomationBatch(payload as never, { now: new Date(NOW.getTime() + 3_600_000), baseUrl: 'https://shop.test' })

            expect(await stored(1)).toMatchObject({ lastRunDay: '2026-10-27' })
            expect(visited()).toEqual([])
        })
    })

    describe('digest claim [TC-AICP-276]', () => {
        it('gives the day to exactly one of two overlapping runs', async () => {
            await tenant(1)

            const claims = await Promise.all([claimDigestDay(payload as never, 1, '2026-10-27'), claimDigestDay(payload as never, 1, '2026-10-27')])

            expect(claims.filter(Boolean)).toHaveLength(1)
            expect(await stored(1)).toMatchObject({ lastDigestDay: '2026-10-27' })
            expect(await claimDigestDay(payload as never, 1, '2026-10-27')).toBe(false)
        })

        it('claims a new day over yesterday\'s and keeps the merchant\'s switches', async () => {
            await tenant(1, { automations: { enabled: { stock: false }, lastDigestDay: '2026-10-26' } })

            expect(await claimDigestDay(payload as never, 1, '2026-10-27')).toBe(true)

            expect(await stored(1)).toEqual({ enabled: { stock: false }, lastDigestDay: '2026-10-27' })
        })

        it('gives the day back to the previous value, or removes it when there was none', async () => {
            await tenant(1, { automations: { lastDigestDay: '2026-10-20' } })
            await tenant(2)
            await claimDigestDay(payload as never, 1, '2026-10-27')
            await claimDigestDay(payload as never, 2, '2026-10-27')

            await releaseDigestDay(payload as never, 1, '2026-10-27', '2026-10-20')
            await releaseDigestDay(payload as never, 2, '2026-10-27', null)

            expect(await stored(1)).toEqual({ lastDigestDay: '2026-10-20' })
            expect(await stored(2)).toEqual({})
            // and it can be claimed again by the retry
            expect(await claimDigestDay(payload as never, 2, '2026-10-27')).toBe(true)
        })

        it('does not release a day it does not hold', async () => {
            await tenant(1, { automations: { lastDigestDay: '2026-10-28' } })

            await releaseDigestDay(payload as never, 1, '2026-10-27', null)

            expect(await stored(1)).toEqual({ lastDigestDay: '2026-10-28' })
        })
    })
})
