/**
 * Order confirmation email HTML template.
 */

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
    shippingAddress?: {
        line1?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    }
}

function formatPrice(amount: number, currency: string) {
    if (currency === 'MYR') return `RM ${amount.toFixed(2)}`
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}

export function orderConfirmationEmail(data: OrderEmailData): { subject: string; html: string } {
    const itemsHtml = data.items.map(item => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px;">
                ${item.productName}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: center;">
                ${item.quantity}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; font-weight: 600;">
                ${formatPrice(item.unitPrice * item.quantity, data.currency)}
            </td>
        </tr>
    `).join('')

    const addressHtml = data.shippingAddress ? `
        <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 8px;">Shipping Address</p>
            <p style="font-size: 14px; margin: 0; line-height: 1.6;">
                ${data.shippingAddress.line1 || ''}<br>
                ${data.shippingAddress.city || ''}, ${data.shippingAddress.state || ''} ${data.shippingAddress.postcode || ''}<br>
                ${data.shippingAddress.country || 'Malaysia'}
            </p>
        </div>
    ` : ''

    return {
        subject: `Order Confirmed — ${data.orderNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px; text-align: center;">
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">Order Confirmed ✓</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">Thank you for your purchase!</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 4px;">Hi ${data.customerName},</p>
                <p style="font-size: 14px; color: #666; margin: 0 0 24px;">Your order has been placed successfully.</p>

                <!-- Order Number -->
                <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 4px;">Order Number</p>
                    <p style="font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 1px;">${data.orderNumber}</p>
                </div>

                <!-- Items -->
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: left; border-bottom: 2px solid #eee;">Item</th>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: center; border-bottom: 2px solid #eee;">Qty</th>
                            <th style="padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #999; text-align: right; border-bottom: 2px solid #eee;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <!-- Totals -->
                <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #eee;">
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                        <span style="color: #666;">Subtotal</span>
                        <span>${formatPrice(data.subtotal, data.currency)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                        <span style="color: #666;">SST (6%)</span>
                        <span>${formatPrice(data.tax, data.currency)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                        <span>Total</span>
                        <span>${formatPrice(data.total, data.currency)}</span>
                    </div>
                </div>

                ${addressHtml}
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">Powered by PrimeWeb</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
