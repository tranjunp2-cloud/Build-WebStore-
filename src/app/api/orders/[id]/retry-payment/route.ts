/**
 * POST /api/orders/[id]/retry-payment
 *
 * Creates a new Stripe Checkout Session for a pending/failed order.
 * Auth: HttpOnly ct_ cookie OR magic-link token in request body.
 *
 * Retryable states: status='pending' OR paymentStatus in ['awaiting_payment','payment_failed']
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { verifyConfirmToken, generateConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'
import { buildOrderItems } from '@/app/api/orders/stripe-checkout/build-order-items'

// Stripe failure paymentStatus is 'failed' (payment_intent.payment_failed webhook) or
// 'payment_failed' (24h auto-cancel cron) — accept both so either path can be retried.
const RETRYABLE_PAYMENT_STATUSES = new Set(['awaiting_payment', 'failed', 'payment_failed'])

/** Minimal tenant shape needed for this flow. */
interface TenantDoc {
    id: string | number
    slug?: string
    stripeAccountId?: string | null
    stripeOnboardingComplete?: boolean
    status?: string
    payments?: { payment_card?: boolean; payment_fpx?: boolean }
}

/** Minimal site shape needed for this flow. */
interface SiteDoc {
    id: string | number
    slug?: string
    paymentConfig?: { cardEnabled?: boolean; fpxEnabled?: boolean }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    const orderId = isNaN(Number(id)) ? id : Number(id)

    const rawBody = await request.json().catch(() => ({}))
    const bodyToken: string | undefined = typeof rawBody?.token === 'string' ? rawBody.token : undefined

