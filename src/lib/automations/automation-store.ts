/**
 * Writes the cron's marker into a workspace's automation settings (`tenants.settings_automations`, json).
 *
 * A single-column SQL update on purpose: a Payload update of the `settings` group would rewrite sibling fields
 * (storage counters, dashboard layout) that other requests change. The marker is merged into the stored json, so
 * switches stored there survive. Scoped by tenant id.
 */
import { type SQL, sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { type ReportsDb, tenantParam } from '@/lib/reports/report-db'

const execute = (payload: Payload, query: SQL) => (payload as unknown as ReportsDb).db.drizzle.execute(query)

/** Cron marker: this workspace is finished for the shop day. */
export async function markAutomationRun(payload: Payload, tenantId: string | number, marks: { lastRunDay: string }): Promise<void> {
    const id = tenantParam(tenantId)
    const patch = JSON.stringify({ lastRunDay: marks.lastRunDay })
    await execute(payload, sql`UPDATE tenants SET settings_automations = COALESCE(settings_automations, '{}'::jsonb) || ${patch}::jsonb WHERE id = ${id}`)
}
