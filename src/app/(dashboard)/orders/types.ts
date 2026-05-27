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
    pending:      { color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30', label: 'Pending' },
    confirmed:    { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30', label: 'Confirmed' },
    ready_to_ship:{ color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30', label: 'Ready to Ship' },
    shipped:      { color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30', label: 'Shipped' },
    completed:    { color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30', label: 'Completed' },
    cancelled:    { color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30', label: 'Cancelled' },
    refunded:     { color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/30', label: 'Refunded' },
}

export function formatPrice(amount: number, currency: string) {
    if (currency === 'MYR') return `RM ${amount.toFixed(2)}`
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}
