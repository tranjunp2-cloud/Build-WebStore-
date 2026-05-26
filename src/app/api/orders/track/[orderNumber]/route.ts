import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'payment_failed'])

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderNumber: string }> },
) {
    const { orderNumber } = await params
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
        return NextResponse.json({ error: 'missing_slug' }, { status: 400 })
    }

    try {
        const payload = await getPayload({ config })

        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const tenant = tenantResult.docs[0] as any
        if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const site = siteResult.docs[0] as any
        if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const where: Where = {
            orderNumber: { equals: orderNumber },
            site: { equals: site.id },
        }

        const result = await payload.find({
            collection: 'orders',
            where,
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })

        const order = result.docs[0] as any
        if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        return NextResponse.json({
            status: order.status,
            paymentStatus: order.paymentStatus,
            trackingNumber: order.trackingNumber ?? null,
            terminal: TERMINAL_STATUSES.has(order.status),
        })
    } catch {
        return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
}
