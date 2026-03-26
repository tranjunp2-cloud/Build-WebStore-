export type OrderItem = {
    product: string | any
    productName: string
    variant: string
    quantity: number
    unitPrice: number
}

export type Order = {
    id: string
    orderNumber: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    shippingAddress?: {
        line1: string
        line2?: string
        city: string
        state: string
        postcode: string
        country: string
    }
    subtotal: number
    tax: number
    total: number
    shippingFee?: number
    currency: string
    status: 'pending' | 'confirmed' | 'ready_to_ship' | 'shipped' | 'completed' | 'cancelled' | 'refunded'
    paymentMethod: 'cod' | 'qr_banking' | 'stripe'
    paymentProofImage?: any
    trackingNumber?: string
    cancelReason?: string
    notes?: string
    items: OrderItem[]
    createdAt: string
}

export const STATUS_CONFIG = {
    pending: { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Pending' },
    confirmed: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Confirmed' },
    ready_to_ship: { color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', label: 'Ready to Ship' },
    shipped: { color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', label: 'Shipped' },
    completed: { color: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Completed' },
    cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Cancelled' },
    refunded: { color: 'bg-gray-500/15 text-gray-400 border-gray-500/30', label: 'Refunded' },
}

export function formatPrice(amount: number, currency: string) {
    if (currency === 'MYR') return `RM ${amount.toFixed(2)}`
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}
