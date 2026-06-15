import type { CollectionConfig } from 'payload'
import { autoLinkCustomer } from './orders-hooks/auto-link-customer'
import { syncCustomerSnapshot } from './orders-hooks/sync-customer-snapshot'
import { updatePaymentStatus } from './orders-hooks/update-payment-status'
import {
    revalidateBadgeCountsAfterChange,
    revalidateBadgeCountsAfterDelete,
} from '@/lib/dashboard/revalidate-badge-counts-hook'
import { releaseDiscountOnDelete } from './orders-hooks/release-discount-on-delete'

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
            autoLinkCustomer,
            updatePaymentStatus,
        ],
        beforeDelete: [
            releaseDiscountOnDelete,
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
            syncCustomerSnapshot,
            // Bust the sidebar pending-orders badge cache on any create/update (status change)
            revalidateBadgeCountsAfterChange,
        ],
        afterDelete: [
            // Deleting a pending order must drop the badge count too
            revalidateBadgeCountsAfterDelete,
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
                { label: 'Awaiting Payment', value: 'awaiting_payment' },
                { label: 'Pending Verification', value: 'pending_verification' },
                { label: 'Paid', value: 'paid' },
                { label: 'Failed', value: 'failed' },
                { label: 'Payment Failed', value: 'payment_failed' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Cancelled', value: 'cancelled' },
            ],
        },
        {
            name: 'paymentMethod',
            type: 'select',
            options: [
                { label: 'Cash on Delivery', value: 'cod' },
                { label: 'QR Banking (legacy)', value: 'qr_banking' },
                { label: 'Bank Transfer', value: 'bank_transfer' },
                { label: 'Credit Card', value: 'card' },
                { label: 'FPX (Online Banking)', value: 'fpx' },
                { label: 'Bank Transfer (old)', value: 'bank' },
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
            admin: { description: 'Bank Transfer reference code (BT-XXXXXX)' },
        },
        {
            name: 'paymentExpiresAt',
            type: 'date',
            admin: { readOnly: true, description: 'BT order TTL — auto-cancel after this timestamp' },
        },
        {
            name: 'paymentRejectionReason',
            type: 'select',
            options: [
                { label: 'Ảnh mờ', value: 'image_blurry' },
                { label: 'Sai số tiền', value: 'wrong_amount' },
                { label: 'Trùng đơn', value: 'duplicate_order' },
                { label: 'Khác', value: 'other' },
            ],
            admin: { description: 'Reason set when seller rejects payment proof' },
        },
        {
            name: 'paymentRejectionDetail',
            type: 'textarea',
            admin: { description: 'Required if rejectionReason=other (≥10 chars)' },
        },
        {
            name: 'paymentVerifiedAt',
            type: 'date',
            admin: { readOnly: true },
        },
        {
            name: 'paymentVerifiedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { readOnly: true },
        },
        {
            name: 'magicLinkSecret',
            type: 'text',
            access: { read: () => false, update: () => false },
            admin: { hidden: true },
        },
        {
            name: 'verificationSource',
            type: 'select',
            defaultValue: 'manual',
            options: [
                { label: 'Manual', value: 'manual' },
                { label: 'Auto (Open Banking)', value: 'auto' },
            ],
            admin: { readOnly: true },
        },
        {
            name: 'autoVerifiedAt',
            type: 'date',
            admin: { readOnly: true, hidden: true }, // Wave 8+
        },
        {
            name: 'bankTransactionId',
            type: 'text',
            admin: { readOnly: true, hidden: true }, // Wave 8+
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
            admin: {
                description: 'Phone is required to auto-link this order to a customer record. Leave empty only for orders that should stay unlinked.',
            },
        },
        {
            name: 'customer',
            type: 'relationship',
            relationTo: 'customers',
            index: true,
            admin: {
                description: 'Auto-linked customer record (matched by phone + tenant).',
                readOnly: true,
            },
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
        // --- Discount ---
        {
            name: 'discount',
            type: 'relationship',
            relationTo: 'discounts',
            admin: { readOnly: true, description: 'Applied discount code record' },
        },
        {
            name: 'discountCode',
            type: 'text',
            admin: { readOnly: true, description: 'Snapshot of discount code at time of order' },
        },
        {
            name: 'discountAmount',
            type: 'number',
            admin: { readOnly: true, description: 'Discount amount in sen' },
        },
        // --- Stripe card details (for confirm-page "Method" line) ---
        {
            name: 'cardBrand',
            type: 'text',
            admin: { readOnly: true, description: 'Stripe card brand (e.g. visa) — captured from PaymentIntent on payment' },
        },
        {
            name: 'cardLast4',
            type: 'text',
            admin: { readOnly: true, description: 'Last 4 digits of the card used (Stripe) — display only' },
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
