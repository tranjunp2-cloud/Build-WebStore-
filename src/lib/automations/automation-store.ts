/**
 * Reads and writes a workspace's automation settings (`tenants.settings_automations`, json).
 *
 * Reads go through Payload. Writes are single-column SQL updates on purpose: the cron's markers
 * (`lastRunDay`, `lastDigestDay`) and the merchant's switches live in the same json, and a Payload update of the
 * `settings` group would rewrite sibling fields (storage counters, dashboard layout) that other requests change.
 * Neither side rewrites the whole json: the form save replaces only `enabled` and `digest` (`||` on those two keys),
 * the cron merges only its markers, so a marker written while the merchant has the form open is never undone.
 * Every statement is scoped by tenant id.
 */
import { type SQL, sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { type ReportsDb, rowsOf, tenantParam } from '@/lib/reports/report-db'
import { type AutomationSettings, type AutomationSettingsInput, parseAutomationSettings } from './automation-config'

const execute = (payload: Payload, query: SQL) => (payload as unknown as ReportsDb).db.drizzle.execute(query)

export async function readAutomationSettings(payload: Payload, tenantId: string | number): Promise<AutomationSettings> {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    const settings = (tenant as { settings?: { automations?: unknown } } | null)?.settings
    return parseAutomationSettings(settings?.automations)
}

/**
 * Stores the merchant's switches (`enabled`, `digest`) in one statement; the cron's markers are untouched, whatever the
 * cron wrote meanwhile. Returns what is stored now.
 */
export async function saveAutomationSettings(
    payload: Payload,
    tenantId: string | number,
    input: AutomationSettingsInput,
): Promise<AutomationSettings> {
    const id = tenantParam(tenantId)
    const switches = JSON.stringify({ enabled: input.enabled, digest: input.digest })
    const rows = await rowsOf<{ automations: unknown }>(
        payload as unknown as ReportsDb,
        sql`UPDATE tenants SET settings_automations = COALESCE(settings_automations, '{}'::jsonb) || ${switches}::jsonb WHERE id = ${id} RETURNING settings_automations AS automations`,
    )
    return parseAutomationSettings(rows[0]?.automations)
}

/**
 * Cron marker, merged into the stored json so a switch the merchant flipped meanwhile survives.
 * (The digest day is not written here: `claimDigestDay` takes it before the emails go out.)
 */
export async function markAutomationRun(payload: Payload, tenantId: string | number, marks: { lastRunDay: string }): Promise<void> {
    const id = tenantParam(tenantId)
    const patch = JSON.stringify({ lastRunDay: marks.lastRunDay })
    await execute(payload, sql`UPDATE tenants SET settings_automations = COALESCE(settings_automations, '{}'::jsonb) || ${patch}::jsonb WHERE id = ${id}`)
}

/**
 * Takes the day's digest before anything is mailed: one statement that sets `lastDigestDay = day` only while it is
 * not `day` yet. True for the one run that got it; a run that overlaps (Vercel delivering the cron twice, an operator
 * calling it again) gets false and must not send. Trade-off: a run killed mid-send leaves the day taken, so owners not
 * mailed yet wait for the next day instead of being mailed twice.
 */
export async function claimDigestDay(payload: Payload, tenantId: string | number, day: string): Promise<boolean> {
    const id = tenantParam(tenantId)
    const rows = await rowsOf<{ id: unknown }>(
        payload as unknown as ReportsDb,
        sql`UPDATE tenants SET settings_automations = COALESCE(settings_automations, '{}'::jsonb) || jsonb_build_object('lastDigestDay', ${day}::text)
            WHERE id = ${id} AND COALESCE(settings_automations->>'lastDigestDay', '') <> ${day} RETURNING id`,
    )
    return rows.length > 0
}

/** Gives the claimed day back (every email failed) so the next pass tries again; `previous` is what was stored before. */
export async function releaseDigestDay(payload: Payload, tenantId: string | number, day: string, previous: string | null): Promise<void> {
    const id = tenantParam(tenantId)
    await execute(
        payload,
        sql`UPDATE tenants SET settings_automations = CASE WHEN ${previous}::text IS NULL THEN settings_automations - 'lastDigestDay'
                ELSE settings_automations || jsonb_build_object('lastDigestDay', ${previous}::text) END
            WHERE id = ${id} AND settings_automations->>'lastDigestDay' = ${day}`,
    )
}
