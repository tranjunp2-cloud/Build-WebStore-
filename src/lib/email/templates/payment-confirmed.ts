/**
 * Email template: Payment Confirmed.
 * Sent to buyer after seller approves the bank-transfer receipt.
 *
 * Related: TC-F10-06-19, PRD FR-21, AC-9
 */

import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

export interface PaymentConfirmedData {
    orderNumber: string
    customerName: string
    total: number
    currency: string
    /** Link to order detail page (plain URL, no token — payment is terminal state) */
    orderPageUrl: string
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

function formatPrice(amount: number, currency: string): string {
    if (currency === 'MYR') return `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
}

export function paymentConfirmedEmail(
    data: PaymentConfirmedData,
    config?: EmailTemplateConfig,
): { subject: string; html: string } {
    const base = {
        subject: `Payment confirmed — Order #${data.orderNumber}`,
        greeting: 'Hi {customerName}',
        cta: 'View Order',
        footer: 'Thank you for shopping with us. If you have questions, please contact our support team.',
    }
    const vars = {
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        orderTotal: formatPrice(data.total, data.currency),
    }
    const t = mergeTemplateConfig(base, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        ctaLabel: 'cta',
        closing: 'footer',
    })
    return {
        subject: t.subject,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">Payment Confirmed ✓</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Your payment has been verified</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">${t.greeting},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">
                    Great news! We have successfully verified your payment. Your order is now confirmed and being processed.
                </p>

                <!-- Order Summary -->
                <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #bbf7d0;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #15803d; font-weight: 600; letter-spacing: 0.05em; margin: 0 0 4px;">Order Confirmed</p>
                    <p style="font-size: 22px; font-weight: 700; margin: 0 0 8px; letter-spacing: 1px;">${escapeHtml(data.orderNumber)}</p>
                    <p style="font-size: 14px; color: #666; margin: 0 0 4px;">Total Paid</p>
                    <p style="font-size: 20px; font-weight: 700; margin: 0; color: #16a34a;">${formatPrice(data.total, data.currency)}</p>
                </div>

                <!-- What's Next -->
                <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                    <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">
                        <strong>What happens next?</strong><br>
                        Our team will prepare your order and update the status as it progresses. You can track your order at any time using the button below.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 28px;">
                    <a href="${data.orderPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">${t.cta}</a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">${t.footer}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }
}
