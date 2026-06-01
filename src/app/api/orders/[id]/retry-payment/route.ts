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

const RETRYABLE_PAYMENT_STATUSES = new Set(['awaiting_payment', 'payment_failed'])

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

        // Step 3: Status guard — only retryable orders proceed
        const isRetryable =
            order.status === 'pending' ||
            RETRYABLE_PAYMENT_STATUSES.has(order.paymentStatus)
        if (!isRetryable) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_RETRYABLE', message: 'This order cannot be retried' } },
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

        const { checkoutItems } = built

        // Step 7: Create new Stripe Checkout Session
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = tenantDoc.slug || String(tenantId)
        const orderNumber = order.orderNumber

        const allCheckoutItems = [
            ...checkoutItems,
            ...(order.shippingFee > 0 ? [{ name: 'Shipping', price: Math.round(order.shippingFee * 100), quantity: 1, images: [] }] : []),
            ...(order.tax > 0 ? [{ name: 'SST (6%)', price: Math.round(order.tax * 100), quantity: 1, images: [] }] : []),
        ]

        let checkout: { sessionId: string; url: string }
        try {
            checkout = await createStripeCheckoutSession({
                orderId: String(order.id),
                items: allCheckoutItems,
                currency: order.currency as 'MYR' | 'USD' | 'SGD',
                customerEmail: order.customerEmail,
                successUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}`,
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

        // Step 8: Update order with new session ID; reset status if payment_failed
        const updateData: Record<string, unknown> = { stripeSessionId: checkout.sessionId }
        if (order.paymentStatus === 'payment_failed') {
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