    try {
        const payload = await getPayload({ config })

        // Step 1: Load order (depth:1 to populate tenant + site)
        let order: any
        try {
            order = await payload.findByID({
                collection: 'orders',
                id: orderId,
                depth: 1,
                overrideAccess: true,
            })
        } catch {
            order = null
        }
        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        // Step 2: Auth — ct_ cookie OR magic-link token
        const cookieStore = await cookies()
        const cookieToken = cookieStore.get(`ct_${order.id}`)?.value ?? ''
        const cookieValid = cookieToken
            ? verifyConfirmToken(cookieToken, order.id, order.orderNumber)
            : false

        let tokenValid = false
        if (!cookieValid && bodyToken && order.magicLinkSecret) {
            const result = await verifyOrderToken({ token: bodyToken, secret: order.magicLinkSecret })
            tokenValid = result.ok
        }

        if (!cookieValid && !tokenValid) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized to retry this order' } },
                { status: 401 },
            )
        }

        // Step 3: Status guard — only unpaid, non-terminal orders proceed.
        // Excludes auto-cancelled orders (status='cancelled', paymentStatus='payment_failed')
        // which would otherwise match the paymentStatus set despite being terminal.
        const TERMINAL_STATUSES = new Set(['cancelled', 'refunded', 'completed', 'shipped', 'new'])
        const isRetryable =
            !TERMINAL_STATUSES.has(order.status) &&
            order.paymentStatus !== 'paid' &&
            (order.status === 'pending' ||
                order.status === 'payment_failed' ||
                RETRYABLE_PAYMENT_STATUSES.has(order.paymentStatus))
        if (!isRetryable) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_RETRYABLE', message: 'This order cannot be retried' } },
                { status: 409 },
            )
        }

        // Stripe-only: retry creates a Stripe Checkout session. Bank-transfer/COD orders use their
        // own flows (receipt upload / cash) — never convert them to a Stripe charge via this endpoint.
        if (order.paymentMethod !== 'card' && order.paymentMethod !== 'fpx') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_RETRYABLE', message: 'This payment method cannot be retried online' } },
                { status: 409 },
            )
        }

        // Step 4: Resolve tenant + site from populated order (depth:1)
        const tenantDoc = (typeof order.tenant === 'object' ? order.tenant : null) as TenantDoc | null
        const tenantId = tenantDoc?.id ?? order.tenant
        if (!tenantDoc) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                { status: 404 },
            )
        }

        const siteDoc = (typeof order.site === 'object' ? order.site : null) as SiteDoc | null
        const siteId = siteDoc?.id ?? order.site

        if (tenantDoc.status === 'suspended') {
            return NextResponse.json(
                { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } },
                { status: 403 },
            )
        }

        const stripeAccountId = tenantDoc.stripeAccountId
        if (!stripeAccountId) {
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_CONNECTED', message: 'Seller has not connected Stripe yet' } },
                { status: 422 },
            )
        }
        if (!tenantDoc.stripeOnboardingComplete) {
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_NOT_READY', message: 'Payment temporarily unavailable' } },
                { status: 422 },
            )
        }

        // Step 5: Build payment method types (tenant gate + site layer-2 guard)
        let types = buildPaymentMethodTypes(tenantDoc)
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' } },
                { status: 422 },
            )
        }

        const paymentConfig = siteDoc?.paymentConfig ?? {}
        if (paymentConfig.cardEnabled === false) types = types.filter(t => t !== 'card')
        if (paymentConfig.fpxEnabled === false) types = types.filter(t => t !== 'fpx')
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'METHOD_DISABLED', message: 'No payment method is enabled for this site' } },
                { status: 422 },
            )
        }

        // Step 6: Rebuild order line items (validates stock at retry time)
        const rawItems = (order.items ?? []).map((i: any) => ({
            productId: typeof i.product === 'object' ? i.product.id : i.product,
            quantity: i.quantity,
            variant: i.variant || undefined,
        }))
        const built = await buildOrderItems(payload, rawItems, tenantId)
        if (built.errorResponse) return built.errorResponse

        const { checkoutItems, subtotal, orderItems } = built

        // Re-price at retry time so the Stripe charge matches what we persist — product prices may
        // have changed since placement. Mirrors stripe-checkout totals (flat shipping + 6% SST).
        const shippingFee = 10
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = Math.round((subtotal + shippingFee + tax) * 100) / 100

        // Step 7: Create new Stripe Checkout Session
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = tenantDoc.slug || String(tenantId)
        const orderNumber = order.orderNumber

        const allCheckoutItems = [
            ...checkoutItems,
            ...(shippingFee > 0 ? [{ name: 'Shipping', price: Math.round(shippingFee * 100), quantity: 1, images: [] }] : []),
            ...(tax > 0 ? [{ name: 'SST (6%)', price: Math.round(tax * 100), quantity: 1, images: [] }] : []),
        ]

        let checkout: { sessionId: string; url: string }
        try {
            checkout = await createStripeCheckoutSession({
                orderId: String(order.id),
                items: allCheckoutItems,
                currency: order.currency as 'MYR' | 'USD' | 'SGD',
                customerEmail: order.customerEmail,
                successUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
                // Cancel/back at Stripe → confirm page "payment not completed" (consistent with place-order)
                cancelUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?cancelled=1`,
                stripeAccountId,
                paymentMethodTypes: types,
                metadata: { siteId: String(siteId), tenantId: String(tenantId), orderNumber },
            })
        } catch (stripeErr: unknown) {
            console.error('[retry-payment] Stripe API error:', stripeErr instanceof Error ? stripeErr.message : stripeErr)
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_API_ERROR', message: 'Payment service is busy. Please try again.' } },
                { status: 502 },
            )
        }

        // Step 8: Update order with new session ID; reset a failed order back to awaiting.
        // Failure paymentStatus is 'failed' (webhook) or 'payment_failed' (cron); status may be 'payment_failed'.
        // NOTE: paymentExpiresAt is intentionally NOT refreshed — the 24h hold runs from order
        // PLACEMENT, fixed across retries (a retry never extends the auto-cancel deadline).
        const updateData: Record<string, unknown> = {
            stripeSessionId: checkout.sessionId,
            // Persist re-priced items + totals so the line items and order.total stay consistent
            // with the new Stripe charge (refund/reconcile correctness)
            items: orderItems,
            subtotal,
            shippingFee,
            tax,
            total,
        }
        if (
            order.status === 'payment_failed' ||
            order.paymentStatus === 'failed' ||
            order.paymentStatus === 'payment_failed'
        ) {
            updateData.status = 'pending'
            updateData.paymentStatus = 'awaiting_payment'
        }
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: updateData,
            overrideAccess: true,
        })

        // Step 9: Refresh ct_ cookie (30d, same settings as stripe-checkout)
        const confirmToken = generateConfirmToken(order.id, orderNumber)
        const res = NextResponse.json({ success: true, data: { sessionUrl: checkout.url } })
        res.cookies.set(`ct_${order.id}`, confirmToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
        })
        return res
    } catch (err: unknown) {
        console.error('[retry-payment] Unexpected error:', err instanceof Error ? err.message : err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Retry failed' } },
            { status: 500 },
        )
    }
}
