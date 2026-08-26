import { NextResponse } from 'next/server'
import { createInvoice } from '@/lib/payment/xendit'
import { XenditError } from '@/lib/payment/xendit-client'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'
import type { Payload } from 'payload'

interface XenditTenantDoc {
    id: string | number
    name?: string
    slug?: string
    xenditSecretKey?: string | null
}

export async function retryXenditPayment(
    order: Record<string, any>,
    tenantDoc: XenditTenantDoc,
    payload: Payload,
) {
    // Guard: tenant must have connected their own Xendit account (Model C)
    if (!tenantDoc.xenditSecretKey) {
        return NextResponse.json(
            { success: false, error: { code: 'XENDIT_NOT_READY', message: 'Xendit payment temporarily unavailable' } },
            { status: 422 },
        )
    }

    const siteSlug = tenantDoc.slug || String(tenantDoc.id)
    const shopName = tenantDoc.name ?? siteSlug

    let invoice: Awaited<ReturnType<typeof createInvoice>>
    try {
        invoice = await createInvoice({
            apiKey: tenantDoc.xenditSecretKey,
            externalId: String(order.id),
            amount: order.total,
            payerEmail: order.customerEmail,
            description: `Order ${order.orderNumber} from ${shopName}`,
            successRedirectUrl: buildStorefrontUrl(siteSlug, `/order/${order.id}/confirm`),
            failureRedirectUrl: buildStorefrontUrl(siteSlug, `/order/${order.id}/confirm?cancelled=1`),
        })
    } catch (err) {
        console.error('[retry-payment-xendit] createInvoice error:', err instanceof Error ? err.message : err)
        if (err instanceof XenditError) {
            return NextResponse.json(
                { success: false, error: { code: 'XENDIT_API_ERROR', message: 'Payment service is busy. Please try again.' } },
                { status: 502 },
            )
        }
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Retry failed' } },
            { status: 500 },
        )
    }

    // Persist new invoice id; reset a failed order back to awaiting
    const updateData: Record<string, unknown> = {
        xenditPaymentRequestId: invoice.id,
        paymentMethod: 'ewallet',
    }
    if (order.status === 'payment_failed' || order.paymentStatus === 'payment_failed' || order.paymentStatus === 'failed') {
        updateData.status = 'pending'
        updateData.paymentStatus = 'awaiting_payment'
    }
    await payload.update({
        collection: 'orders',
        id: order.id,
        data: updateData,
        overrideAccess: true,
    })

    const confirmToken = generateConfirmToken(order.id, order.orderNumber)
    const res = NextResponse.json({ success: true, data: { type: 'redirect', sessionUrl: invoice.invoice_url, orderId: order.id } })
    res.cookies.set(`ct_${order.id}`, confirmToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
    })
    return res
}
