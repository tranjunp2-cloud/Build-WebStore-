/** Payment badge on the buyer's order tracking page: label + style class (`.ot-payment-chip.<cls>`). */
export type PaymentChip = { label: string; cls: 'paid' | 'pending' | 'failed' | 'cancelled' | 'refunded' | 'neutral' }

const METHOD_LABELS: Record<string, string> = { bank_transfer: 'Bank Transfer', card: 'Credit Card', fpx: 'FPX', cod: 'COD', ewallet: 'e-Wallet' }

/**
 * Follows the real payment state. Cancelled and refunded orders used to fall through to
 * "Pending · COD" (GH-2209): a cancelled COD order keeps paymentStatus "unpaid".
 * A cancelled order that was paid and not refunded still shows "Paid" — that is where the money is.
 * GH-2316: a completed COD order keeps paymentStatus "unpaid" (cash is collected at the door and never
 * recorded), so it reads "Cash on delivery" instead of "Pending".
 */
export function getPaymentChip(order: { status: string; paymentStatus?: string | null; paymentMethod?: string | null }): PaymentChip {
    const { status, paymentStatus } = order
    if (status === 'refunded' || paymentStatus === 'refunded') return { label: 'Refunded', cls: 'refunded' }
    if (paymentStatus === 'paid') return { label: 'Paid', cls: 'paid' }
    if (paymentStatus === 'failed' || paymentStatus === 'payment_failed') return { label: 'Payment Failed', cls: 'failed' }
    if (status === 'cancelled' || paymentStatus === 'cancelled') return { label: 'Cancelled', cls: 'cancelled' }
    if (status === 'completed' && order.paymentMethod === 'cod') return { label: 'Cash on delivery', cls: 'neutral' }
    return { label: `Pending · ${METHOD_LABELS[order.paymentMethod ?? ''] ?? 'Pending'}`, cls: 'pending' }
}
