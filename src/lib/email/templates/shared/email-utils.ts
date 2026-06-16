/**
 * Shared types and pure utility functions for order email templates.
 * No HTML — import from email-html-parts.ts for HTML builders.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmailLocale = 'en' | 'ms'

export interface OrderItemRow {
    name: string
    variant?: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
}

export interface AddressShape {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
}

// ── Locale map ────────────────────────────────────────────────────────────────

export const locales = { en: en.email, ms: ms.email } as const

// ── Pure utilities ────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

export function formatPrice(amount: number, currency: string, locale: EmailLocale): string {
    if (currency === 'MYR') return locale === 'ms' ? `RM${amount.toFixed(2)}` : `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
}

export function formatDate(iso: string, locale: EmailLocale): string {
    try {
        return new Date(iso).toLocaleString(locale === 'ms' ? 'en-MY' : 'en-GB', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}

export function buildAddressString(addr: AddressShape | null | undefined): string {
    if (!addr) return '—'
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ')
}

const XENDIT_CHANNEL_LABELS: Record<string, string> = {
    TOUCHNGO: "Touch 'n Go eWallet",
    GRABPAY: 'GrabPay',
    SHOPEEPAY: 'ShopeePay',
    BOOST: 'Boost',
    MAE: 'MAE',
    ATOME: 'Atome',
    QR_CODE: 'DuitNow QR',       // payment_request API channel_code
    DUITNOW_QR: 'DuitNow QR',   // Invoice API payment_channel value
    FPX: 'FPX Online Banking',
    CARDS: 'Credit / Debit Card',
    CREDIT_CARD: 'Credit / Debit Card',
}

export function xenditChannelLabel(channelCode: string | undefined | null): string {
    if (!channelCode) return 'Xendit'
    return XENDIT_CHANNEL_LABELS[channelCode] ?? channelCode
}

export function paymentMethodLabel(method: string, locale: EmailLocale, xenditChannelCode?: string | null): string {
    if (method === 'cod') return 'COD'
    if (method === 'bank_transfer') return locale === 'ms' ? 'Pindahan Bank' : 'Bank Transfer'
    if (method === 'ewallet' || method === 'xendit') return xenditChannelLabel(xenditChannelCode)
    return locale === 'ms' ? 'Kad / FPX' : 'Card / FPX'
}
