import type { CollectionConfig } from 'payload'

/**
 * Valid status transitions for manual orders (COD/QR Banking).
 * Exported for reuse in API route validation.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
    pending: ['new', 'confirmed', 'cancelled'],  // 'new' = Stripe webhook success target
    new: ['confirmed', 'cancelled'],
    confirmed: ['ready_to_ship', 'cancelled'],
    ready_to_ship: ['shipped'],
    shipped: ['completed', 'refunded'],
    completed: ['refunded'],
    // Terminal states — no further transitions
    cancelled: [],
    refunded: [],
    // Stripe-specific statuses (kept for backward compat)
    paid: ['processing', 'cancelled'],
    payment_failed: [],
    processing: ['shipped', 'cancelled'],
}

export const Orders: CollectionConfig = {
    slug: 'orders',
    hooks: {
        beforeChange: [
            async ({ data, originalDoc }) => {
                // COD: seller marks completed → auto paymentStatus=paid
                if (
                    data.status === 'completed' &&
                    originalDoc?.status !== 'completed' &&
                    originalDoc?.paymentMethod === 'cod'
                ) {
                    data.paymentStatus = 'paid'
                }
                // Any method cancelled → paymentStatus=cancelled (if still unpaid)
                if (data.status === 'cancelled' && originalDoc?.status !== 'cancelled') {
                    if (!data.paymentStatus || data.paymentStatus === 'unpaid') {
                        data.paymentStatus = 'cancelled'
                    }
                }
                return data
            },
        ],
        afterChange: [
            async ({ doc, operation, req }) => {
                if (operation !== 'create') return doc
                // Skip Stripe orders — they're notified via webhook after payment confirms
                if (doc.stripeSessionId) return doc
                // Fire-and-forget: notify tenant owners of new order (COD/QR Banking)
                import('@/lib/notifications/notify-tenant-owners')
                    .then(({ notifyTenantOwners }) => {
                        const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
                        return notifyTenantOwners(req.payload, tenantId, {
                            type: 'ORDER_NEW',
                            title: `New Order #${doc.orderNumber} - ${doc.currency || 'MYR'} ${(doc.total ?? 0).toFixed(2)}`,
                            message: `Order placed by ${doc.customerName}`,
                            actionUrl: '/orders',
                            metadata: { orderNumber: doc.orderNumber, currency: doc.currency || 'MYR', total: (doc.total ?? 0).toFixed(2), customerName: doc.customerName },
                        })
                    })
                    .catch((err) => console.error('[Notification] ORDER_NEW hook failed', err))
                return doc
            },
        ],
    },
    admin: {
        useAsTitle: 'orderNumber',
        description: 'Customer orders from the storefront.',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        delete: () => false, // Orders should not be deleted
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
        },
        {
            name: 'orderNumber',
            type: 'text',
            required: true,
            unique: true,
            admin: { description: 'Auto-generated order number' },
        },
        {
            name: 'items',
            type: 'array',
            required: true,
            fields: [
                {
                    name: 'product',
                    type: 'relationship',
                    relationTo: 'products',
                    required: true,
                },
                {
                    name: 'productName',
                    type: 'text',
                    required: true,
                    admin: { description: 'Snapshot of product name at time of order' },
                },
                {
                    name: 'variant',
                    type: 'text',
                    admin: { description: 'Variant info (e.g. "Red - M")' },
                },
                {
                    name: 'quantity',
                    type: 'number',
                    required: true,
                    min: 1,
                },
                {
                    name: 'unitPrice',
                    type: 'number',
                    required: true,
                    min: 0,
                },
            ],
        },
        {
            name: 'subtotal',
            type: 'number',
            required: true,
            min: 0,
        },
        {
            name: 'shippingFee',
            type: 'number',
            min: 0,
            defaultValue: 0,
        },
        {
            name: 'tax',
            type: 'number',
            min: 0,
            defaultValue: 0,
        },
        {
            name: 'total',
            type: 'number',
            required: true,
            min: 0,
        },
        {
            name: 'currency',
            type: 'select',
            defaultValue: 'MYR',
            options: [
                { label: 'MYR', value: 'MYR' },
                { label: 'USD', value: 'USD' },
                { label: 'SGD', value: 'SGD' },
            ],
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            index: true,
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'New', value: 'new' },          // Stripe webhook success target (Architecture §2.1)
                { label: 'Confirmed', value: 'confirmed' },
                { label: 'Ready to Ship', value: 'ready_to_ship' },
                { label: 'Shipped', value: 'shipped' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Refunded', value: 'refunded' },
                // Stripe-specific (backward compat)
                { label: 'Paid', value: 'paid' },
                { label: 'Payment Failed', value: 'payment_failed' },
                { label: 'Processing', value: 'processing' },
            ],
        },
        // --- Payment ---
        {
            name: 'paymentStatus',
            type: 'select',
            defaultValue: 'unpaid',
            index: true,
            options: [
                { label: 'Unpaid', value: 'unpaid' },
                { label: 'Paid', value: 'paid' },
                { label: 'Failed', value: 'failed' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Cancelled', value: 'cancelled' },
            ],
        },
        {
            name: 'paymentMethod',
            type: 'select',
            options: [
                { label: 'Cash on Delivery', value: 'cod' },
                { label: 'QR Banking', value: 'qr_banking' },
                { label: 'Credit Card', value: 'card' },
                { label: 'FPX (Online Banking)', value: 'fpx' },
                { label: 'Bank Transfer', value: 'bank' },
                { label: 'e-Wallet', value: 'ewallet' },
                { label: 'Free (100% discount)', value: 'free' },
            ],
        },
        {
            name: 'paymentProofImage',
            type: 'upload',
            relationTo: 'media',
            admin: { description: 'Payment proof image uploaded by customer (QR Banking)' },
        },
        {
            name: 'paymentReference',
            type: 'text',
            admin: { description: 'External payment gateway reference ID' },
        },
        {
            name: 'stripeSessionId',
            type: 'text',
            unique: true,
            index: true,
            admin: { readOnly: true, description: 'Stripe Checkout Session ID' },
        },
        {
            name: 'stripePaymentIntentId',
            type: 'text',
            index: true,
            admin: { readOnly: true, description: 'Stripe PaymentIntent ID' },
        },
        {
            name: 'stripeChargeId',
            type: 'text',
            index: true,
            admin: { readOnly: true, description: 'Stripe Charge ID (from payment_intent.latest_charge)' },
        },
        // --- Customer ---
        {
            name: 'customerEmail',
            type: 'email',
            required: true,
        },
        {
            name: 'customerName',
            type: 'text',
            required: true,
        },
        {
            name: 'customerPhone',
            type: 'text',
        },
        {
            name: 'shippingAddress',
            type: 'group',
            fields: [
                { name: 'line1', type: 'text' },
                { name: 'line2', type: 'text' },
                { name: 'city', type: 'text' },
                { name: 'state', type: 'text' },
                { name: 'postcode', type: 'text' },
                { name: 'country', type: 'text', defaultValue: 'Malaysia' },
            ],
        },
        // --- Delivery ---
        {
            name: 'trackingNumber',
            type: 'text',
            admin: { description: 'Shipping tracking number' },
        },
        // --- Cancellation ---
        {
            name: 'cancelReason',
            type: 'textarea',
            admin: { description: 'Required reason when order is cancelled' },
        },
        // --- Notes ---
        {
            name: 'notes',
            type: 'textarea',
            admin: { description: 'Internal notes about this order' },
        },
    ],
    timestamps: true,
}
