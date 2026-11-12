type Contact = {
    customerName: string
    customerPhone: string | null
    shippingAddress: { line1: string | null; line2: string | null; city: string | null; state: string | null; postcode: string | null; country: string }
}

/**
 * The public order tracking page is reached with the order number alone (email links, shared URLs); COD / QR order
 * numbers are time-based and guessable. Without the buyer's confirm cookie it shows the first name, the last 3
 * phone digits and the town only, not the street address (TC-PERF-140).
 */
export function maskBuyerContact<T extends Contact>(order: T): T {
    const firstName = order.customerName.trim().split(/\s+/)[0] ?? ''
    const digits = (order.customerPhone ?? '').replace(/\D/g, '')
    return {
        ...order,
        customerName: firstName,
        customerPhone: digits.length >= 3 ? `•••• ${digits.slice(-3)}` : null,
        shippingAddress: { ...order.shippingAddress, line1: null, line2: null },
    }
}
