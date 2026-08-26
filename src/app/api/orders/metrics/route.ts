import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { ORDER_STATUS_GROUPS, type OrderStatus } from '@/lib/orders/status-groups'

export const GET = withAuth(async (user) => {
    try {
        const payload = await getPayload({ config })

        const countGroup = async (statuses: OrderStatus[]) => {
            const res = await payload.find({
                collection: 'orders',
                where: { status: { in: statuses } },
                limit: 0,
                depth: 0,
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

        return NextResponse.json({
            success: true,
            data: { pending, confirmed, readyToShip, shipped, completed, cancelled, refunded },
        })
    } catch (error: any) {
        console.error('[Orders Metrics Error]', error)
        return NextResponse.json({ success: false }, { status: 500 })
    }
})
