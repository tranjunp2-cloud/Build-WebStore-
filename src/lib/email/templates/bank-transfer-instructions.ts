/**
 * Email template: Bank Transfer Instructions (post-order magic link).
 * Sent immediately after a bank-transfer order is placed.
 * Includes: order summary, bank details, reference code, QR, magic-link CTA.
 *
 * Related: TC-F10-06-07, TC-F10-06-15, PRD FR-15, FR-16
 */

export interface BankTransferInstructionsData {
    orderNumber: string
    customerName: string
    total: number
    currency: string
    /** BT-XXXXXX format — buyer must enter in transfer notes */
    paymentReference: string
    /** Signed JWT URL for post-order upload page */
    magicLinkUrl: string
    /** Plaintext fallback URL (no token — shows instructions page) */
    plainUploadUrl: string
    /** ISO date string for payment deadline */
    expiresAtIso: string
    bankName: string | null
    bankAccountNo: string | null
    bankAccountHolder: string | null
    merchantQrUrl?: string | null
}

function formatPrice(amount: number, currency: string): string {
    if (currency === 'MYR') return `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
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

export function bankTransferInstructionsEmail(
    data: BankTransferInstructionsData,
): { subject: string; html: string } {
    const hasBankDetails =
        data.bankName || data.bankAccountNo || data.bankAccountHolder

    const bankDetailsHtml = hasBankDetails
        ? `
        <div style="margin-top: 24px; background: #f8fafc; border-radius: 8px; padding: 20px; border-left: 4px solid #0ea5e9;">
            <p style="font-size: 12px; text-transform: uppercase; color: #64748b; margin: 0 0 12px; font-weight: 600; letter-spacing: 0.05em;">Bank Transfer Details</p>
            <table style="width: 100%; border-collapse: collapse;">
                ${data.bankName ? `<tr><td style="padding: 6px 0; font-size: 13px; color: #666; width: 140px;">Bank</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${data.bankName}</td></tr>` : ''}
                ${data.bankAccountNo ? `<tr><td style="padding: 6px 0; font-size: 13px; color: #666;">Account No.</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600; font-family: monospace;">${data.bankAccountNo}</td></tr>` : ''}
                ${data.bankAccountHolder ? `<tr><td style="padding: 6px 0; font-size: 13px; color: #666;">Account Name</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${data.bankAccountHolder}</td></tr>` : ''}
            </table>
        </div>`
        : ''

    const qrHtml =
        data.merchantQrUrl
            ? `
        <div style="margin-top: 20px; text-align: center;">
            <p style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin: 0 0 12px;">Or Scan to Pay</p>
            <img src="${data.merchantQrUrl}" alt="Payment QR Code" style="max-width: 200px; border-radius: 8px; border: 1px solid #e2e8f0;" />
        </div>`
        : ''

    return {
        subject: `Order #${data.orderNumber} received — please complete payment`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">Order Received!</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Please complete your payment to confirm this order</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">Hi ${data.customerName},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">Thank you for your order. To confirm it, please complete the bank transfer using the details below and upload your payment receipt.</p>

                <!-- Order Summary -->
                <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 4px;">Order Number</p>
                    <p style="font-size: 22px; font-weight: 700; margin: 0 0 8px; letter-spacing: 1px;">${data.orderNumber}</p>
                    <p style="font-size: 14px; color: #666; margin: 0 0 4px;">Total Amount</p>
                    <p style="font-size: 20px; font-weight: 700; margin: 0; color: #0ea5e9;">${formatPrice(data.total, data.currency)}</p>
                </div>

                <!-- Bank Details -->
                ${bankDetailsHtml}

                <!-- QR Code -->
                ${qrHtml}

                <!-- Reference Code — prominent box -->
                <div style="margin-top: 24px; background: #fefce8; border: 2px solid #eab308; border-radius: 10px; padding: 20px; text-align: center;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 8px;">IMPORTANT — Payment Reference</p>
                    <p style="font-size: 28px; font-weight: 800; font-family: 'Courier New', Courier, monospace; letter-spacing: 3px; margin: 0 0 8px; color: #78350f;">${data.paymentReference}</p>
                    <p style="font-size: 13px; color: #92400e; margin: 0;">Enter this code in your transfer notes / description field</p>
                </div>

                <!-- Expiry Warning -->
                <div style="margin-top: 16px; padding: 12px 16px; background: #fff7ed; border-radius: 8px; border-left: 4px solid #f97316;">
                    <p style="font-size: 13px; color: #9a3412; margin: 0;">
                        <strong>Payment required by:</strong> ${formatDeadline(data.expiresAtIso)}
                    </p>
                    <p style="font-size: 12px; color: #c2410c; margin: 6px 0 0;">Orders without payment confirmation will be automatically cancelled after 24 hours.</p>
                </div>

                <!-- Anti-fraud advisory -->
                <div style="margin-top: 16px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px;">
                    <p style="font-size: 12px; color: #64748b; margin: 0;">
                        <strong>Security reminder:</strong> We will never ask you to transfer money to a different account or via phone/WhatsApp. If you receive such requests, please ignore and report them.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 28px;">
                    <a href="${data.magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">Upload Payment Receipt</a>
                </div>

                <!-- Plaintext fallback -->
                <p style="font-size: 12px; color: #999; text-align: center; margin-top: 16px; word-break: break-all;">
                    Or copy this link: <span style="color: #0ea5e9;">${data.plainUploadUrl}</span>
                </p>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">If you did not place this order, please ignore this email or contact support.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }
}
