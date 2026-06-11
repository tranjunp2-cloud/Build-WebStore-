import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { stripeCheckoutSchema } from '@/lib/validations/orders'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'
import { buildOrderItems } from './build-order-items'
import { applyDiscount } from '@/lib/discounts/apply-discount'
import { recordDiscountRedemption } from '@/lib/discounts/record-discount-redemption'
import { computeOrderTotal } from '@/lib/orders/order-total'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { decrementVariantStock, restockItem } from '@/app/api/orders/lib/stock-utils'

/** Minimal shape of a tenant document used in stripe-checkout flow. */
interface TenantDoc {
    id: string | number
    name?: string
    stripeAccountId?: string | null
    stripeOnboardingComplete?: boolean
    status?: string
    slug?: string
    payments?: { payment_card?: boolean; payment_fpx?: boolean }
}

/** Minimal shape of a site document used in stripe-checkout flow. */
interface SiteDoc {
    id: string | number
    tenant: string | number | { id: string | number }
    paymentConfig?: { cardEnabled?: boolean; fpxEnabled?: boolean }
}

/** Shape of the validated request body from stripeCheckoutSchema. */
interface CheckoutBody {
    siteId: string | number
    items: unknown[]
    customer: { email: string; name: string; phone?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string } }
    paymentMethod?: string
}

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

    if ((rawBody as CheckoutBody).paymentMethod) {
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
        const siteTyped = site as unknown as SiteDoc
        const tenantId =
            typeof siteTyped.tenant === 'object'
                ? siteTyped.tenant?.id
                : siteTyped.tenant
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

        const tenantTyped = tenant as unknown as TenantDoc

        // TC-F13.88: suspended tenant cannot accept payments
        if (tenantTyped.status === 'suspended') {
            return NextResponse.json(
                { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } },
                { status: 403 },
            )
        }

        // Step 3: Stripe-ready check
        const stripeAccountId = tenantTyped.stripeAccountId
        const onboardingComplete = tenantTyped.stripeOnboardingComplete === true
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
        let types = buildPaymentMethodTypes(tenantTyped)
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled Card or FPX' } },
                { status: 422 },
            )
        }

        // Step 5: Site-level layer-2 guard
        const paymentConfig = siteTyped.paymentConfig ?? {}
        if (paymentConfig.cardEnabled === false) types = types.filter(t => t !== 'card')
        if (paymentConfig.fpxEnabled === false) types = types.filter(t => t !== 'fpx')
        if (types.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'METHOD_DISABLED', message: 'No payment method is enabled for this site' } },
                { status: 422 },
            )
        }

        // Step 6: Validate products, check stock, build line items
        const built = await buildOrderItems(payload, items, tenantId)
        if (built.errorResponse) return built.errorResponse

        const { orderItems, checkoutItems, subtotal, currency } = built

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 },
            )
        }

        // Calculate totals (flat shipping — #962 will replace shipping calc).
        // SST tax removed at checkout (F33 phase-06) — kept as 0 so the order column stays populated.
        const shippingFee = 10
        const tax = 0
        const subtotalSen = Math.round(subtotal * 100)

        // Discount: re-validate server-side from code — client amount is never trusted
        let discountSen = 0
        let discountRow: any = null
        if (parse.data.discountCode) {
            const code = String(parse.data.discountCode).trim().toUpperCase()
            const discountResult = await payload.find({
                collection: 'discounts',
                // Site scoping (PRD §9): null site = all tenant sites; site-scoped = its own site only.
                where: {
                    and: [
                        { tenant: { equals: tenantId } },
                        { code: { equals: code } },
                        { or: [{ site: { exists: false } }, { site: { equals: siteIdNum } }] },
                    ],
                },
                limit: 1,
                depth: 0,
                overrideAccess: true,
            })
            discountRow = discountResult.docs[0] ?? null
            const applied = applyDiscount(discountRow as any, { subtotalSen, tenantId, now: new Date() })
            if (applied.ok) discountSen = applied.discountSen
            else discountRow = null
        }
        const discountRM = discountSen / 100
        // Shared gateway-agnostic total (F33) — identical formula as COD/QR so all gateways charge the same.
        const shippingFeeSen = Math.round(shippingFee * 100)
        const { total } = computeOrderTotal({ subtotalSen, discountSen, shippingFeeSen })
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
        // Per-order secret for magic-link tokens — enables cross-device retry from the re-payment email (AC-3)
        const magicLinkSecret = randomBytes(32).toString('hex')

        // TC-F13.103: free order (coupon 100% off or zero-priced) — skip Stripe
        if (total <= 0) {
            const freeOrder = await payload.create({
                collection: 'orders',
                // Payload collection data type is overly strict; cast required until generated types exist
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
                    paymentStatus: 'paid',
                    paymentMethod: 'free',
                    customerEmail: customer.email,
                    customerName: customer.name,
                    customerPhone: customer.phone || '',
                    ...(discountRow ? {
                        discount: discountRow.id,
                        discountCode: discountRow.code,
                        discountAmount: discountSen,
                    } : {}),
                } as Record<string, unknown>,
            })

            // Decrement stock for free orders — consistent with all payment methods.
            for (const item of orderItems) {
                const productId = item.product
                const variantName = item.variant?.trim() || null
                if (variantName) {
                    await decrementVariantStock(payload, productId, variantName, item.quantity)
                        .catch((e: unknown) => payload.logger.error(
                            { err: e, productId, variantName },
                            '[stripe-checkout] free order variant stock decrement failed',
                        ))
                } else {
                    await (payload.db.drizzle as any).execute(sql`
                        UPDATE products SET inventory = inventory - ${item.quantity}
                        WHERE id = ${productId} AND inventory IS NOT NULL AND inventory >= ${item.quantity}
                    `).catch((e: unknown) => payload.logger.error(
                        { err: e, productId },
                        '[stripe-checkout] free order aggregate stock decrement failed',
                    ))
                }
            }

            // Redeem inline — free orders skip Stripe entirely, so no webhook/reconcile fires to do it.
            if (discountRow && discountSen > 0) {
                await recordDiscountRedemption(payload, {
                    tenantId: Number(tenantId),
                    discountId: Number(discountRow.id),
                    orderId: Number(freeOrder.id),
                    amountApplied: discountSen,
                    discountCode: discountRow.code,
                    customerEmail: customer.email,
                })
            }

            return NextResponse.json({
                success: true,
                data: { orderId: freeOrder.id, orderNumber, total: 0, currency, status: 'paid', sessionUrl: null },
            })
        }

        // paymentMethod on order: single-method tenant gets that method; multi-method defaults 'card'
        // Webhook will update to actual method used when checkout.session.completed fires.
        const orderPaymentMethod = types.length === 1 ? types[0] : 'card'

        // Create order in pending status — 24h window matches Stripe Checkout session default expiry
        const order = await payload.create({
            collection: 'orders',
            // Payload collection data type is overly strict; cast required until generated types exist
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
                // 'awaiting_payment' (not default 'unpaid') so the 24h payment-expiry cron can auto-cancel it
                paymentStatus: 'awaiting_payment',
                paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                magicLinkSecret,
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
                ...(discountRow ? {
                    discount: discountRow.id,
                    discountCode: discountRow.code,
                    discountAmount: discountSen,
                } : {}),
            } as Record<string, unknown>,
        })

        // Decrement stock at session creation — restock on cancel/expiry, NOT on webhook.
        // CAS-style: variant items via decrementVariantStock; non-variant via SQL inventory >= qty.
        // Compensation on partial failure: restock decremented items, delete order → 422.
        const decremented: Array<{ productId: number | string; quantity: number; variantName: string | null; kind: 'variant' | 'aggregate' }> = []
        for (const item of orderItems) {
            const productId = item.product
            const variantName = item.variant?.trim() || null
            if (variantName) {
                const res = await decrementVariantStock(payload, productId, variantName, item.quantity)
                if (res.ok) {
                    decremented.push({ productId, quantity: item.quantity, variantName, kind: 'variant' })
                } else {
                    const msg = res.reason === 'insufficient_stock'
                        ? `"${item.productName}" (${variantName}) is out of stock`
                        : `Stock update failed for "${item.productName}"`
                    for (const d of decremented) {
                        await restockItem(payload, d.productId, d.variantName, d.quantity).catch(() => null)
                    }
                    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
                    return NextResponse.json(
                        { success: false, error: { code: 'OUT_OF_STOCK', message: msg } },
                        { status: 422 },
                    )
                }
            } else {
                const result = await (payload.db.drizzle as any).execute(sql`
                    UPDATE products SET inventory = inventory - ${item.quantity}
                    WHERE id = ${productId} AND inventory IS NOT NULL AND inventory >= ${item.quantity}
                    RETURNING id
                `)
                if (result.rows?.length) {
                    decremented.push({ productId, quantity: item.quantity, variantName: null, kind: 'aggregate' })
                } else {
                    for (const d of decremented) {
                        await restockItem(payload, d.productId, d.variantName, d.quantity).catch(() => null)
                    }
                    await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
                    return NextResponse.json(
                        { success: false, error: { code: 'OUT_OF_STOCK', message: `"${item.productName}" is out of stock` } },
                        { status: 422 },
                    )
                }
            }
        }

        // Create Stripe Checkout Session on merchant's connected account (Direct Charges)
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = tenantTyped.slug || String(tenantId)

        // When discount applied, use a single consolidated line item so Stripe charges
        // exactly the discounted total. Stripe forbids negative line items, so per-item
        // proportional split is not viable (Q2 confirmed: consolidated line is acceptable).
        const finalTotalSen = Math.round(total * 100)
        const allCheckoutItems = discountRow
            ? [{ name: 'Order total (discount applied)', price: finalTotalSen, quantity: 1, images: [] }]
            : [
                ...checkoutItems,
                ...(shippingFee > 0 ? [{ name: 'Shipping', price: Math.round(shippingFee * 100), quantity: 1, images: [] }] : []),
              ]

        let checkout
        try {
            checkout = await createStripeCheckoutSession({
                orderId: order.id as string,
                items: allCheckoutItems,
                currency: currency as 'MYR' | 'USD' | 'SGD',
                customerEmail: customer.email,
                successUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?cancelled=1`,
                stripeAccountId,
                paymentMethodTypes: types,
                metadata: { siteId: String(siteId), tenantId: String(tenantId), orderNumber },
            })
        } catch (stripeErr: unknown) {
            console.error('[stripe-checkout] Stripe API error:', stripeErr instanceof Error ? stripeErr.message : stripeErr)
            // Compensate stock — session creation failed, no payment will occur
            for (const d of decremented) {
                await restockItem(payload, d.productId, d.variantName, d.quantity).catch(() => null)
            }
            await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
            return NextResponse.json(
                { success: false, error: { code: 'STRIPE_API_ERROR', message: 'Payment service is busy. Please try again.' } },
                { status: 502 },
            )
        }

        // Persist session ID for idempotent webhook processing
        try {
            await payload.update({
                collection: 'orders',
                id: order.id,
                // Payload update data type is overly strict; cast required until generated types exist
                data: { stripeSessionId: checkout.sessionId } as Record<string, unknown>,
            })
        } catch (updateErr) {
            console.error('[stripe-checkout] Failed to save stripeSessionId, cleaning up:', updateErr)
            for (const d of decremented) {
                await restockItem(payload, d.productId, d.variantName, d.quantity).catch(() => null)
            }
            await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
            return NextResponse.json(
                { success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } },
                { status: 500 },
            )
        }

        // Fire-and-forget: notify buyer of pending Stripe order (mirrors BT awaiting-payment email)
        const orderPageUrl = `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}`
        const shopName = tenantTyped.name ?? siteSlug
        const buyerEmail = orderConfirmationEmail({
            shopName,
            orderNumber,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone ?? null,
            customerAddress: customer.address ?? null,
            items: orderItems.map(item => ({
                name: item.productName,
                variant: item.variant || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.quantity * item.unitPrice,
            })),
            subtotal,
            shippingFee,
            total,
            // Discount line — amount in RM (template formats with the same fp() as subtotal)
            discountCode: discountRow?.code ?? null,
            discountAmount: discountRM || null,
            currency,
            paymentMethod: 'stripe',
            event: 'placed',
            orderDate: new Date().toISOString(),
            orderPageUrl,
        })
        payload.sendEmail({ to: customer.email, subject: buyerEmail.subject, html: buyerEmail.html })
            .catch((err) => console.error('[stripe-checkout] buyer confirmation email failed:', err))

        const confirmToken = generateConfirmToken(order.id, orderNumber)
        const res = NextResponse.json({
            success: true,
            data: { orderId: order.id, orderNumber, sessionUrl: checkout.url },
        })
        res.cookies.set(`ct_${order.id}`, confirmToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
        })
        return res
    } catch (err: unknown) {
        console.error('[stripe-checkout] Unexpected error:', err instanceof Error ? err.message : err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } },
            { status: 500 },
        )
    }
}
