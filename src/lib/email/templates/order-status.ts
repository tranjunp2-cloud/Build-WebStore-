/**
 * Order status update email HTML template.
 * Sent when an order's status changes (processing, shipped, delivered, cancelled).
 */

type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'

interface OrderStatusEmailData {
    customerName: string
    orderNumber: string
    status: OrderStatus
    trackingNumber?: string
    trackingUrl?: string
    storeName?: string
}

const STATUS_CONFIG: Record<OrderStatus, { emoji: string; title: string; description: string; color: string }> = {
    processing: {
        emoji: '⏳',
        title: 'Đơn hàng đang xử lý',
        description: 'Đơn hàng của bạn đang được chuẩn bị. Chúng tôi sẽ thông báo khi hàng được gửi đi.',
        color: '#f59e0b',
    },
    shipped: {
        emoji: '🚚',
        title: 'Đơn hàng đã gửi đi',
        description: 'Đơn hàng của bạn đang trên đường giao. Bạn có thể theo dõi đơn hàng bên dưới.',
        color: '#3b82f6',
    },
    delivered: {
        emoji: '✅',
        title: 'Đơn hàng đã giao thành công',
        description: 'Đơn hàng của bạn đã được giao. Cảm ơn bạn đã mua hàng!',
        color: '#10b981',
    },
    cancelled: {
        emoji: '❌',
        title: 'Đơn hàng đã bị hủy',
        description: 'Đơn hàng của bạn đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ chúng tôi.',
        color: '#ef4444',
    },
}

export function orderStatusEmail(data: OrderStatusEmailData): { subject: string; html: string } {
    const { customerName, orderNumber, status, trackingNumber, trackingUrl, storeName = 'PrimeWeb' } = data
    const config = STATUS_CONFIG[status]

    const trackingHtml = (status === 'shipped' && trackingNumber) ? `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 8px; font-weight: 600;">Tracking</p>
            <p style="font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">
                ${trackingUrl
            ? `<a href="${trackingUrl}" style="color: #3b82f6; text-decoration: none;">${trackingNumber}</a>`
            : trackingNumber
        }
            </p>
        </div>
    ` : ''

    return {
        subject: `${config.emoji} ${config.title} — ${orderNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: ${config.color}; padding: 32px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">${config.emoji}</div>
                <h1 style="color: white; font-size: 22px; margin: 0;">${config.title}</h1>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 8px;">Xin chào <strong>${customerName}</strong>,</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
                    ${config.description}
                </p>

                <!-- Order Number -->
                <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="font-size: 12px; text-transform: uppercase; color: #999; margin: 0 0 4px;">Mã đơn hàng</p>
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
