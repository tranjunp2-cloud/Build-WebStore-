import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { syncUsageEvents, usageSyncUnconfigured } from '@/lib/ai-platform/usage-sync'
import { type AlertRunResult, runCapAlerts } from '@/lib/admin/ai-caps/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// vercel.json gives every api route 120 s; the sync stops fetching pages after 60 s
export const maxDuration = 120

/** Constant-time comparison of the Authorization header with `Bearer ${CRON_SECRET}`; no secret configured = closed. */
function authorized(header: string | null, secret: string | undefined): boolean {
    if (!secret || !header) return false
    const given = Buffer.from(header)
    const wanted = Buffer.from(`Bearer ${secret}`)
    return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/**
 * GET /api/cron/ai-usage-sync (every 5 minutes)
 * Copies new rows of the ai-platform usage ledger into `ai-usage-logs` (super-admin list in Payload admin).
 * Idempotent: the ledger row id is unique on the copy. Without the AI platform configured it does nothing.
 * After the copy it checks the platform / shop spend against the AI caps and records threshold crossings in
 * `ai-cap-alerts` (plus a Lark message when LARK_WEBHOOK_AI_ALERTS is set); a failure there is reported as
 * `alerts: { error }` and never fails the sync.
 * `?from=0` re-copies from the first ledger row and refreshes existing rows (backfill after new columns); a run is
 * capped at 20 pages, so call again with `?from=<cursor>` until `fetched` is below a full page.
 */
export async function GET(req: Request) {
    if (!authorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const reason = usageSyncUnconfigured()
    if (reason) return NextResponse.json({ skipped: true, reason })
    try {
        const fromParam = new URL(req.url).searchParams.get('from')
        const from = fromParam !== null && /^\d+$/.test(fromParam) ? Number(fromParam) : undefined
        const result = await syncUsageEvents(Date.now, from === undefined ? {} : { from })
        let alerts: AlertRunResult | { error: string }
        try {
            alerts = await runCapAlerts()
        } catch (error) {
            console.error('[cron/ai-usage-sync] cap alerts failed', error instanceof Error ? error.message : error)
            alerts = { error: 'Cap alerts failed' }
        }
        return NextResponse.json({ success: true, ...result, alerts })
    } catch (error) {
        console.error('[cron/ai-usage-sync] failed', error instanceof Error ? error.message : error)
        return NextResponse.json({ success: false, error: 'Usage sync failed' }, { status: 500 })
    }
}
