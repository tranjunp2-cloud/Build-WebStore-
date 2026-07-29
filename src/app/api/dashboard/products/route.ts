import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { findDashboardProducts } from '@/lib/products/dashboard-product-list'

export const maxDuration = 60

/**
 * GET /api/dashboard/products
 * Stable HTTP surface for the same tenant-scoped query used by the Products UI.
 */
export const GET = withAuth(async (user) => {
    try {
        const payload = await getPayload({ config })
        const docs = await findDashboardProducts(payload, user)

        return NextResponse.json(
            { success: true, data: docs },
            { headers: { 'Cache-Control': 'private, no-store' } },
        )
    } catch (error) {
        const errorType = error instanceof Error ? error.name : 'UnknownError'
        console.error('[GET /api/dashboard/products] failed', { userId: user.id, errorType })
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to load products' } },
            { status: 500 },
        )
    }
})
