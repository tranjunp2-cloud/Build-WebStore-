import type { CollectionConfig } from 'payload'
import { autoLinkCustomer } from './orders-hooks/auto-link-customer'
import { syncCustomerSnapshot } from './orders-hooks/sync-customer-snapshot'
import { updatePaymentStatus } from './orders-hooks/update-payment-status'
import {
    revalidateBadgeCountsAfterChange,
    revalidateBadgeCountsAfterDelete,
} from '@/lib/dashboard/revalidate-badge-counts-hook'
import { releaseDiscountOnDelete } from './orders-hooks/release-discount-on-delete'
import { runAfterResponse } from '@/lib/runtime/run-after-response'

/**
 * Valid status transitions for manual orders (COD/QR Banking).
 * Exported for reuse in API route validation.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
    pending: ['new', 'confirmed', 'cancelled'],  // 'new' = Stripe webhook success target
    new: ['confirmed', 'cancelled'],
    confirmed: ['ready_to_ship', 'cancelled'],
    // BR-Cancel-02 (chốt 2026-07-07): cancel chỉ ở pending/confirmed — đơn đã mua label
    // (ready_to_ship) không hủy qua /cancel nữa; xử lý tiền/label đi đường refund (US-F36-11).
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
                // Notify tenant owners of new order (COD/QR Banking) after the response is sent.
                // Do not capture `req` in the task: it outlives the request/transaction.
                const payload = req.payload
                const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
                const orderId = doc.id
                runAfterResponse('Notification ORDER_NEW', async () => {
                    // Checkout deletes the order again when discount/stock reservation fails;
                    // since this runs after the response, skip orders that no longer exist.
                    const stillExists = await payload.findByID({
                        collection: 'orders', id: orderId, depth: 0, overrideAccess: true, disableErrors: true,
                    })
                    // A failed rollback delete can leave the row behind as `cancelled`.
                    if (!stillExists || stillExists.status === 'cancelled') return
                    const { notifyTenantOwners } = await import('@/lib/notifications/notify-tenant-owners')
                    await notifyTenantOwners(payload, tenantId, {
                        type: 'ORDER_NEW',
                        title: `New Order #${doc.orderNumber} - ${doc.currency || 'MYR'} ${(doc.total ?? 0).toFixed(2)}`,
                        message: `Order placed by ${doc.customerName}`,
                        actionUrl: '/orders',
                        metadata: { orderNumber: doc.orderNumber, currency: doc.currency || 'MYR', total: (doc.total ?? 0).toFixed(2), customerName: doc.customerName },
                        dedupeKey: `ORDER_NEW:${doc.orderNumber}`,
                    })
                })
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
                    admin: { description: 'Optional catalog link; historical item snapshots remain valid after a product is removed.' },
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
            name: 'locale',
            type: 'select',
            options: [
                { label: 'Bahasa Melayu', value: 'ms' },
                { label: 'English', value: 'en' },
            ],
            defaultValue: 'en',
            admin: {
                description: 'Locale snapshot at order creation — used for buyer emails. Do not edit.',
                readOnly: true,
            },
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
            name: 'paymentReminderSentAt',
            type: 'date',
            admin: { readOnly: true, hidden: true, description: 'Timestamp when order-waiting reminder email was sent' },
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
        {
            name: 'xenditPaymentRequestId',
            type: 'text',
            index: true,
            admin: { readOnly: true, description: 'Xendit Payment Request ID (pr-...)' },
        },
        {
            name: 'xenditChannelCode',
            type: 'text',
            admin: { readOnly: true, description: 'Xendit channel: TOUCHNGO | GRABPAY | SHOPEEPAY | QR_CODE | FPX | CARDS' },
        },
        {
            name: 'paymentProvider',
            type: 'select',
            index: true,
            options: [
                { label: 'Stripe', value: 'stripe' },
                { label: 'Xendit', value: 'xendit' },
            ],
            admin: { readOnly: true, description: 'Online payment provider — null for BT/COD/legacy' },
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
        // --- EasyParcel Shipping ---
        {
            name: 'shippingCourier',
            type: 'text',
            admin: { description: 'EasyParcel courier ID (e.g. flash, jnt, poslaju)' },
        },
        {
            name: 'shippingCourierName',
            type: 'text',
            admin: { description: 'Friendly courier name from rate response, e.g. J&T Express' },
        },
        {
            name: 'shippingCourierLogo',
            type: 'text',
            admin: {
                description: "EP courier_logo URL, captured at checkout from the rate quotation (it IS on the quotation — live probe 2026-07-14: 23/23 couriers). Persisted because the buyer's tracking page has no EP token of its own. Cosmetic: absent on pre-existing orders and whenever EP omits it; the UI falls back to an icon.",
            },
        },
        {
            name: 'shippingServiceId',
            type: 'text',
            admin: { description: 'EasyParcel service_id from rate response' },
        },
        {
            name: 'awbNo',
            type: 'text',
            index: true,
            admin: { description: 'Air Waybill (tracking) number — idempotency key for label creation' },
        },
        {
            name: 'easyParcelOrderNo',
            type: 'text',
            admin: { description: 'EP order_no from EPSubmitOrderBulk — buyer-hidden', hidden: true },
        },
        {
            name: 'labelUrl',
            type: 'text',
            admin: { description: 'PDF label URL from EPPayOrderBulk — buyer-hidden', hidden: true },
        },
        {
            name: 'labelUrls',
            type: 'json',
            admin: { description: 'Per-format label PDF URLs from EP awb_urls_by_format ({A4?, A6?}) — powers the print-modal format toggle', hidden: true },
        },
        {
            name: 'labelPrintedAt',
            type: 'date',
            admin: { description: 'Set when the merchant prints the label with "Mark as printed" checked', hidden: true },
        },
        {
            name: 'shippingTrackingStatus',
            type: 'select',
            index: true,
            options: [
                { label: 'Order Created', value: 'order_created' },
                { label: 'Pending Pickup', value: 'pending_pickup' },
                { label: 'Picked Up', value: 'picked_up' },
                { label: 'In Transit', value: 'in_transit' },
                { label: 'Out for Delivery', value: 'out_for_delivery' },
                { label: 'Delivered', value: 'delivered' },
                { label: 'Failed Delivery', value: 'failed_delivery' },
                { label: 'Returned to Sender', value: 'returned_to_sender' },
                { label: 'Lost', value: 'lost' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Exception', value: 'exception' },
                { label: 'Processing', value: 'processing' },
                { label: 'Unknown', value: 'unknown' },
            ],
            admin: { description: 'EP tracking status (synced by cron every 30min)' },
        },
        {
            name: 'shippingTrackingLastUpdated',
            type: 'date',
            admin: { readOnly: true, description: 'Timestamp of last EP tracking sync by cron' },
        },
        {
            name: 'parcelWeight',
            type: 'number',
            admin: { description: 'Parcel weight in grams (aggregated from order items)' },
        },
        {
            name: 'selfDeliveryCourier',
            type: 'text',
            admin: { description: 'Manual courier name when EasyParcel not used (self-delivery flow)' },
        },
        {
            name: 'pickupScheduledAt',
            type: 'date',
            admin: { description: 'Chosen EasyParcel collection date (used for pickup and drop-off labels)' },
        },
        {
            name: 'collectionMethod',
            type: 'select',
            options: [
                { label: 'Pickup', value: 'pickup' },
                { label: 'Drop-off', value: 'dropoff' },
            ],
            admin: { description: 'Collection method selected when the EasyParcel label was created' },
        },
        {
            name: 'pickupSlot',
            type: 'text',
            admin: { description: "Pickup time slot label — 'am' or 'pm' (optional)" },
        },
        {
            name: 'codAmount',
            type: 'number',
            admin: { description: 'COD amount in sen (integer). NOT RM. Divide by 100 when calling EP API.' },
        },
        {
            name: 'codStatus',
            type: 'select',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Collected', value: 'collected' },
                { label: 'Settled', value: 'settled' },
            ],
            admin: { description: 'COD collection status from courier' },
        },
        {
            name: 'shippingTrackingHistory',
            type: 'array',
            admin: { description: 'History of EP tracking events (synced by cron)' },
            fields: [
                { name: 'status', type: 'text' },
                { name: 'description', type: 'text' },
                { name: 'eventTime', type: 'date' },
                {
                    name: 'collectionMethod',
                    type: 'select',
                    options: [
                        { label: 'Pickup', value: 'pickup' },
                        { label: 'Drop-off', value: 'dropoff' },
                    ],
                    admin: { description: 'Collection method snapshot for this tracking event' },
                },
                {
                    name: 'source',
                    type: 'select',
                    options: [
                        { label: 'EasyParcel', value: 'easyparcel' },
                        { label: 'CMS Manual', value: 'cms_manual' },
                    ],
                    admin: { hidden: true, description: 'Origin of this fulfillment event' },
                },
                {
                    name: 'actorId',
                    type: 'text',
                    admin: { hidden: true, description: 'User ID that performed a manual fulfillment action' },
                },
                {
                    name: 'actorLabel',
                    type: 'text',
                    admin: { hidden: true, description: 'User label snapshot retained for fulfillment audit' },
                },
                {
                    name: 'previousStatus',
                    type: 'text',
                    admin: { hidden: true, description: 'Order status before this manual fulfillment action' },
                },
                {
                    name: 'nextStatus',
                    type: 'text',
                    admin: { hidden: true, description: 'Order status after this manual fulfillment action' },
                },
            ],
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
