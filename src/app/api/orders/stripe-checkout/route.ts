import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { stripeCheckoutSchema } from '@/lib/validations/orders'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'
import { buildOrderItems } from './build-order-items'

/**
 * POST /api/orders/stripe-checkout
 *
 * Public endpoint (guest checkout). Creates a pending order and a Stripe
 * Checkout Session for FPX or Card payment (Direct Charges model).
 * Stock is only decremented after payment confirmation via webhook.
 *
 * Body: { siteId, items, customer, paymentMethod: 'fpx' | 'card' }
 * Returns: { success, data: { orderId, orderNumber, sessionUrl } }
 */
export async function POST(request: NextRequest) {
    try {
        const { data, errorResponse } = await parseRequest(request, stripeCheckoutSchema)
        if (errorResponse) return errorResponse

        const { siteId, items, customer, paymentMethod } = data!
        const payload = await getPayload({ config })

        const siteIdNum =
            typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId

        // 1. Resolve site
        const site = await payload.findByID({ collection: 'sites', id: siteIdNum })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 },
            )
        }

        // 2. Check payment method enabled in site config (default: enabled)
        const paymentConfig = (site as any).paymentConfig ?? {}
        const methodKey = paymentMethod === 'fpx' ? 'fpxEnabled' : 'cardEnabled'
        if (paymentConfig[methodKey] === false) {
            return NextResponse.json(
                { success: false, error: { code: 'METHOD_DISABLED', message: `${paymentMethod.toUpperCase()} is not enabled for this store` } },
                { status: 422 },
            )
        }

        // 3. Resolve tenant → verify Stripe onboarding complete
        const tenantId = typeof site.tenant === 'object' ? (site.tenant as any).id : site.tenant
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                { status: 404 },
            )
        }

        const stripeAccountId = (tenant as any).stripeAccountId
        const stripeOnboardingComplete = (tenant as any).stripeOnboardingComplete
        if (!stripeAccountId || !stripeOnboardingComplete) {
            return NextResponse.json(
                { success: false, error: { code: 'PAYMENT_NOT_CONFIGURED', message: 'Store payment not configured' } },
                { status: 400 },
            )
        }

        // 4. Validate products, check stock, build line items
        const built = await buildOrderItems(payload, items)
        if (built.errorResponse) return built.errorResponse
        const { orderItems, checkoutItems, subtotal, currency } = built

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 },
            )
        }

        // 5. Calculate totals (SST 6% + flat shipping — #962 will replace shipping calc)
        const shippingFee = 10
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = subtotal + shippingFee + tax
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

        // 6. Create order in pending status (webhook updates to 'paid' on success)
        const order = await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId,
                site: siteIdNum,
                orderNumber,
                items: orderItems,
                subtotal,
                shippingFee,
                tax,
                total,
                currency,
                status: 'pending',
                paymentMethod,
                customerEmail: customer.email,
                customerName: customer.name,
                customerPhone: customer.phone || '',
                shippingAddress: customer.address
                    ? {
                          line1: customer.address.line1 || '',
                          line2: customer.address.line2 || '',
                          city: customer.address.city || '',
                          state: customer.address.state || '',
                          postcode: customer.address.postcode || '',
                          country: customer.address.country || 'Malaysia',
                      }
                    : undefined,
            } as any,
        })

        // 7. Create Stripe Checkout Session on merchant's connected account
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = (tenant as any).slug || tenantId

        const checkout = await createStripeCheckoutSession({
            orderId: order.id as string,
            items: checkoutItems,
            currency: currency as 'MYR' | 'USD' | 'SGD',
            customerEmail: customer.email,
            successUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${baseUrl}/sites/${siteSlug}/checkout`,
            stripeAccountId,
            metadata: { siteId: String(siteId), tenantId: String(tenantId), orderNumber, paymentMethod },
        })

        // 8. Persist session ID for idempotent webhook processing
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: { stripeSessionId: checkout.sessionId } as any,
        })

        return NextResponse.json({
            success: true,
            data: { orderId: order.id, orderNumber, sessionUrl: checkout.url },
        })
    } catch (err: any) {
        console.error('[stripe-checkout] Unexpected error:', err.message)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } },
            { status: 500 },
        )
    }
}
