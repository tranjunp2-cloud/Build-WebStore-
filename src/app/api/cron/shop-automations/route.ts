import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { runAutomationBatch } from '@/lib/automations/automation-batch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// vercel.json gives every api route 120 s; the batch stops starting workspaces after 100 s (resumable, see below).
export const maxDuration = 120

/** Constant-time comparison of the Authorization header with `Bearer ${CRON_SECRET}`. */
function authorized(header: string | null, secret: string | undefined): boolean {
    if (!secret || !header) return false
    const given = Buffer.from(header)
    const wanted = Buffer.from(`Bearer ${secret}`)
    return given.length === wanted.length && timingSafeEqual(given, wanted)
}

const positiveInt = (value: string | null): number | undefined => {
    if (!value || !/^\d{1,9}$/.test(value)) return undefined
    const n = Number(value)
    return n > 0 ? n : undefined
}

/**
 * GET /api/cron/shop-automations
 * Scheduled reminders for the shop copilot (discount codes ending, stock, orders and messages waiting, weekly
 * website health): one in-app notification per automation per day for each owner / admin, plus the digest email
 * for workspaces that turned it on. Fails closed without a valid CRON_SECRET. Follows the copilot switch: while
 * the assistant is off (isAiAgentEnabled, e.g. production without AI_AGENT_ENABLED=true) nothing is sent.
 *
 * Optional query: `cursor=<tenantId>` continue after that workspace, `tenant=<id>` one workspace only,
 * `force=1` ignore the "finished today" marker (the day's notifications are still never duplicated).
 * Resumable: finished workspaces carry today's marker, so calling the route again continues with the rest.
 */
export async function GET(req: Request) {
    if (!authorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // The reminders link into the assistant ("/orders?todo=…"), so they only go out where it runs.
    if (!isAiAgentEnabled()) {
        return NextResponse.json({ success: true, skipped: 'ai_agent_disabled' })
    }

    try {
        const url = new URL(req.url)
        const payload = await getPayload({ config })
        const result = await runAutomationBatch(payload, {
            now: new Date(),
            baseUrl: (process.env.NEXT_PUBLIC_SERVER_URL || url.origin).replace(/\/$/, ''),
            cursor: positiveInt(url.searchParams.get('cursor')),
            tenantId: positiveInt(url.searchParams.get('tenant')),
            force: url.searchParams.get('force') === '1',
        })
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        console.error('[cron/shop-automations] failed', error instanceof Error ? error.message : error)
        return NextResponse.json({ success: false, error: 'Automation run failed' }, { status: 500 })
    }
}
