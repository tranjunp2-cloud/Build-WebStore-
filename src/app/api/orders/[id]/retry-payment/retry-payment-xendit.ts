import { NextResponse } from 'next/server'
import { createPaymentRequest, mapChannelToPaymentMethod, type XenditChannelCode } from '@/lib/payment/xendit'
import { XenditError } from '@/lib/payment/xendit-client'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import type { Payload } from 'payload'

interface XenditTenantDoc {
    id: string | number
    slug?: string
    xenditAccountId?: string | null
    xenditOnboardingComplete?: boolean
}

export async function retryXenditPayment(
    order: Record<string, any>,
    tenantDoc: XenditTenantDoc,
    payload: Payload,
) {
    // Guard: tenant must have completed Xendit onboarding
    const forUserId = tenantDoc.xenditAccountId
    if (!forUserId || !tenantDoc.xenditOnboardingComplete) {
        return NextResponse.json(
            { success: false, error: { code: 'XENDIT_NOT_READY', message: 'Xendit payment temporarily unavailable' } },
            { status: 422 },
        )
    }

    const channelCode = (order.xenditChannelCode ?? 'TOUCHNGO') as XenditChannelCode
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const siteSlug = tenantDoc.slug || String(tenantDoc.id)

    let pr: Awaited<ReturnType<typeof createPaymentRequest>>
    try {
        pr = await createPaymentRequest({
            forUserId,
            referenceId: String(order.id),
            // Xendit MYR = major unit (RM). order.total is already RM. NO *100.
            amount: order.total,
            channelCode,
            customerEmail: order.customerEmail,
            successReturnUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm`,
            failureReturnUrl: `${baseUrl}/sites/${siteSlug}/order/${order.id}/confirm?cancelled=1`,
        })
    } catch (err) {
        console.error('[retry-payment-xendit] createPaymentRequest error:', err instanceof Error ? err.message : err)
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

    // Persist new PR id (overwrites old — non-unique index, see phase 01 schema notes)
    // Reset payment_status to awaiting_payment if order was in failed state
    const updateData: Record<string, unknown> = {
        xenditPaymentRequestId: pr.id,
        paymentMethod: mapChannelToPaymentMethod(channelCode),
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

    // Refresh ct_ cookie
    const confirmToken = generateConfirmToken(order.id, order.orderNumber)

    // Response branch: QR vs redirect
    const presentAction = pr.actions?.find((a) => a.action === 'PRESENT_TO_CUSTOMER')
    const redirectAction = pr.actions?.find((a) => a.action === 'REDIRECT')

    const responseData = presentAction?.qr_code
        ? { type: 'qr', qrString: presentAction.qr_code, amount: order.total }
        : redirectAction?.url
            ? { type: 'redirect', sessionUrl: redirectAction.url }
            : null

    if (!responseData) {
        return NextResponse.json(
            { success: false, error: { code: 'XENDIT_NO_ACTION', message: 'No payment action returned.' } },
            { status: 502 },
        )
    }

    const res = NextResponse.json({ success: true, data: { ...responseData, orderId: order.id } })
    res.cookies.set(`ct_${order.id}`, confirmToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
    })
    return res
}
