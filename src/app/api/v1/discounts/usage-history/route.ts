import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

/**
 * GET /api/v1/discounts/usage-history
 *
 * Global cross-discount usage history for the authenticated user's tenant.
 * Supports: ?page=N&limit=20
 * Sorted by usedAt desc (fixed).
 * Security: user-scoped via withAuth + overrideAccess:false (collection access returns tenant filter).
 */
export const GET = withAuth(async (user, request) => {
    try {
        const payload = await getPayload({ config })
        const url = new URL(request.url)

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1)
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20') || 20))
        const search = (url.searchParams.get('search') || '').trim()

        // Search across the WHOLE dataset (not just the current page) by discount code or order number.
        // `discountCode` is the snapshot scalar (survives delete); `discount.code` covers legacy pre-snapshot rows.
        const where: Where | undefined = search
            ? {
                  or: [
                      { discountCode: { contains: search } },
                      { 'discount.code': { contains: search } },
                      { 'order.orderNumber': { contains: search } },
                  ],
              }
            : undefined

        const result = await payload.find({
            collection: 'discount_usage_history',
            sort: '-usedAt',
            page,
            limit,
            depth: 1,
            user,
            overrideAccess: false,
            ...(where ? { where } : {}),
        })

        return NextResponse.json({ success: true, ...result })
    } catch (error: any) {
        console.error('[Discount Usage History List Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load usage history' } },
            { status: 500 },
        )
    }
})
