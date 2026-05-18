/**
 * Email template: Order Expired / Cancelled.
 * Sent to buyer when a bank-transfer order is auto-cancelled
 * after 24 hours without payment confirmation.
 *
 * Related: TC-F10-06-09, PRD FR-21
 */

export interface OrderExpiredData {
    orderNumber: string
    customerName: string
    total: number
    currency: string
    /** Link to product listing so buyer can re-order */
    productListUrl: string
}

function formatPrice(amount: number, currency: string): string {
    if (currency === 'MYR') return `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
}

export function orderExpiredEmail(
    data: OrderExpiredData,
): { subject: string; html: string } {
    return {
        subject: `Order #${data.orderNumber} has been cancelled`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #64748b, #475569); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">Order Cancelled</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Payment was not received within the required time</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">Hi ${data.customerName},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">
                    Unfortunately, your order <strong>#${data.orderNumber}</strong> has been automatically cancelled because payment was not received within 24 hours.
                </p>

                <!-- Order Summary -->
                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em; margin: 0 0 4px;">Cancelled Order</p>
                    <p style="font-size: 22px; font-weight: 700; margin: 0 0 8px; letter-spacing: 1px; color: #64748b;">${data.orderNumber}</p>
                    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 4px;">Order Total</p>
                    <p style="font-size: 18px; font-weight: 600; margin: 0; color: #94a3b8;">${formatPrice(data.total, data.currency)}</p>
                </div>

                <!-- Explanation -->
                <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #94a3b8;">
                    <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">
                        Bank transfer orders require payment confirmation within <strong>24 hours</strong> of placement. Any reserved stock has been released and is available for other customers.
                    </p>
                </div>

                <!-- Encourage re-order -->
                <p style="font-size: 14px; color: #666; margin: 24px 0 0; text-align: center;">
                    Still interested? Browse our products and place a new order.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 16px;">
                    <a href="${data.productListUrl}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">Browse Products</a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">If you have questions about this cancellation, please contact our support team with your order number.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }
}
