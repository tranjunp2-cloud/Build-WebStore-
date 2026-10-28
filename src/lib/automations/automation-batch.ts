/**
 * The cron's work: walks the workspaces that have a usable website and runs their automations, within a time
 * budget. Resumable without a stored cursor: a workspace that was finished today carries `lastRunDay = today` in its
 * settings and is skipped, so a second pass (the cron is scheduled twice, or an operator calls it again) continues
 * with whoever is left. `cursor` only lets one pass page forward.
 */
import { type SQL, sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { type ReportsDb, num, rowsOf } from '@/lib/reports/report-db'
import { parseAutomationSettings, shopDay } from './automation-config'
import { markAutomationRun } from './automation-store'
import { runTenantAutomations, type TenantRunResult } from './automation-runner'

export const DEFAULT_BUDGET_MS = 100_000
export const DEFAULT_MAX_EMAILS = 300
const PAGE_SIZE = 25
const CONCURRENCY = 4

export interface BatchOptions {
    now: Date
    baseUrl: string
    /** Stop starting new workspaces after this long (default 100 s, under the 120 s limit vercel.json gives every api route) */
    budgetMs?: number
    /** Only workspaces with an id above this one */
    cursor?: number
    /** Run just this workspace (operators / tests) */
    tenantId?: number
    /** Ignore the "finished today" marker (dedupe keys still keep the day's notifications unique) */
    force?: boolean
    maxEmails?: number
}

export interface BatchResult {
    day: string
    scanned: number
    notifications: number
    digests: number
    done: number
    nothingDue: number
    noRecipients: number
    retryLater: number
    failed: number
    /** true when every eligible workspace was visited */
    complete: boolean
    nextCursor: number | null
    tookMs: number
}

type TenantRow = { id: number; name: string | null; automations: unknown }

async function listTenants(payload: Payload, day: string, o: Pick<BatchOptions, 'cursor' | 'tenantId' | 'force'>): Promise<TenantRow[]> {
    const filters: SQL[] = [
        sql`t.id > ${o.cursor ?? 0}`,
        sql`t.status::text IN ('active', 'trialing')`,
        sql`EXISTS (SELECT 1 FROM sites s WHERE s.tenant_id = t.id AND (s.generation_status IS NULL OR s.generation_status::text IN ('completed', 'none')))`,
    ]
    if (o.tenantId != null) filters.push(sql`t.id = ${o.tenantId}`)
    if (!o.force) filters.push(sql`COALESCE(t.settings_automations->>'lastRunDay', '') <> ${day}`)
    const rows = await rowsOf<Record<string, unknown>>(
        payload as unknown as ReportsDb,
        sql`SELECT t.id, t.name, t.settings_automations AS automations FROM tenants t WHERE ${sql.join(filters, sql` AND `)} ORDER BY t.id LIMIT ${PAGE_SIZE}`,
    )
    return rows.map((row) => ({ id: num(row.id), name: (row.name as string | null) ?? null, automations: row.automations }))
}

export async function runAutomationBatch(payload: Payload, options: BatchOptions): Promise<BatchResult> {
    const started = Date.now()
    const budget = options.budgetMs ?? DEFAULT_BUDGET_MS
    const day = shopDay(options.now)
    const emailBudget = { left: options.maxEmails ?? DEFAULT_MAX_EMAILS }
    const result: BatchResult = { day, scanned: 0, notifications: 0, digests: 0, done: 0, nothingDue: 0, noRecipients: 0, retryLater: 0, failed: 0, complete: true, nextCursor: null, tookMs: 0 }
    let cursor = options.cursor ?? 0

    const outOfTime = () => Date.now() - started >= budget

    const handle = async (tenant: TenantRow) => {
        let outcome: TenantRunResult
        try {
            outcome = await runTenantAutomations(payload, tenant, parseAutomationSettings(tenant.automations), { now: options.now, emailBudget, baseUrl: options.baseUrl })
            // a workspace with nothing due or nobody to tell is finished for today too: later passes skip it instead of visiting it again
            if (outcome.status === 'done' || outcome.status === 'nothing_due' || outcome.status === 'no_recipients') await markAutomationRun(payload, tenant.id, { lastRunDay: day })
        } catch (error) {
            result.failed += 1
            console.error(`[shop-automations] tenant ${tenant.id} failed`, error instanceof Error ? error.message : error)
            return
        }
        result.notifications += outcome.notifications
        result.digests += outcome.digests
        if (outcome.status === 'done') result.done += 1
        else if (outcome.status === 'nothing_due') result.nothingDue += 1
        else if (outcome.status === 'no_recipients') result.noRecipients += 1
        else result.retryLater += 1
    }

    while (true) {
        if (outOfTime()) { result.complete = false; break }
        const page = await listTenants(payload, day, { cursor, tenantId: options.tenantId, force: options.force })
        if (page.length === 0) break
        let next = 0
        let claimedUpTo = cursor
        const worker = async () => {
            while (next < page.length && !outOfTime()) {
                const tenant = page[next++]
                claimedUpTo = Math.max(claimedUpTo, tenant.id)
                result.scanned += 1
                await handle(tenant)
            }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, page.length) }, worker))
        cursor = claimedUpTo
        if (next < page.length) { result.complete = false; break }
        if (page.length < PAGE_SIZE || options.tenantId != null) break
    }
    result.nextCursor = result.complete ? null : cursor
    result.tookMs = Date.now() - started
    return result
}
