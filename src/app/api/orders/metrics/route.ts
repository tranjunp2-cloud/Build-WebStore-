import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { tenantIdForQuery } from '@/lib/auth/tenant-id'
import { jsonWithEtag } from '@/lib/api/json-etag'
import { ORDER_STATUS_GROUPS, type OrderStatus } from '@/lib/orders/status-groups'

/**
 * GET /api/orders/metrics — order counts per status group for the Orders page tabs.
 *
 * Seven `COUNT(*)`s through Payload, scoped to the dashboard's primary tenant and checked by collection access. This used
 * `find({ limit: 0 })`, which in Payload 3 means "no limit": every order of the shop, items and relations
 * included, was read seven times just for `totalDocs` (TC-PERF-050). Weak ETag + 304 for the reloads (TC-PERF-080).
 */
export const GET = withAuth(async (user, request) => {
    try {
        const tenantId = tenantIdForQuery(user)
        if (tenantId === null) {
            return NextResponse.json({ success: false, error: { code: 'NO_WORKSPACE', message: 'No active workspace' } }, { status: 403 })
        }
        const payload = await getPayload({ config })

        const countGroup = async (statuses: OrderStatus[]) => {
            const res = await payload.count({
                collection: 'orders',
                where: { tenant: { equals: tenantId }, status: { in: statuses } },
                user,
                overrideAccess: false,
            })
            return res.totalDocs
        }

        const [pending, confirmed, readyToShip, shipped, completed, cancelled, refunded] = await Promise.all([
            countGroup(ORDER_STATUS_GROUPS.pending),
            countGroup(ORDER_STATUS_GROUPS.confirmed),
            countGroup(ORDER_STATUS_GROUPS.ready_to_ship),
            countGroup(ORDER_STATUS_GROUPS.shipped),
            countGroup(ORDER_STATUS_GROUPS.completed),
            countGroup(ORDER_STATUS_GROUPS.cancelled),
            countGroup(ORDER_STATUS_GROUPS.refunded),
        ])

        return jsonWithEtag({
            success: true,
            data: { pending, confirmed, readyToShip, shipped, completed, cancelled, refunded },
        }, request)
    } catch (error: unknown) {
        console.error('[Orders Metrics Error]', error)
        return NextResponse.json({ success: false }, { status: 500 })
    }
})
