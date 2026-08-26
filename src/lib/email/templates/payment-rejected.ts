/**
 * Email template: Payment Rejected.
 * Sent to buyer after seller rejects the bank-transfer receipt.
 * Includes rejection reason + new magic link for re-upload.
 *
 * Related: TC-F10-06-23, TC-F10-06-24, PRD BR-Payment-05
 */

import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

export type RejectionReason = 'image_blurry' | 'wrong_amount' | 'duplicate_order' | 'other'

export interface PaymentRejectedData {
    orderNumber: string
    customerName: string
    rejectionReason: RejectionReason
    /** Required when rejectionReason === 'other' */
    rejectionDetail?: string
    /** New signed JWT URL (secret rotated on reject — old link now invalid) */
    magicLinkUrl: string
    /** Plaintext fallback URL */
    plainUploadUrl: string
    /** ISO date string for new payment deadline */
    expiresAtIso: string
}

const REJECTION_REASON_MAP: Record<RejectionReason, string> = {
    image_blurry: 'Receipt image unclear — please upload a clearer photo',
    wrong_amount: 'Incorrect amount — the transfer amount does not match the order total',
    duplicate_order: 'Duplicate order detected — this payment may have already been processed',
    other: '', // resolved dynamically
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

function formatDeadline(isoDate: string): string {
    try {
        return new Date(isoDate).toLocaleString('en-MY', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        })
    } catch {
        return isoDate
    }
}

function resolveReason(reason: RejectionReason, detail?: string): string {
    if (reason === 'other') {
        return detail ?? 'Please contact support for assistance'
    }
    return REJECTION_REASON_MAP[reason]
}

export function paymentRejectedEmail(
    data: PaymentRejectedData,
    config?: EmailTemplateConfig,
): { subject: string; html: string } {
    const reasonText = resolveReason(data.rejectionReason, data.rejectionDetail)
    const base = {
        subject: `Action required — Order #${data.orderNumber} payment could not be verified`,
        greeting: 'Hi {customerName}',
        cta: 'Re-upload Receipt',
        footer: 'If you believe this is an error, please contact our support team with your order number.',
    }
    const vars = {
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        rejectionReason: reasonText,
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
            <div style="background: linear-gradient(135deg, #f97316, #ef4444); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">Payment Could Not Be Verified</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Action required — please re-upload your receipt</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">${t.greeting},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">
                    We were unable to verify your payment for order <strong>#${escapeHtml(data.orderNumber)}</strong>. Please see the reason below and re-upload a valid receipt.
                </p>

                <!-- Rejection Reason -->
                <div style="background: #fff1f2; border-radius: 8px; padding: 20px; border-left: 4px solid #ef4444;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #be123c; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 8px;">Reason for Rejection</p>
                    <p style="font-size: 14px; color: #881337; margin: 0; line-height: 1.6;">${escapeHtml(reasonText)}</p>
                </div>

                <!-- New Deadline -->
                <div style="margin-top: 16px; padding: 12px 16px; background: #fff7ed; border-radius: 8px; border-left: 4px solid #f97316;">
                    <p style="font-size: 13px; color: #9a3412; margin: 0;">
                        <strong>New payment deadline:</strong> ${formatDeadline(data.expiresAtIso)}
                    </p>
                    <p style="font-size: 12px; color: #c2410c; margin: 6px 0 0;">Your order will be cancelled if payment is not verified by this time.</p>
                </div>

                <!-- Instructions -->
                <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                    <p style="font-size: 13px; color: #475569; margin: 0 0 8px;"><strong>How to resolve:</strong></p>
                    <ol style="font-size: 13px; color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li>Ensure your receipt image is clear and all details are visible</li>
                        <li>Confirm the transfer amount matches the order total exactly</li>
                        <li>Use the button below to upload a new receipt</li>
                    </ol>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 28px;">
                    <a href="${data.magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ef4444); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">${t.cta}</a>
                </div>

                <!-- Plaintext fallback -->
                <p style="font-size: 12px; color: #999; text-align: center; margin-top: 16px; word-break: break-all;">
                    Or copy this link: <span style="color: #f97316;">${data.plainUploadUrl}</span>
                </p>
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
