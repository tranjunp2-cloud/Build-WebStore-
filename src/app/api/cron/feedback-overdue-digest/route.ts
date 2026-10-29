import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { PRODUCTION_TABLE_ID } from '@/lib/feedback/feedback-card-config'
import {
    buildOverdueCard, DIGEST_FIELD_NAMES, isMondayInMalaysia, OPEN_FILTER, selectOverdue, selectStale,
} from '@/lib/feedback/feedback-overdue-digest'
import { LarkApiError, searchBaseRecords, sendChatCard } from '@/lib/lark/lark-base-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Constant-time comparison of the Authorization header with `Bearer ${CRON_SECRET}`. */
function authorized(header: string | null, secret: string | undefined): boolean {
    if (!secret || !header) return false
    const given = Buffer.from(header)
    const wanted = Buffer.from(`Bearer ${secret}`)
    return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/**
 * GET /api/cron/feedback-overdue-digest (vercel.json: 01:00 UTC = 09:00 Malaysia)
 * One card in the team group listing production feedback with no reply after 24h; on Mondays also items open
 * over 7 days. Silent when there is nothing to list. Production table only: a deployment pointed at the
 * staging table does nothing. Fails closed without a valid CRON_SECRET.
 */
export async function GET(req: Request) {
    if (!authorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const appToken = process.env.LARK_BASE_APP_TOKEN
    const chatId = process.env.LARK_NOTIFY_CHAT_ID
    if (!appToken || !chatId || process.env.LARK_BASE_REPORT_TABLE_ID !== PRODUCTION_TABLE_ID) {
        return NextResponse.json({ data: { skipped: true } })
    }

    try {
        const rows = await searchBaseRecords({ appToken, tableId: PRODUCTION_TABLE_ID, filter: OPEN_FILTER, fieldNames: DIGEST_FIELD_NAMES })
        const now = Date.now()
        const overdue = selectOverdue(rows, now)
        const stale = isMondayInMalaysia(now) ? selectStale(rows, now) : []
        if (!overdue.length && !stale.length) return NextResponse.json({ data: { overdue: 0, stale: 0, notified: false } })

        await sendChatCard(chatId, buildOverdueCard(appToken, PRODUCTION_TABLE_ID, overdue, stale))
        return NextResponse.json({ data: { overdue: overdue.length, stale: stale.length, notified: true } })
    } catch (err) {
        const code = err instanceof LarkApiError ? err.code : null
        console.error('[feedback-digest] failed', { name: (err as Error).name, code })
        return NextResponse.json({ error: 'Digest failed' }, { status: 502 })
    }
}
