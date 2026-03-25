import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

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

        // Build where clause (tenant scoping is handled by collection access)
        const where: any = {}

        if (status && status !== 'all') {
            where.status = { equals: status }
        }

        if (paymentMethod) {
            where.paymentMethod = { equals: paymentMethod }
        }

        if (search) {
            where.or = [
                { orderNumber: { contains: search } },
                { customerName: { contains: search } },
                { customerEmail: { contains: search } },
            ]
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
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
})
