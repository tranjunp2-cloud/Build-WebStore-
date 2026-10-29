/**
 * GET /api/admin/ai-usage/export?period|from&to&q&plan&area&task&model&outcome&unpriced&shop
 * CSV of the AI calls the Logs screen would show for the same filters (up to 50,000 rows). Super-admin only.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { checkRateLimit, withSuperAdmin } from '@/lib/admin/api-utils'
import { buildCsv } from '@/lib/admin/ai-usage/csv'
import { EXPORT_MAX_ROWS, parseLogFilters } from '@/lib/admin/ai-usage/log-filters'
import { getLogRows } from '@/lib/admin/ai-usage/log-queries'
import { resolvePeriod } from '@/lib/admin/ai-usage/period'
import type { ReportsDb } from '@/lib/admin/ai-usage/sql-parts'

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!checkRateLimit(`ai-usage-export:${ip}`, 5)) {
        return NextResponse.json({ error: 'Rate limit exceeded: max 5 exports per minute' }, { status: 429 })
    }
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const period = resolvePeriod(params)
    const filters = parseLogFilters(params)
    try {
        const payload = await getPayload({ config })
        const rows = await getLogRows(payload as unknown as ReportsDb, filters, period, EXPORT_MAX_ROWS)
        return new NextResponse(buildCsv(rows), {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="ai-usage-${period.fromDay}-to-${period.toDay}.csv"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('[ai-usage-export] failed', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
})
