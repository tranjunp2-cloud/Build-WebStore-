import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sweepUnrecordedReceipts } from '@/lib/ai-platform/receipt-sweep'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// vercel.json gives every api route 120 s; the sweep stops starting receipts after 90 s (the rest wait for the next run)
export const maxDuration = 120

/** Constant-time comparison of the Authorization header with `Bearer ${CRON_SECRET}`; no secret configured = closed. */
function authorized(header: string | null, secret: string | undefined): boolean {
    if (!secret || !header) return false
    const given = Buffer.from(header)
    const wanted = Buffer.from(`Bearer ${secret}`)
    return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/**
 * GET /api/cron/ai-receipts (every 5 minutes)
 * Records on ai-platform the copilot changes prime-web applied or undid but could not report (apply receipts with
 * no `recorded_at`, older than a minute): at most 50 per run. Sends only the stored result, never applies anything.
 */
export async function GET(req: Request) {
    if (!authorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
        const result = await sweepUnrecordedReceipts()
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        console.error('[cron/ai-receipts] failed', error instanceof Error ? error.message : error)
        return NextResponse.json({ success: false, error: 'Receipt sweep failed' }, { status: 500 })
    }
}
