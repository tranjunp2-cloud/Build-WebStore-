/**
 * Keep in sync with the fieldMap/base in each src/lib/email/templates/*.ts.
 * Mirrors mergeTemplateConfig defaults so the editor form prefills what the preview renders.
 *
 * For i18n-backed templates: reads directly from en.json / ms.json (single source of truth).
 * For inline-literal templates: copies the literal strings, with {var} tokens for runtime parts.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import type { EmailTemplateType } from './types'

export interface ContentFields {
    subject?: string
    greeting?: string
    ctaLabel?: string
    closing?: string
}

type Locale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

/**
 * Inline strings for order-waiting (mirrors src/lib/email/templates/order-waiting.ts `strings`).
 * order-waiting does NOT accept a config param, so these are the only customisable defaults
 * exposed to the form.
 */
/**
 * Footer line shared by new-order-seller / contact-from-seller / newsletter-seller-digest
 * (their inline `defaults.footerReceiving`). Rendered in the email footer; NOT
 * config-overridable, surfaced so the form input mirrors the preview. {brandName} = shopName.
 */
const SELLER_FOOTER: Record<Locale, string> = {
    en: "You're receiving this as the owner of {brandName}.",
    ms: 'Anda menerima ini sebagai pemilik {brandName}.',
}

const orderWaitingStrings: Record<Locale, { subject: string; ctaLabel: string }> = {
    en: {
        subject: 'Complete your payment — Order',
        ctaLabel: 'Complete Payment',
    },
    ms: {
        subject: 'Selesaikan pembayaran anda — Pesanan',
        ctaLabel: 'Selesaikan Pembayaran',
    },
}

/**
 * Returns the raw default strings for the given template type and locale.
 * {var} tokens are preserved — no substitution is applied (the preview substitutes;
 * the form edits the template string).
 *
 * Fields absent from a template's fieldMap are returned as undefined.
 */
