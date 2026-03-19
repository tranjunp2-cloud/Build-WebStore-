import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { orderCreateSchema } from '@/lib/validations/orders'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'

/**
 * POST /api/orders/create
 *
 * Creates a pending order and redirects to Stripe Checkout (Direct Charges).
 * Stock is only decremented after payment confirmation via webhook.
 *
 * Body: { siteId, items: [{productId, quantity}], customer: {name, email, phone, address} }
 * Returns: { checkoutUrl } for client-side redirect
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, orderCreateSchema)
        if (errorResponse) return errorResponse
        
        const { siteId, items, customer } = data!

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

        // Get tenant to check Stripe Connect
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
                { status: 404 }
            )
        }

        const stripeAccountId = (tenant as any).stripeAccountId
        const stripeOnboardingComplete = (tenant as any).stripeOnboardingComplete
        if (!stripeAccountId || !stripeOnboardingComplete) {
            return NextResponse.json(
                { success: false, error: { code: 'PAYMENT_NOT_CONFIGURED', message: 'Merchant has not completed Stripe onboarding' } },
                { status: 400 }
            )
        }

        // Validate products and calculate totals
        const orderItems = []
        const checkoutItems = []
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

            // For Stripe Checkout (prices in smallest unit — sen for MYR)
            checkoutItems.push({
                name: p.name,
                price: Math.round(p.price * 100), // RM → sen
                quantity: item.quantity,
                images: p.images?.[0]?.url ? [p.images[0].url] : [],
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
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = subtotal + tax

        // Create order in PENDING status (will be updated to 'paid' by webhook)
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

        // Create Stripe Checkout Session (Direct Charges on merchant's connected account)
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = (tenant as any).slug || tenantId

        const checkout = await createStripeCheckoutSession({
            orderId: order.id as string,
            items: checkoutItems,
            currency: currency as 'MYR' | 'USD' | 'SGD',
            customerEmail: customer.email,
            successUrl: `${baseUrl}/sites/${siteSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${baseUrl}/sites/${siteSlug}/checkout/cancel`,
            stripeAccountId,
            metadata: {
                siteId,
                tenantId,
                orderNumber,
            },
        })

        // Save Stripe session ID to order
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: {
                stripeSessionId: checkout.sessionId,
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
                checkoutUrl: checkout.url,
            },
        })
    } catch (error: any) {
        console.error('[Order Create Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
})
