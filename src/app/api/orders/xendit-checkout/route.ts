import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { xenditCheckoutSchema } from '@/lib/validations/orders'
import { createPaymentRequest, mapChannelToPaymentMethod } from '@/lib/payment/xendit'
import { XenditError } from '@/lib/payment/xendit-client'
import { buildOrderItems } from '../stripe-checkout/build-order-items'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { buildEnabledChannels } from './build-enabled-channels'
import { decrementOrderStock, restockAll } from './decrement-stock'

interface XenditTenantDoc {
    id: string | number
    name?: string
    slug?: string
    status?: string
    xenditAccountId?: string | null
    xenditOnboardingComplete?: boolean
    payments?: { xendit_tng?: boolean; xendit_grabpay?: boolean; xendit_duitnow?: boolean; xendit_fpx?: boolean }
}

interface XenditSiteDoc {
    id: string | number
    tenant: string | number | { id: string | number }
}

function setCookieToken(res: NextResponse, orderId: string | number, orderNumber: string) {
    const token = generateConfirmToken(orderId, orderNumber)
    res.cookies.set(`ct_${orderId}`, token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 30 * 24 * 60 * 60, path: '/',
    })
}

/**
 * POST /api/orders/xendit-checkout
 * Creates a pending order + Xendit payment request (for-user-id = tenant sub-account).
 * Returns { type: 'redirect', sessionUrl } for eWallet/FPX/Cards or { type: 'qr', qrString } for DuitNow QR.
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.json().catch(() => null)
    if (!rawBody) {
        return NextResponse.json({ success: false, error: { code: 'INVALID_BODY', message: 'Request body is required' } }, { status: 400 })
    }

    const parse = xenditCheckoutSchema.safeParse(rawBody)
    if (!parse.success) {
        console.warn('[xendit-checkout] validation error:', parse.error.message)
        return NextResponse.json({ success: false, error: { code: 'INVALID_BODY', message: 'Invalid request body' } }, { status: 400 })
    }

    const { siteId, channelCode, items, customer } = parse.data

    try {
        const payload = await getPayload({ config })
        const siteIdNum = typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId

        const site = await payload.findByID({ collection: 'sites', id: siteIdNum, depth: 0, overrideAccess: true })
        if (!site) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } }, { status: 404 })

        const siteTyped = site as unknown as XenditSiteDoc
        const tenantId = typeof siteTyped.tenant === 'object' ? siteTyped.tenant?.id : siteTyped.tenant
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
        if (!tenant) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, { status: 404 })

        const tenantTyped = tenant as unknown as XenditTenantDoc

        if (tenantTyped.status === 'suspended') {
            return NextResponse.json({ success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Store is not available' } }, { status: 403 })
        }
        if (!tenantTyped.xenditAccountId || !tenantTyped.xenditOnboardingComplete) {
            return NextResponse.json({ success: false, error: { code: 'XENDIT_NOT_READY', message: 'Payment temporarily unavailable' } }, { status: 422 })
        }

        const enabled = buildEnabledChannels(tenantTyped.payments)
        if (enabled.size === 0) {
            return NextResponse.json({ success: false, error: { code: 'NO_PAYMENT_METHODS', message: 'Seller has not enabled any Xendit payment method' } }, { status: 422 })
        }
        if (!enabled.has(channelCode)) {
            return NextResponse.json({ success: false, error: { code: 'CHANNEL_DISABLED', message: `${channelCode} is not enabled by this store` } }, { status: 422 })
        }

        const built = await buildOrderItems(payload, items, tenantId)
        if (built.errorResponse) return built.errorResponse

        const { orderItems, subtotal, currency } = built
        if (orderItems.length === 0) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } }, { status: 422 })
        }

        const shippingFee = 10
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = Math.round((subtotal + shippingFee + tax) * 100) / 100
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
        const magicLinkSecret = randomBytes(32).toString('hex')

        // Free order (coupon 100% off or zero-priced) — skip Xendit
        if (total <= 0) {
            const freeOrder = await payload.create({
                collection: 'orders',
                data: {
                    tenant: tenantId, site: siteIdNum, orderNumber, items: orderItems,
                    subtotal, tax, shippingFee, total: 0, currency,
                    status: 'paid', paymentStatus: 'paid', paymentMethod: 'free', paymentProvider: 'xendit',
                    customerEmail: customer.email, customerName: customer.name, customerPhone: customer.phone || '',
                } as Record<string, unknown>,
            })
            return NextResponse.json({ success: true, data: { orderId: freeOrder.id, orderNumber, total: 0, currency, status: 'paid', sessionUrl: null } })
        }

        const order = await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId, site: siteIdNum, orderNumber, items: orderItems,
                subtotal, shippingFee, tax, total, currency,
                status: 'pending', paymentStatus: 'awaiting_payment',
                paymentProvider: 'xendit', xenditChannelCode: channelCode,
                paymentMethod: mapChannelToPaymentMethod(channelCode),
                paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                magicLinkSecret,
                customerEmail: customer.email, customerName: customer.name, customerPhone: customer.phone || '',
                shippingAddress: customer.address ? {
                    line1: customer.address.line1 || '', line2: customer.address.line2 || '',
                    city: customer.address.city || '', state: customer.address.state || '',
                    postcode: customer.address.postcode || '', country: customer.address.country || 'Malaysia',
                } : undefined,
            } as Record<string, unknown>,
        })

        const stockResult = await decrementOrderStock(payload, orderItems)
        if (!stockResult.ok) {
            await restockAll(payload, stockResult.decremented)
            await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
            return NextResponse.json({ success: false, error: { code: 'OUT_OF_STOCK', message: stockResult.errorMessage } }, { status: 422 })
        }
        const { decremented } = stockResult

        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const siteSlug = tenantTyped.slug || String(tenantId)

        let pr: Awaited<ReturnType<typeof createPaymentRequest>>
        try {
            pr = await createPaymentRequest({
                forUserId: tenantTyped.xenditAccountId!,
                referenceId: String(order.id),
                // Xendit MYR = major unit (RM). order.total already RM. NO sen conversion.
                amount: total,
                channelCode,
                customerEmail: customer.email,
                successReturnUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm`,
                failureReturnUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?cancelled=1`,
            })
            await payload.update({ collection: 'orders', id: order.id, data: { xenditPaymentRequestId: pr.id } as Record<string, unknown> })
        } catch (err) {
            await restockAll(payload, decremented)
            await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
            if (err instanceof XenditError) {
                return NextResponse.json({ success: false, error: { code: 'XENDIT_API_ERROR', message: 'Payment service unavailable. Please try again.' } }, { status: 502 })
            }
            return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } }, { status: 500 })
        }

        // Fire-and-forget buyer confirmation email
        const shopName = tenantTyped.name ?? siteSlug
        const buyerEmail = orderConfirmationEmail({
            shopName, orderNumber, customerName: customer.name, customerEmail: customer.email,
            customerPhone: customer.phone ?? null, customerAddress: customer.address ?? null,
            items: orderItems.map(i => ({ name: i.productName, variant: i.variant || null, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.quantity * i.unitPrice })),
            subtotal, shippingFee, total, currency, paymentMethod: 'xendit',
            event: 'placed', orderDate: new Date().toISOString(),
            orderPageUrl: `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}`,
        })
        payload.sendEmail({ to: customer.email, subject: buyerEmail.subject, html: buyerEmail.html })
            .catch((err) => console.error('[xendit-checkout] buyer email failed:', err))

        const presentAction = pr.actions?.find(a => a.action === 'PRESENT_TO_CUSTOMER')
        const redirectAction = pr.actions?.find(a => a.action === 'REDIRECT')

        if (presentAction?.qr_code) {
            const res = NextResponse.json({ success: true, data: { type: 'qr', qrString: presentAction.qr_code, amount: total, orderId: order.id, orderNumber } })
            setCookieToken(res, order.id, orderNumber)
            return res
        }
        if (redirectAction?.url) {
            const res = NextResponse.json({ success: true, data: { type: 'redirect', sessionUrl: redirectAction.url, orderId: order.id, orderNumber } })
            setCookieToken(res, order.id, orderNumber)
            return res
        }

        // No usable action — compensate
        await restockAll(payload, decremented)
        await payload.update({ collection: 'orders', id: order.id, data: { paymentStatus: 'payment_failed' } as Record<string, unknown> }).catch(() => null)
        return NextResponse.json({ success: false, error: { code: 'XENDIT_NO_ACTION', message: 'No payment action returned.' } }, { status: 502 })

    } catch (err: unknown) {
        console.error('[xendit-checkout] Unexpected error:', err instanceof Error ? err.message : err)
        return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } }, { status: 500 })
    }
}
