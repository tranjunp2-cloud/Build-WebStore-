import type { CollectionConfig } from 'payload'

export const Orders: CollectionConfig = {
    slug: 'orders',
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
            return { tenant: { in: tenantIds } }
        },
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
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
            name: 'stripeSessionId',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                readOnly: true,
                description: 'Stripe Checkout Session ID',
            },
        },
        {
            name: 'stripePaymentIntentId',
            type: 'text',
            index: true,
            admin: {
                readOnly: true,
                description: 'Stripe PaymentIntent ID for failure tracking',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Paid', value: 'paid' },
                { label: 'Payment Failed', value: 'payment_failed' },
                { label: 'Processing', value: 'processing' },
                { label: 'Shipped', value: 'shipped' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Refunded', value: 'refunded' },
            ],
        },
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
        {
            name: 'paymentMethod',
            type: 'select',
            options: [
                { label: 'Credit Card', value: 'card' },
                { label: 'Bank Transfer', value: 'bank' },
                { label: 'e-Wallet', value: 'ewallet' },
                { label: 'Cash on Delivery', value: 'cod' },
            ],
        },
        {
            name: 'paymentReference',
            type: 'text',
            admin: { description: 'External payment gateway reference ID' },
        },
        {
            name: 'notes',
            type: 'textarea',
            admin: { description: 'Internal notes about this order' },
        },
    ],
    timestamps: true,
}
