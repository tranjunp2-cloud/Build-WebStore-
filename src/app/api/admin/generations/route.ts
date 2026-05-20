/**
 * GET /api/admin/generations — paginated list with filters
 *
 * Query params:
 *   status    running|success|failed
 *   endpoint  text (partial match)
 *   category  text (partial match)
 *   dateFrom  ISO date string
 *   dateTo    ISO date string
 *   userId    number
 *   search    text (searches endpoint + category)
 *   page      number (default 1)
 *   limit     number (default 50, max 100)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const sp = req.nextUrl.searchParams

    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(sp.get('limit') ?? 50)))
    const status = sp.get('status') ?? ''
    const endpoint = sp.get('endpoint') ?? ''
    const category = sp.get('category') ?? ''
    const dateFrom = sp.get('dateFrom') ?? ''
    const dateTo = sp.get('dateTo') ?? ''
    const userId = sp.get('userId') ?? ''
    const search = sp.get('search') ?? ''

    const where: Where = {}

    if (status && status !== 'all') {
        where.status = { equals: status }
    }

    if (endpoint) {
        where.endpoint = { like: endpoint }
    }

    if (category) {
        where.category = { like: category }
    }

    if (userId) {
        where.user = { equals: Number(userId) }
    }

    if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) (where.createdAt as Record<string, unknown>).greater_than_equal = dateFrom
        if (dateTo) (where.createdAt as Record<string, unknown>).less_than_equal = dateTo
    }

    if (search) {
        where.or = [
            { endpoint: { like: search } },
            { category: { like: search } },
        ]
    }

    const payload = await getPayload({ config })

    const result = await payload.find({
        collection: 'ai-generation-records',
        where,
        sort: '-createdAt',
        page,
        limit,
        depth: 1,
    })

    return NextResponse.json({
        data: result.docs,
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page,
            limit: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        },
    })
})
