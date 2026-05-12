import { z } from 'zod'

// --- Create Order (manual: COD/QR Banking) ---
export const orderCreateSchema = z.object({
    siteId: z.union([z.string(), z.number()]),
    items: z.array(z.object({
        productId: z.union([z.string(), z.number()]),
        quantity: z.number().min(1),
        variant: z.string().optional(),
    })).min(1),
    customer: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.object({
            line1: z.string().optional(),
            line2: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postcode: z.string().optional(),
            country: z.string().optional(),
        }).optional(),
    }),
    paymentMethod: z.enum(['cod', 'qr_banking']),
    paymentProofImage: z.string().optional(),
}).refine(
    data => data.paymentMethod !== 'qr_banking' || !!data.paymentProofImage,
    { message: 'Payment proof image is required for QR Banking', path: ['paymentProofImage'] }
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
