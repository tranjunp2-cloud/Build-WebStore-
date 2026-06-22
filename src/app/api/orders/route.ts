import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { ORDER_STATUS_GROUPS } from '@/lib/orders/status-groups'

/**
 * GET /api/orders
 *
 * List orders for the authenticated user's tenant.
 * Supports: ?status=pending&search=keyword&sort=-createdAt&page=1&limit=20&paymentMethod=cod
 */
export const GET = withAuth(async (user, request) => {
    try {
        const payload = await getPayload({ config })
        const url = new URL(request.url)

        const status = url.searchParams.get('status')
        const search = url.searchParams.get('search')
        const sort = url.searchParams.get('sort') || '-createdAt'
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
        const paymentMethod = url.searchParams.get('paymentMethod')
        const paymentStatus = url.searchParams.get('paymentStatus')
        const dateFilter = url.searchParams.get('date')

        // Build where clause (tenant scoping is handled by collection access)
        const where: any = {}

        if (status && status !== 'all') {
            const groupStatuses = ORDER_STATUS_GROUPS[status]
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
            if (dateFilter === 'today') {
                fromDate = new Date(now.setHours(0, 0, 0, 0))
            } else if (dateFilter === 'thisWeek') {
                const startOfWeek = new Date(now)
                startOfWeek.setDate(now.getDate() - now.getDay())
                startOfWeek.setHours(0, 0, 0, 0)
                fromDate = startOfWeek
            } else if (dateFilter === 'thisMonth') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
            }
            if (fromDate) {
                where.createdAt = { greater_than_equal: fromDate.toISOString() }
            }
        }

        const result = await payload.find({
            collection: 'orders',
            where,
            sort,
            page,
            limit,
            depth: 1,
            user,
            overrideAccess: false,
        })

        return NextResponse.json({
            ...result,
            success: true,
        })
    } catch (error: any) {
        console.error('[Orders List Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load orders' } },
            { status: 500 }
        )
    }
})
