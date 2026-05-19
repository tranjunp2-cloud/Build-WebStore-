import { z } from 'zod'
import { MY_STATES } from '@/lib/shipping'

export const MAX_CHECKOUT_ITEMS = 50

// --- Create Order via Stripe Checkout (FPX / Card) ---
// paymentMethod intentionally omitted — backend builds payment_method_types from tenant flags.
// Legacy clients that still send paymentMethod will have it logged and ignored.
export const stripeCheckoutSchema = z.object({
    siteId: z.union([z.string(), z.number()]),
    items: z.array(z.object({
        productId: z.union([z.string(), z.number()]),
        quantity: z.number().int().min(1).max(100),
        variant: z.string().optional(),
    })).min(1).max(MAX_CHECKOUT_ITEMS),
    customer: z.object({
        name: z.string().min(1).max(150),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        address: z.object({
            line1: z.string().optional(),
            line2: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postcode: z.string().optional(),
            country: z.string().optional(),
        }).optional(),
    }),
})

// --- Create Order (manual: COD/QR Banking) ---
export const orderCreateSchema = z.object({
    siteId: z.union([z.string(), z.number()]),
    items: z.array(z.object({
        productId: z.union([z.string(), z.number()]),
        quantity: z.number().int().min(1),
        variant: z.string().optional(),
    })).min(1).max(MAX_CHECKOUT_ITEMS),
    customer: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.object({
            line1: z.string().optional(),
            line2: z.string().optional(),
            city: z.string().optional(),
            state: z.enum([...MY_STATES]).optional(),
            postcode: z.string().optional(),
            country: z.string().optional(),
        }).optional(),
    }),
    paymentMethod: z.enum(['cod', 'bank_transfer']),
    paymentProofImage: z.string().optional(),
}).refine(
    data => data.paymentMethod !== 'bank_transfer' || !data.paymentProofImage,
    { message: 'Payment proof is not accepted at checkout for bank transfer', path: ['paymentProofImage'] }
)

// --- Update Order Status ---
export const orderStatusUpdateSchema = z.object({
    status: z.enum([
        'pending', 'confirmed', 'ready_to_ship', 'shipped',
        'completed', 'cancelled', 'refunded',
        'paid', 'processing', 'payment_failed',
    ]),
    trackingNumber: z.string().optional(),
    notes: z.string().optional(),
})

// --- Cancel Order ---
export const orderCancelSchema = z.object({
    reason: z.string().min(1, 'Cancel reason is required'),
})

// --- Bulk Status Update ---
export const orderBulkUpdateSchema = z.object({
    orderIds: z.array(z.string().min(1)).min(1),
    status: z.enum([
        'confirmed', 'ready_to_ship', 'shipped',
        'completed', 'cancelled',
    ]),
})

// --- Reject Payment (Bank Transfer) ---
export const rejectPaymentSchema = z.object({
    reason: z.enum(['image_blurry', 'wrong_amount', 'duplicate_order', 'other']),
    detail: z.string().optional(),
}).refine(
    d => d.reason !== 'other' || (d.detail != null && d.detail.trim().length >= 10),
    { message: 'Detail required (≥10 chars) when reason is other', path: ['detail'] }
)
