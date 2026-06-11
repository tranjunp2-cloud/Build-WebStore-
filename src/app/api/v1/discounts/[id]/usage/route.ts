import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/discounts/[id]/usage
 *
 * Read-only usage history for a discount, newest-first.
 * Access enforced via discount_usage_history collection (tenant-scoped read).
 */
export const GET = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const url = new URL(request.url)
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)

        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'discount_usage_history',
            where: { discount: { equals: id } },
            sort: '-usedAt',
            page,
            limit,
            depth: 1,
            user,
            overrideAccess: false,
        })

        // Response carries customerEmail (PII) — never let a shared cache/proxy store it.
        return NextResponse.json({ ...result, success: true }, {
            headers: { 'Cache-Control': 'private, no-store' },
        })
    } catch (error: any) {
        console.error('[Discount Usage History Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load usage history' } },
            { status: 500 },
        )
    }
})
