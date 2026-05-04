import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCreateSchema } from '@/lib/validations/orders'

/**
 * POST /api/orders/checkout
 *
 * Create order via manual payment methods (COD or QR Banking).
 * Does NOT go through Stripe — creates order directly.
 * Public endpoint (guest checkout allowed).
 */
export async function POST(request: Request) {
    try {
        const { data, errorResponse } = await parseRequest(request, orderCreateSchema)
        if (errorResponse) return errorResponse

        const { siteId, items, customer, paymentMethod, paymentProofImage } = data!

        const payload = await getPayload({ config })

        // Get site to find tenant
        const siteLookupId = typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId
        const site = await payload.findByID({ collection: 'sites', id: siteLookupId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        const tenantId = typeof site.tenant === 'object' ? (site.tenant as any).id : site.tenant

        // Validate products, check stock, and calculate totals
        const orderItems = []
        let subtotal = 0
        let currency = 'MYR'

        for (const item of items) {
            const productLookupId = typeof item.productId === 'string' && !isNaN(Number(item.productId)) ? Number(item.productId) : item.productId
            const product = await payload.findByID({
                collection: 'products',
                id: productLookupId,
                depth: 0,
            })

            if (!product) {
                return NextResponse.json(
                    { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` } },
                    { status: 404 }
                )
            }

            const p = product as any

            // Check stock
            if (p.stock !== undefined && p.stock !== null && p.stock < item.quantity) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: `"${p.name}" has only ${p.stock} left in stock`,
                            product: p.name,
                            available: p.stock,
                            requested: item.quantity,
                        },
                    },
                    { status: 422 }
                )
            }

            currency = p.currency || 'MYR'
            const lineTotal = p.price * item.quantity
            subtotal += lineTotal

            orderItems.push({
                product: productLookupId,
                productName: p.name,
                variant: item.variant || '',
                quantity: item.quantity,
                unitPrice: p.price,
            })
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
        const shippingFee = 10 // Flat RM10 shipping
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = subtotal + shippingFee + tax

        // Create order
        const order = await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId,
                site: siteLookupId,
                orderNumber,
                items: orderItems,
                subtotal,
                shippingFee,
                tax,
                total: subtotal + shippingFee + tax,
                currency,
                status: 'pending',
                paymentMethod,
                ...(paymentProofImage ? { paymentProofImage } : {}),
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

        // Decrement stock for COD orders (immediate commitment)
        for (const item of items) {
            try {
                const product = await payload.findByID({
                    collection: 'products',
                    id: item.productId,
                    depth: 0,
                })
                const p = product as any
                if (p.stock !== undefined && p.stock !== null) {
                    await payload.update({
                        collection: 'products',
                        id: item.productId,
                        data: { stock: Math.max(0, p.stock - item.quantity) } as any,
                    })
                }
            } catch (err) {
                console.warn(`[Stock Decrement] Failed for product ${item.productId}:`, err)
            }
        }

        // TODO: Send order confirmation email to customer

        return NextResponse.json({
            success: true,
            data: {
                orderId: order.id,
                orderNumber,
                total,
                currency,
                status: 'pending',
                paymentMethod,
            },
        })
    } catch (error: any) {
        console.error('[Order Checkout Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } },
            { status: 500 }
        )
    }
}
