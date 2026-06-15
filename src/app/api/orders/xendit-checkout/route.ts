import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { xenditCheckoutSchema } from '@/lib/validations/orders'
import { createInvoice } from '@/lib/payment/xendit'
import { XenditError } from '@/lib/payment/xendit-client'
import { buildOrderItems } from '../stripe-checkout/build-order-items'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { decrementOrderStock, restockAll } from './decrement-stock'

interface XenditTenantDoc {
    id: string | number
    name?: string
    slug?: string
    status?: string
    xenditSecretKey?: string | null
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
 * Creates a pending order + Xendit Invoice (hosted checkout page).
 * Buyer is redirected to invoice_url — they pick their own payment method there.
 * Returns { type: 'redirect', sessionUrl: invoice_url }.
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

    const { siteId, items, customer } = parse.data

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
        if (!tenantTyped.xenditSecretKey) {
            return NextResponse.json({ success: false, error: { code: 'XENDIT_NOT_READY', message: 'Payment temporarily unavailable' } }, { status: 422 })
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
                paymentProvider: 'xendit',
                paymentMethod: 'ewallet',
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
        const shopName = tenantTyped.name ?? siteSlug

        let invoice: Awaited<ReturnType<typeof createInvoice>>
        try {
            invoice = await createInvoice({
                apiKey: tenantTyped.xenditSecretKey!,
                externalId: String(order.id),
                amount: total,
                payerEmail: customer.email,
                description: `Order ${orderNumber} from ${shopName}`,
                successRedirectUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm`,
                failureRedirectUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?cancelled=1`,
            })
            await payload.update({ collection: 'orders', id: order.id, data: { xenditPaymentRequestId: invoice.id } as Record<string, unknown> })
        } catch (err) {
            await restockAll(payload, decremented)
            await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true }).catch(() => null)
            if (err instanceof XenditError) {
                return NextResponse.json({ success: false, error: { code: 'XENDIT_API_ERROR', message: 'Payment service unavailable. Please try again.' } }, { status: 502 })
            }
            return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } }, { status: 500 })
        }

        // Fire-and-forget buyer confirmation email
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

        const res = NextResponse.json({ success: true, data: { type: 'redirect', sessionUrl: invoice.invoice_url, orderId: order.id, orderNumber } })
        setCookieToken(res, order.id, orderNumber)
        return res

    } catch (err: unknown) {
        console.error('[xendit-checkout] Unexpected error:', err instanceof Error ? err.message : err)
        return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } }, { status: 500 })
    }
}
