/**
 * Order status update email HTML template.
 * Sent when an order's status changes (processing, shipped, delivered, cancelled).
 * Supports EN (English) and MS (Bahasa Melayu) locales.
 */

import { type EmailLocale, getEmailT } from '../i18n'

type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'

interface OrderStatusEmailData {
    customerName: string
    orderNumber: string
    status: OrderStatus
    locale?: EmailLocale
    trackingNumber?: string
    trackingUrl?: string
    storeName?: string
}

const STATUS_COLORS: Record<OrderStatus, string> = {
    processing: '#f59e0b',
    shipped: '#3b82f6',
    delivered: '#10b981',
    cancelled: '#ef4444',
}

const STATUS_EMOJIS: Record<OrderStatus, string> = {
    processing: '⏳',
    shipped: '🚚',
    delivered: '✅',
    cancelled: '❌',
}

export function orderStatusEmail(data: OrderStatusEmailData): { subject: string; html: string } {
    const { customerName, orderNumber, status, trackingNumber, trackingUrl, storeName = 'PrimeWeb', locale = 'en' } = data
    const t = getEmailT(locale).status
    const statusT = t[status]
    const emoji = STATUS_EMOJIS[status]
    const color = STATUS_COLORS[status]

    const trackingHtml = (status === 'shipped' && trackingNumber) ? `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 8px; font-weight: 600;">${t.tracking}</p>
            <p style="font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">
                ${trackingUrl
            ? `<a href="${trackingUrl}" style="color: #3b82f6; text-decoration: none;">${trackingNumber}</a>`
            : trackingNumber
        }
            </p>
        </div>
    ` : ''

    return {
        subject: `${emoji} ${statusT.title} — ${orderNumber}`,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: ${color}; padding: 32px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">${emoji}</div>
                <h1 style="color: white; font-size: 22px; margin: 0;">${statusT.title}</h1>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 8px;">${t.greeting} <strong>${customerName}</strong>,</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
                    ${statusT.description}
                </p>

                <!-- Order Number -->
                <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 4px;">${t.orderNumber}</p>
                    <p style="font-size: 20px; font-weight: 700; margin: 0; letter-spacing: 1px;">${orderNumber}</p>
                </div>

                ${trackingHtml}
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">Powered by ${storeName}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
