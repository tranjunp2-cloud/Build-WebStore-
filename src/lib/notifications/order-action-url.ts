/** Dashboard link for an order notification: opens that order, not the order list (#2296). */
export function orderActionUrl(orderId: number | string): string {
    return `/orders/${encodeURIComponent(String(orderId))}`
}
