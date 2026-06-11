import type { XenditChannelCode } from '@/lib/payment/xendit'

interface TenantPayments {
    xendit_tng?: boolean
    xendit_grabpay?: boolean
    xendit_duitnow?: boolean
    xendit_fpx?: boolean
}

/** Return set of Xendit channels enabled at tenant level (Phase B: TNG/GrabPay/DuitNow/FPX). */
export function buildEnabledChannels(payments: TenantPayments | undefined): Set<XenditChannelCode> {
    const enabled = new Set<XenditChannelCode>()
    if (!payments) return enabled
    if (payments.xendit_tng) enabled.add('TOUCHNGO')
    if (payments.xendit_grabpay) enabled.add('GRABPAY')
    if (payments.xendit_duitnow) enabled.add('QR_CODE')
    if (payments.xendit_fpx) enabled.add('FPX')
    return enabled
}
