import { describe, it, expect } from 'vitest'
import {
    orderCreateSchema,
    orderStatusUpdateSchema,
    orderCancelSchema,
    orderBulkUpdateSchema,
} from '@/lib/validations/orders'

// ─── TC-F10.09: Invalid order state transitions ──────────────────────
// ─── TC-F10.13: Payment proof for QR banking ─────────────────────────
// ─── TC-F10.16: Cancel reason required ───────────────────────────────
// ─── TC-F10.32: Bypass state machine validation ──────────────────────

describe('orderCreateSchema [TC-F10.09, TC-F10.13]', () => {
    const validOrder = {
        siteId: 'site-1',
        items: [{ productId: 'prod-1', quantity: 2 }],
        customer: {
            name: 'John',
            email: 'john@example.com',
        },
        paymentMethod: 'cod' as const,
    }

    it('accepts valid COD order', () => {
        const result = orderCreateSchema.safeParse(validOrder)
        expect(result.success).toBe(true)
    })

    it('accepts valid QR banking order with payment proof [TC-F10.13]', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            paymentMethod: 'qr_banking',
            paymentProofImage: 'media-123',
        })
        expect(result.success).toBe(true)
    })

    it('accepts siteId as string', () => {
        const result = orderCreateSchema.safeParse(validOrder)
        expect(result.success).toBe(true)
    })

    it('accepts siteId as number', () => {
        const result = orderCreateSchema.safeParse({ ...validOrder, siteId: 42 })
        expect(result.success).toBe(true)
    })

    it('accepts productId as number', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            items: [{ productId: 99, quantity: 1 }],
        })
        expect(result.success).toBe(true)
    })

    it('accepts optional variant field', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            items: [{ productId: 'p1', quantity: 1, variant: 'Red / L' }],
        })
        expect(result.success).toBe(true)
    })

    it('accepts optional customer address', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            customer: {
                ...validOrder.customer,
                phone: '+60123456789',
                address: {
                    line1: '123 Main St',
                    city: 'KL',
                    state: 'Selangor',
                    postcode: '50000',
                    country: 'MY',
                },
            },
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty items array', () => {
        const result = orderCreateSchema.safeParse({ ...validOrder, items: [] })
        expect(result.success).toBe(false)
    })

    it('rejects quantity less than 1', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            items: [{ productId: 'p1', quantity: 0 }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid email', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            customer: { name: 'John', email: 'not-an-email' },
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing customer name', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            customer: { name: '', email: 'john@example.com' },
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid paymentMethod [TC-F10.09]', () => {
        const result = orderCreateSchema.safeParse({
            ...validOrder,
            paymentMethod: 'credit_card',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing items', () => {
        const { items: _, ...noItems } = validOrder
        const result = orderCreateSchema.safeParse(noItems)
        expect(result.success).toBe(false)
    })
})

describe('orderStatusUpdateSchema [TC-F10.09, TC-F10.32]', () => {
    const allStatuses = [
        'pending', 'confirmed', 'ready_to_ship', 'shipped',
        'completed', 'cancelled', 'refunded',
        'paid', 'processing', 'payment_failed',
    ]

    it('accepts all valid status values', () => {
        for (const status of allStatuses) {
            const result = orderStatusUpdateSchema.safeParse({ status })
            expect(result.success).toBe(true)
        }
    })

    it('rejects invalid status value [TC-F10.32]', () => {
        const result = orderStatusUpdateSchema.safeParse({ status: 'invalid_status' })
        expect(result.success).toBe(false)
    })

    it('accepts optional trackingNumber', () => {
        const result = orderStatusUpdateSchema.safeParse({
            status: 'shipped',
            trackingNumber: 'TRACK-123',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.trackingNumber).toBe('TRACK-123')
        }
    })

    it('accepts optional notes', () => {
        const result = orderStatusUpdateSchema.safeParse({
            status: 'cancelled',
            notes: 'Customer requested cancellation',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing status', () => {
        const result = orderStatusUpdateSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

describe('orderCancelSchema [TC-F10.16]', () => {
    it('accepts valid cancel reason', () => {
        const result = orderCancelSchema.safeParse({ reason: 'Changed my mind' })
        expect(result.success).toBe(true)
    })

    it('rejects empty reason [TC-F10.16]', () => {
        const result = orderCancelSchema.safeParse({ reason: '' })
        expect(result.success).toBe(false)
    })

    it('rejects missing reason', () => {
        const result = orderCancelSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

describe('orderBulkUpdateSchema [TC-F10.32]', () => {
    it('accepts valid bulk update', () => {
        const result = orderBulkUpdateSchema.safeParse({
            orderIds: ['order-1', 'order-2'],
            status: 'confirmed',
        })
        expect(result.success).toBe(true)
    })

    it('accepts single orderId', () => {
        const result = orderBulkUpdateSchema.safeParse({
            orderIds: ['order-1'],
            status: 'shipped',
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty orderIds array', () => {
        const result = orderBulkUpdateSchema.safeParse({
            orderIds: [],
            status: 'confirmed',
        })
        expect(result.success).toBe(false)
    })

    it('accepts only restricted status enum (no pending/paid/processing/payment_failed/refunded)', () => {
        const allowedStatuses = ['confirmed', 'ready_to_ship', 'shipped', 'completed', 'cancelled']
        for (const status of allowedStatuses) {
            const result = orderBulkUpdateSchema.safeParse({
                orderIds: ['o1'],
                status,
            })
            expect(result.success).toBe(true)
        }
    })

    it('rejects status values not in bulk enum [TC-F10.32]', () => {
        const disallowed = ['pending', 'paid', 'processing', 'payment_failed', 'refunded']
        for (const status of disallowed) {
            const result = orderBulkUpdateSchema.safeParse({
                orderIds: ['o1'],
                status,
            })
            expect(result.success).toBe(false)
        }
    })

    it('rejects empty string in orderIds', () => {
        const result = orderBulkUpdateSchema.safeParse({
            orderIds: [''],
            status: 'confirmed',
        })
        expect(result.success).toBe(false)
    })
})
