import type { OrderRefundedData } from '@/lib/email/templates/order-refunded'

type RefundEmailOrderLines = Pick<OrderRefundedData, 'items' | 'subtotal' | 'shippingFee' | 'discountAmount' | 'discountCode' | 'total'>

/**
 * The money part of the refund email, taken from a stored order. Shared by every place that sends
 * order-refunded (in-app refund, Stripe charge.refunded webhook, Xendit cancel) so the lines always add up.
 */
export function refundEmailOrderLines(order: Record<string, any>): RefundEmailOrderLines {
    return {
        items: (order.items ?? []).map((item: any) => ({
            name: item.productName ?? item.name ?? '',
            variant: item.variant ?? null,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            // Order items do not store lineTotal — derive it like the other status emails do.
            lineTotal: item.lineTotal ?? (item.quantity ?? 1) * (item.unitPrice ?? 0),
        })),
        subtotal: order.subtotal ?? 0,
        shippingFee: order.shippingFee ?? 0,
        // discountAmount snapshot is in sen → /100 for RM (template formats with fp())
        discountAmount: order.discountAmount ? order.discountAmount / 100 : null,
        discountCode: order.discountCode ?? null,
        total: order.total ?? 0,
    }
}
