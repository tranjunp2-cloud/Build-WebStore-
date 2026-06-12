import type { XenditChannelCode } from '@/lib/payment/xendit'

interface TenantPayments {
    xendit_tng?: boolean
    xendit_grabpay?: boolean
    xendit_duitnow?: boolean
    xendit_fpx?: boolean
    xendit_shopeepay?: boolean
    xendit_boost?: boolean
    xendit_mae?: boolean
}

/** Return set of Xendit channels enabled at tenant level. */
export function buildEnabledChannels(payments: TenantPayments | undefined): Set<XenditChannelCode> {
    const enabled = new Set<XenditChannelCode>()
    if (!payments) return enabled
    if (payments.xendit_tng) enabled.add('TOUCHNGO')
    if (payments.xendit_grabpay) enabled.add('GRABPAY')
    if (payments.xendit_shopeepay) enabled.add('SHOPEEPAY')
    if (payments.xendit_boost) enabled.add('BOOST')
    if (payments.xendit_mae) enabled.add('MAE')
    if (payments.xendit_duitnow) enabled.add('QR_CODE')
    if (payments.xendit_fpx) enabled.add('FPX')
    return enabled
}
