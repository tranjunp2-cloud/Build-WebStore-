/**
 * GET /api/admin/generations/export
 *
 * Downloads top 500 rows matching filters as CSV.
 * promptText is EXCLUDED from export (hash + metadata only) for privacy.
 *
 * Accepts same filter query params as /api/admin/generations.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

function escapeCell(val: unknown): string {
    const str = val === null || val === undefined ? '' : String(val)
    // Wrap in quotes if contains comma, newline, or quote; escape inner quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function toRow(cols: unknown[]): string {
    return cols.map(escapeCell).join(',')
}

const CSV_HEADERS = [
    'id',
    'createdAt',
    'completedAt',
    'status',
    'endpoint',
    'category',
    'promptMode',
    'promptHash',
    'durationMs',
    'costUsd',
    'userId',
    'siteId',
    'errorLog',
]

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const sp = req.nextUrl.searchParams

    const status = sp.get('status') ?? ''
    const endpoint = sp.get('endpoint') ?? ''
    const category = sp.get('category') ?? ''
    const dateFrom = sp.get('dateFrom') ?? ''
    const dateTo = sp.get('dateTo') ?? ''
    const userId = sp.get('userId') ?? ''

    const where: Where = {}

    if (status && status !== 'all') where.status = { equals: status }
    if (endpoint) where.endpoint = { like: endpoint }
    if (category) where.category = { like: category }
    if (userId) where.user = { equals: Number(userId) }
    if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) (where.createdAt as Record<string, unknown>).greater_than_equal = dateFrom
        if (dateTo) (where.createdAt as Record<string, unknown>).less_than_equal = dateTo
    }

    const payload = await getPayload({ config })

    const result = await payload.find({
        collection: 'ai-generation-records',
        where,
        sort: '-createdAt',
        limit: 500,
        depth: 0, // no relationship expansion — ids only
    })

    const lines: string[] = [toRow(CSV_HEADERS)]

    type DocRow = Record<string, unknown>
    for (const doc of result.docs) {
        const d = doc as DocRow
        lines.push(toRow([
            d.id,
            d.createdAt,
            d.completedAt ?? '',
            d.status,
            d.endpoint,
            d.category ?? '',
            d.promptMode,
            d.promptHash ?? '',
            d.durationMs ?? '',
            d.costUsd ?? '',
            d.user ?? '',
            d.site ?? '',
            // errorLog: truncate to 200 chars in export
            d.errorLog ? String(d.errorLog).slice(0, 200) : '',
        ]))
    }

    const csv = lines.join('\n')
    const timestamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="generations-${timestamp}.csv"`,
            'Cache-Control': 'no-store',
        },
    })
})
