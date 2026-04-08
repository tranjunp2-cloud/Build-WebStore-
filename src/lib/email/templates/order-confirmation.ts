/**
 * Order confirmation email HTML template.
 * Supports EN (English) and MS (Bahasa Melayu) locales.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

interface OrderItem {
    productName: string
    quantity: number
    unitPrice: number
}

interface OrderEmailData {
    orderNumber: string
    customerName: string
    items: OrderItem[]
    subtotal: number
    tax: number
    total: number
    currency: string
    locale?: EmailLocale
    shippingAddress?: {
        line1?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    }
}

/**
 * Format price based on locale per SPEC Rule 3.
 * EN: MYR 299.00 | MS: RM299.00
 */
function formatPrice(amount: number, currency: string, locale: EmailLocale = 'en'): string {
    if (currency === 'MYR') {
        return locale === 'ms'
            ? `RM${amount.toFixed(2)}`
            : `MYR ${amount.toFixed(2)}`
    }
    return `${currency} ${amount.toFixed(2)}`
}

export function orderConfirmationEmail(data: OrderEmailData): { subject: string; html: string } {
    const locale = data.locale || 'en'
    const t = (locales[locale] || locales.en).order

    const itemsHtml = data.items.map(item => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px;">
                ${item.productName}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: center;">
                ${item.quantity}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; font-weight: 600;">
                ${formatPrice(item.unitPrice * item.quantity, data.currency, locale)}
            </td>
        </tr>
    `).join('')

    const addressHtml = data.shippingAddress ? `
        <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 8px;">${t.shippingAddress}</p>
            <p style="font-size: 14px; margin: 0; line-height: 1.6;">
                ${data.shippingAddress.line1 || ''}<br>
                ${data.shippingAddress.city || ''}, ${data.shippingAddress.state || ''} ${data.shippingAddress.postcode || ''}<br>
                ${data.shippingAddress.country || 'Malaysia'}
            </p>
        </div>
    ` : ''

    return {
        subject: `${t.subject} — ${data.orderNumber}`,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">${t.heading}</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">${t.subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">${t.greeting} ${data.customerName},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${t.body}</p>

                <!-- Order Number -->
                <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 4px;">${t.orderNumber}</p>
                    <p style="font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 1px;">${data.orderNumber}</p>
                </div>

                <!-- Items -->
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: left; border-bottom: 2px solid #eee;">${t.item}</th>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: center; border-bottom: 2px solid #eee;">${t.qty}</th>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: right; border-bottom: 2px solid #eee;">${t.amount}</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <!-- Totals -->
                <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #eee;">
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                        <span style="color: #666;">${t.subtotal}</span>
                        <span>${formatPrice(data.subtotal, data.currency, locale)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                        <span style="color: #666;">${t.sst}</span>
                        <span>${formatPrice(data.tax, data.currency, locale)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                        <span>${t.total}</span>
                        <span>${formatPrice(data.total, data.currency, locale)}</span>
                    </div>
                </div>

                ${addressHtml}
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">${t.footer}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
