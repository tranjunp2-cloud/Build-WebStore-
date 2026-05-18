import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { stripeCheckoutSchema } from '@/lib/validations/orders'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'
import { buildOrderItems } from './build-order-items'

/**
 * POST /api/orders/stripe-checkout
 *
 * 6-step validation chain (locked F13 decision):
 *   1. Resolve site by siteId
 *   2. Resolve tenant from site.tenant
 *   3. Validate tenant.stripeAccountId + stripeOnboardingComplete → 422 STRIPE_NOT_READY
 *   4. types = buildPaymentMethodTypes(tenant)
 *      → if [] → 422 NO_PAYMENT_METHODS (tenant has Card+FPX both OFF) — TC-F13.37
 *   5. Site-level guard (layer 2):
 *      - site.paymentConfig.cardEnabled === false → drop 'card' from types
 *      - site.paymentConfig.fpxEnabled  === false → drop 'fpx'  from types
 *      → if [] after guard → 422 METHOD_DISABLED — TC-F13.38, TC-F13.39
 *   6. createStripeCheckoutSession({ paymentMethodTypes: types, ... })
 *
 * Request body does NOT include paymentMethod — backend builds the full enabled array.
 * If legacy clients still send paymentMethod, it is logged as warning and ignored.
 *
 * Pending order created with status='pending'; webhook transitions to 'new' on success.
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.json().catch(() => null)
    if (!rawBody) {
        return NextResponse.json(
            { success: false, error: { code: 'INVALID_BODY', message: 'Request body is required' } },
            { status: 400 },
        )
    }

    const parse = stripeCheckoutSchema.safeParse(rawBody)
    if (!parse.success) {
        console.warn('[stripe-checkout] validation error:', parse.error.message)
        return NextResponse.json(
            { success: false, error: { code: 'INVALID_BODY', message: 'Invalid request body' } },
            { status: 400 },
        )
    }

    const { siteId, items, customer } = parse.data

    if ((rawBody as any).paymentMethod) {
        console.warn('[stripe-checkout] legacy paymentMethod field received and ignored', { siteId })
    }

    try {
        const payload = await getPayload({ config })

        const siteIdNum =
            typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId

        // Step 1: Resolve site
        const site = await payload.findByID({
            collection: 'sites',
            id: siteIdNum,
            depth: 0,
            overrideAccess: true,
        })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 },
            )
        }

        // Step 2: Resolve tenant
        const tenantId =
            typeof (site as any).tenant === 'object'
                ? (site as any).tenant?.id
                : (site as any).tenant
        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
        })
        if (!tenant) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                { status: 404 },
            )
        }

        // TC-F13.88: suspended tenant cannot accept payments
        if ((tenant as any).status === 'suspended') {
            return NextResponse.json(
                { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } },
                { status: 403 },
            )
        }

        // Step 3: Stripe-ready check
        const stripeAccountId = (tenant as any).stripeAccountId
        const onboardingComplete = (tenant as any).stripeOnboardingComplete === true
        if (!stripeAccountId) {
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_CONNECTED', message: 'Seller has not connected Stripe yet' } },
                { status: 422 },
            )
        }
        if (!onboardingComplete) {
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_READY', message: 'Payment temporarily unavailable' } },
                { status: 422 },
            )
        }

        // Step 4: Tenant master gate — build enabled methods from tenant flags
        let types = buildPaymentMethodTypes(tenant as any)
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' } },
                { status: 422 },
            )
        }

        // Step 5: Site-level layer-2 guard
        const paymentConfig = (site as any).paymentConfig ?? {}
        if (paymentConfig.cardEnabled === false) types = types.filter(t => t !== 'card')
        if (paymentConfig.fpxEnabled === false) types = types.filter(t => t !== 'fpx')
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'METHOD_DISABLED', message: 'No payment method is enabled for this site' } },
                { status: 422 },
            )
        }

        // Step 6: Validate products, check stock, build line items
        const built = await buildOrderItems(payload, items, siteIdNum)
        if (built.errorResponse) return built.errorResponse

        const { orderItems, checkoutItems, subtotal, currency } = built

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 },
            )
        }

        // Calculate totals (SST 6% + flat shipping — #962 will replace shipping calc)
        const shippingFee = 10
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = Math.round((subtotal + shippingFee + tax) * 100) / 100
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`

        // TC-F13.103: free order (coupon 100% off or zero-priced) — skip Stripe
        if (total <= 0) {
            const freeOrder = await payload.create({
                collection: 'orders',
                data: {
                    tenant: tenantId,
                    site: siteIdNum,
                    orderNumber,
                    items: orderItems,
                    subtotal,
                    tax,
                    shippingFee,
                    total: 0,
                    currency,
                    status: 'paid',
                    paymentMethod: 'free',
                    customerEmail: customer.email,
                    customerName: customer.name,
                    customerPhone: customer.phone || '',
                } as any,
            })
            return NextResponse.json({
                success: true,
                data: { orderId: freeOrder.id, orderNumber, total: 0, currency, status: 'paid', sessionUrl: null },
            })
        }

        // paymentMethod on order: single-method tenant gets that method; multi-method defaults 'card'
        // Webhook will update to actual method used when checkout.session.completed fires.
        const orderPaymentMethod = types.length === 1 ? types[0] : 'card'

        // Create order in pending status
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
                paymentMethod: orderPaymentMethod,
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

        // Create Stripe Checkout Session on merchant's connected account (Direct Charges)
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = (tenant as any).slug || tenantId

        const applicationFeeAmountCents = 0 // cross-border fee unsupported (US platform + MY connected account)

        // Include shipping and tax as Stripe line items so buyer is charged the full order total
        const allCheckoutItems = [
            ...checkoutItems,
            ...(shippingFee > 0 ? [{ name: 'Shipping', price: Math.round(shippingFee * 100), quantity: 1, images: [] }] : []),
            ...(tax > 0 ? [{ name: 'SST (6%)', price: Math.round(tax * 100), quantity: 1, images: [] }] : []),
        ]

        let checkout
        try {
            checkout = await createStripeCheckoutSession({
                orderId: order.id as string,
                items: allCheckoutItems,
                currency: currency as 'MYR' | 'USD' | 'SGD',
                customerEmail: customer.email,
                successUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${baseUrl}/sites/${siteSlug}/checkout?stripe_cancelled=1`,
                stripeAccountId,
                paymentMethodTypes: types,
                applicationFeeAmountCents,
                metadata: { siteId: String(siteId), tenantId: String(tenantId), orderNumber },
            })
        } catch (stripeErr: any) {
            console.error('[stripe-checkout] Stripe API error:', stripeErr.message)
            // Clean up pending order so it doesn't litter the DB
            await payload.delete({ collection: 'orders', id: order.id }).catch(() => null)
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_API_ERROR', message: 'Payment service is busy. Please try again.' } },
                { status: 502 },
            )
        }

        // Persist session ID for idempotent webhook processing
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