export function getDefaultContentFields(type: EmailTemplateType, locale: Locale): ContentFields {
    const L = locales[locale]
    const order = L.order

    switch (type) {
        // ── Account & Security ─────────────────────────────────────────────

        case 'welcome':
            // base = L.welcome; fieldMap: { subject:'subject', greeting:'greeting', ctaLabel:'cta', closing:'footer' }
            return {
                subject: L.welcome.subject,
                greeting: L.welcome.greeting,
                ctaLabel: L.welcome.cta,
                closing: L.welcome.footer,
            }

        case 'otp-verification':
            // base = L.otp; fieldMap: { subject:'subject', greeting:'greeting', closing:'footer' }
            // greeting OMITTED: L.otp.greeting embeds <strong> markup. The override path HTML-escapes
            // config.greeting, so prefilling it would (a) show raw markup in a plain-text input and
            // (b) render escaped "&lt;strong&gt;" if saved — a non-round-trip degrade. Blank → default kept.
            return {
                subject: L.otp.subject,
                closing: L.otp.footer,
            }

        case 'forgot-password':
            // base = L.forgotPassword; fieldMap: { subject:'subject', greeting:'greeting', ctaLabel:'cta', closing:'footer' }
            return {
                subject: L.forgotPassword.subject,
                greeting: L.forgotPassword.greeting,
                ctaLabel: L.forgotPassword.cta,
                closing: L.forgotPassword.footer,
            }

        case 'password-changed':
            // base = L.passwordChanged; fieldMap: { subject:'subject', greeting:'greeting', closing:'footer' }
            return {
                subject: L.passwordChanged.subject,
                greeting: L.passwordChanged.greeting,
                closing: L.passwordChanged.footer,
            }

        // ── Order Flow ────────────────────────────────────────────────────

        case 'order-confirmation':
            // base = L.order; fieldMap: { greeting:'greeting', ctaLabel:'cta', closing:'farewell' }
            // subject is overridable via manual config?.subject (not fieldMap); defaultSubject branches
            // on data.event. The preview fixture sets NO event → falls to the "placed" default, so the
            // form must mirror that. {brandName} = shopName, {orderNumber} round-trip via vars.
            return {
                subject: locale === 'ms'
                    ? '{brandName} - Anda telah berjaya membuat pesanan - {orderNumber}'
                    : '{brandName} - Your order has been placed - {orderNumber}',
                greeting: order.greeting,
                ctaLabel: order.cta,
                closing: order.farewell,
            }

        case 'order-completed':
            // Same as order-confirmation but the "completed" defaultSubject literal.
            return {
                subject: locale === 'ms'
                    ? '{brandName} - Pesanan anda telah selesai - {orderNumber}'
                    : '{brandName} - Your order has been completed - {orderNumber}',
                greeting: order.greeting,
                ctaLabel: order.cta,
                closing: order.farewell,
            }

        case 'order-cancelled':
            // Two mergeTemplateConfig calls:
            //   orderBase (L.order): { greeting:'greeting', closing:'farewell' }
            //   cancelledOrder (L.cancelledOrder): { subject:'subject', ctaLabel:'cta' }
            // defaultSubject wraps: `${shopName} - ${cancelledOrder.subject} - ${orderNumber}`
            return {
                subject: `{brandName} - ${L.cancelledOrder.subject} - {orderNumber}`,
                greeting: order.greeting,
                ctaLabel: L.cancelledOrder.cta,
                closing: order.farewell,
            }

        case 'order-expired':
            // Two mergeTemplateConfig calls:
            //   orderBase (L.order): { greeting:'greeting', closing:'farewell' }
            //   autoCancelledOrder (L.autoCancelledOrder): { subject:'subject', ctaLabel:'cta' }
            // defaultSubject wraps: `${shopName} - ${autoCancelledOrder.subject} - ${orderNumber}`
            return {
                subject: `{brandName} - ${L.autoCancelledOrder.subject} - {orderNumber}`,
                greeting: order.greeting,
                ctaLabel: L.autoCancelledOrder.cta,
                closing: order.farewell,
            }

        case 'order-refunded':
            // Two mergeTemplateConfig calls:
            //   order (L.order): { greeting:'greeting', closing:'farewell' }
            //   refundedOrder (L.refundedOrder): { subject:'subject', ctaLabel:'cta' }
            // defaultSubject wraps: `${shopName} - ${refundedOrder.subject} - ${orderNumber}`
            return {
                subject: `{brandName} - ${L.refundedOrder.subject} - {orderNumber}`,
                greeting: order.greeting,
                ctaLabel: L.refundedOrder.cta,
                closing: order.farewell,
            }

        // ── Payment ───────────────────────────────────────────────────────

        case 'bank-transfer-instructions':
            // Two mergeTemplateConfig calls (greeting/closing from L.order, ctaLabel from L.bankTransfer).
            // subject is overridable via manual config?.subject; defaultSubject inline literal:
            // `${shopName} - Complete your payment - ${orderNumber}` → {brandName} + {orderNumber} tokens.
            return {
                subject: locale === 'ms'
                    ? '{brandName} - Lengkapkan pembayaran anda - {orderNumber}'
                    : '{brandName} - Complete your payment - {orderNumber}',
                greeting: order.greeting,
                ctaLabel: L.bankTransfer.uploadCta,
                closing: order.farewell,
            }

        case 'payment-confirmed':
            // Inline literal base (not i18n, same for all locales):
            //   base = { subject: `Payment confirmed — Order #${data.orderNumber}`, greeting: 'Hi {customerName}',
            //             cta: 'View Order', footer: '...' }
            // fieldMap: { subject:'subject', greeting:'greeting', ctaLabel:'cta', closing:'footer' }
            return {
                subject: 'Payment confirmed — Order #{orderNumber}',
                greeting: 'Hi {customerName}',
                ctaLabel: 'View Order',
                closing: 'Thank you for shopping with us. If you have questions, please contact our support team.',
            }

        case 'payment-rejected':
            // Inline literal base (not i18n, same for all locales):
            //   base = { subject: `Action required — Order #${data.orderNumber} payment could not be verified`,
            //             greeting: 'Hi {customerName}', cta: 'Re-upload Receipt', footer: '...' }
            // fieldMap: { subject:'subject', greeting:'greeting', ctaLabel:'cta', closing:'footer' }
            return {
                subject: 'Action required — Order #{orderNumber} payment could not be verified',
                greeting: 'Hi {customerName}',
                ctaLabel: 'Re-upload Receipt',
                closing: 'If you believe this is an error, please contact our support team with your order number.',
            }

        case 'order-waiting':
            // No config param accepted (display-only). Rendered subject is
            // `${shopName} - ${inlineSubject} ${orderNumber}` → mirror that structure.
            return {
                subject: `{brandName} - ${orderWaitingStrings[locale].subject} {orderNumber}`,
                greeting: order.greeting,
                ctaLabel: orderWaitingStrings[locale].ctaLabel,
                closing: order.farewell,
            }

        // ── Operations ────────────────────────────────────────────────────

        case 'new-order-seller':
            // fieldMap: { subject, greeting, ctaLabel }. subject embeds customerName and greeting
            // embeds recipientName (sellerName ?? shopName) — NEITHER has a matching {var} token
            // (vars = orderNumber/orderTotal/brandName). Omitted: prefilling would round-trip
            // wrong and an edited+save would persist a degraded subject/greeting. Empty → the
            // template's real default is used at render. ctaLabel is a static overridable string.
            return {
                ctaLabel: locale === 'ms' ? 'Tunaikan Pesanan' : 'Fulfil Order',
                // closing = footer "footerReceiving" (display-only — footer is not config-overridable)
                closing: SELLER_FOOTER[locale],
            }

        // ── Team ─────────────────────────────────────────────────────────

        case 'staff-invitation':
            // Inline literal base. fieldMap: { subject, greeting, ctaLabel:'cta', closing:'footer' }.
            // subject embeds ${workspaceName} which has NO {var} token (vars.brandName is the literal
            // 'PrimeWeb') → omitted to avoid a misleading "join PrimeWeb on PrimeWeb" that would also
            // persist on save. greeting/cta/closing are static/tokenized and round-trip cleanly.
            return {
                greeting: 'Hello {inviteeName}',
                ctaLabel: 'Log In to Accept',
                closing: 'PrimeWeb © 2026. All rights reserved.',
            }

        // ── Seller Communications ─────────────────────────────────────────

        case 'contact-from-seller':
            // fieldMap: { subject, greeting, ctaLabel }. subject = `${shopName} - … - ${visitorName}`
            // → {brandName} + {visitorName} (both in vars). greeting = `Hi ${sellerName}` → {sellerName}.
            return {
                subject: locale === 'ms'
                    ? '{brandName} - Penghantaran borang hubungi baharu daripada {visitorName}'
                    : '{brandName} - New enquiry from {visitorName}',
                greeting: locale === 'ms' ? 'Hai {sellerName},' : 'Hi {sellerName},',
                ctaLabel: locale === 'ms' ? 'Buka Peti Masuk' : 'Open Inbox',
                // closing = footer "footerReceiving" (display-only — footer is not config-overridable)
                closing: SELLER_FOOTER[locale],
            }

        case 'newsletter-seller-digest':
            // fieldMap: { subject, greeting, ctaLabel }. subject = `${shopName} - … : ${subscriberEmail}`
            // → {brandName} + {subscriberEmail} (both in vars). greeting = `Hi ${sellerName}` → {sellerName}.
            return {
                subject: locale === 'ms'
                    ? '{brandName} - Pelanggan surat berita baharu: {subscriberEmail}'
                    : '{brandName} - New subscriber: {subscriberEmail}',
                greeting: locale === 'ms' ? 'Hai {sellerName},' : 'Hi {sellerName},',
                ctaLabel: locale === 'ms' ? 'Buka Peti Masuk' : 'Open Inbox',
                // closing = footer "footerReceiving" (display-only — footer is not config-overridable)
                closing: SELLER_FOOTER[locale],
            }
    }
}
