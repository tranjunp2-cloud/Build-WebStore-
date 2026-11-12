import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { tenantIdForQuery } from '@/lib/auth/tenant-id'
import { jsonWithEtag } from '@/lib/api/json-etag'
import { ORDER_STATUS_GROUPS } from '@/lib/orders/status-groups'
import {
    getViewerPeriodStart,
    normalizeViewerTimeZone,
} from '@/lib/viewer-timezone'

/**
 * Fields of the orders' relations the Orders list, detail panel and bulk actions read
 * (`order.tenant.id` / `easyParcelIntegration`, `paymentVerifiedBy.email`, `paymentProofImage.url`,
 * `items[].product` sku / weight / image).
 * Customers, discounts and media stay whole (small rows).
 */
const ORDER_LIST_POPULATE = {
    tenants: { name: true, slug: true, easyParcelIntegration: { enabled: true, selectedCouriers: true, selectedCourier: true } },
    sites: { name: true, domain: true },
    products: { name: true, slug: true, sku: true, weight: true, images: true },
    users: { email: true, firstName: true, lastName: true },
} as const

/**
 * GET /api/orders
 *
 * List orders for the dashboard's primary tenant.
 * Supports: ?status=pending&search=keyword&sort=-createdAt&page=1&limit=20&paymentMethod=cod
 *
 * `limit=0` is a count: `{ docs: [], totalDocs }` from one COUNT (the awaiting-verification chip). Payload reads
 * `limit: 0` as "no limit", so this used to load every matching order with its relations (TC-PERF-051).
 * Relations of the listed orders are populated with the fields the Orders screens read, not whole rows: the
 * tenant / site / product rows carried every column (rich-text descriptions, settings JSON) (TC-PERF-052).
 * Weak ETag + 304 for the reloads (TC-PERF-080).
 */
export const GET = withAuth(async (user, request) => {
    try {
        const tenantId = tenantIdForQuery(user)
        if (tenantId === null) {
            return NextResponse.json({ success: false, error: { code: 'NO_WORKSPACE', message: 'No active workspace' } }, { status: 403 })
        }
        const payload = await getPayload({ config })
        const url = new URL(request.url)

        const status = url.searchParams.get('status')
        const search = url.searchParams.get('search')
        const sort = url.searchParams.get('sort') || '-createdAt'
        const page = parseInt(url.searchParams.get('page') || '1')
        const parsedLimit = parseInt(url.searchParams.get('limit') || '20', 10)
        const limit = Number.isNaN(parsedLimit) || parsedLimit < 0 ? 20 : Math.min(parsedLimit, 100)
        const paymentMethod = url.searchParams.get('paymentMethod')
        const paymentStatus = url.searchParams.get('paymentStatus')
        const dateFilter = url.searchParams.get('date')

        // Keep every filter, including search's OR group, inside the primary workspace.
        const where: Where = { tenant: { equals: tenantId } }

        if (status && status !== 'all') {
            const groupStatuses = Object.hasOwn(ORDER_STATUS_GROUPS, status)
                ? ORDER_STATUS_GROUPS[status]
                : undefined
            where.status = groupStatuses ? { in: groupStatuses } : { equals: status }
        }

        if (paymentMethod) {
            where.paymentMethod = { equals: paymentMethod }
        }

        if (paymentStatus) {
            where.paymentStatus = { equals: paymentStatus }
        }

        if (search) {
            where.or = [
                { orderNumber: { contains: search } },
                { customerName: { contains: search } },
                { customerEmail: { contains: search } },
            ]
        }

        if (dateFilter && dateFilter !== 'all') {
            const now = new Date()
            let fromDate: Date | null = null
            const viewerTimeZone = normalizeViewerTimeZone(
                request.headers.get('x-viewer-time-zone'),
            )

            if (dateFilter === 'today') {
                fromDate = getViewerPeriodStart(now, viewerTimeZone, 'today')
            } else if (dateFilter === 'thisWeek') {
                fromDate = getViewerPeriodStart(now, viewerTimeZone, 'thisWeek')
            } else if (dateFilter === 'thisMonth') {
                fromDate = getViewerPeriodStart(now, viewerTimeZone, 'thisMonth')
            }

            if (fromDate) {
                where.createdAt = { greater_than_equal: fromDate.toISOString() }
            }
        }

        if (limit === 0) {
            const { totalDocs } = await payload.count({ collection: 'orders', where, user, overrideAccess: false })
            return jsonWithEtag({
                docs: [],
                totalDocs,
                limit: 0,
                totalPages: totalDocs > 0 ? 1 : 0,
                page: 1,
                pagingCounter: 1,
                hasPrevPage: false,
                hasNextPage: false,
                prevPage: null,
                nextPage: null,
                success: true,
            }, request)
        }

        const result = await payload.find({
            collection: 'orders',
            where,
            sort,
            page: Number.isNaN(page) || page < 1 ? 1 : page,
            limit,
            depth: 1,
            populate: ORDER_LIST_POPULATE,
            user,
            overrideAccess: false,
        })

        return jsonWithEtag({
            ...result,
            success: true,
        }, request)
    } catch (error: any) {
        console.error('[Orders List Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load orders' } },
            { status: 500 }
        )
    }
})
