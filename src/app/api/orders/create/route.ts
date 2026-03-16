import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/orders/create
 * Creates a new order from cart items.
 *
 * Body: { siteId, items: [{productId, quantity}], customer: {name, email, phone, address} }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { siteId, items, customer } = body

        if (!siteId || !items?.length || !customer?.name || !customer?.email) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
                { status: 422 }
            )
        }

        const payload = await getPayload({ config })

        // Get site to find tenant
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        const tenantId = typeof site.tenant === 'object' ? (site.tenant as any).id : site.tenant

        // Validate products and calculate totals
        const orderItems = []
        let subtotal = 0
        let currency = 'MYR'

        for (const item of items) {
            const product = await payload.findByID({
                collection: 'products',
                id: item.productId,
                depth: 0,
            })

            if (!product) continue

            const p = product as any
            currency = p.currency || 'MYR'
            const lineTotal = p.price * item.quantity
            subtotal += lineTotal

            orderItems.push({
                product: item.productId,
                productName: p.name,
                quantity: item.quantity,
                unitPrice: p.price,
            })

            // Decrement inventory
            if (p.inventory > 0) {
                await payload.update({
                    collection: 'products',
                    id: item.productId,
                    data: {
                        inventory: Math.max(0, p.inventory - item.quantity),
                    },
                })
            }
        }

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 }
            )
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

        // Tax (SST 6% for Malaysia)
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = subtotal + tax

        // Create order
        const order = await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId,
                site: siteId,
                orderNumber,
                items: orderItems,
                subtotal,
                tax,
                total,
                currency,
                status: 'pending',
                customerEmail: customer.email,
                customerName: customer.name,
                customerPhone: customer.phone || '',
                shippingAddress: customer.address ? {
                    line1: customer.address.line1 || '',
                    line2: customer.address.line2 || '',
                    city: customer.address.city || '',
                    state: customer.address.state || '',
                    postcode: customer.address.postcode || '',
                    country: customer.address.country || 'Malaysia',
                } : undefined,
            } as any,
        })

        return NextResponse.json({
            success: true,
            data: {
                orderId: order.id,
                orderNumber,
                total,
                currency,
                status: 'pending',
            },
        })
    } catch (error: any) {
        console.error('[Order Create Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
}
