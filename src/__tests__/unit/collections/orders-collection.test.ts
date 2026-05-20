import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ORDER_STATUS_TRANSITIONS, Orders } from '@/collections/Orders'

// ─── TC-F10.09: Order status transitions ─────────────────────────────
// ─── TC-F10.32: Bypass state machine validation ──────────────────────

describe('ORDER_STATUS_TRANSITIONS [TC-F10.09, TC-F10.32]', () => {
    it('defines transitions for all expected statuses', () => {
        const expectedStatuses = [
            'pending', 'confirmed', 'ready_to_ship', 'shipped',
            'completed', 'cancelled', 'refunded',
            'paid', 'payment_failed', 'processing',
        ]
        for (const status of expectedStatuses) {
            expect(ORDER_STATUS_TRANSITIONS).toHaveProperty(status)
            expect(Array.isArray(ORDER_STATUS_TRANSITIONS[status])).toBe(true)
        }
    })

    // Happy path transitions
    it('pending → confirmed, cancelled', () => {
        expect(ORDER_STATUS_TRANSITIONS.pending).toContain('confirmed')
        expect(ORDER_STATUS_TRANSITIONS.pending).toContain('cancelled')
    })

    it('confirmed → ready_to_ship, cancelled', () => {
        expect(ORDER_STATUS_TRANSITIONS.confirmed).toContain('ready_to_ship')
        expect(ORDER_STATUS_TRANSITIONS.confirmed).toContain('cancelled')
    })

    it('ready_to_ship → shipped', () => {
        expect(ORDER_STATUS_TRANSITIONS.ready_to_ship).toContain('shipped')
    })

    it('shipped → completed, refunded', () => {
        expect(ORDER_STATUS_TRANSITIONS.shipped).toContain('completed')
        expect(ORDER_STATUS_TRANSITIONS.shipped).toContain('refunded')
    })

    it('completed → refunded only', () => {
        expect(ORDER_STATUS_TRANSITIONS.completed).toEqual(['refunded'])
    })

    // Terminal states
    it('cancelled is a terminal state (no transitions)', () => {
        expect(ORDER_STATUS_TRANSITIONS.cancelled).toEqual([])
    })

    it('refunded is a terminal state (no transitions)', () => {
        expect(ORDER_STATUS_TRANSITIONS.refunded).toEqual([])
    })

    it('payment_failed is a terminal state', () => {
        expect(ORDER_STATUS_TRANSITIONS.payment_failed).toEqual([])
    })

    // Invalid transitions (TC-F10.32)
    it('pending cannot skip to shipped [TC-F10.32]', () => {
        expect(ORDER_STATUS_TRANSITIONS.pending).not.toContain('shipped')
    })

    it('pending cannot skip to completed [TC-F10.32]', () => {
        expect(ORDER_STATUS_TRANSITIONS.pending).not.toContain('completed')
    })

    it('confirmed cannot go back to pending [TC-F10.32]', () => {
        expect(ORDER_STATUS_TRANSITIONS.confirmed).not.toContain('pending')
    })

    it('shipped cannot go back to confirmed [TC-F10.32]', () => {
        expect(ORDER_STATUS_TRANSITIONS.shipped).not.toContain('confirmed')
    })

    // Stripe-specific
    it('paid → processing, cancelled', () => {
        expect(ORDER_STATUS_TRANSITIONS.paid).toContain('processing')
        expect(ORDER_STATUS_TRANSITIONS.paid).toContain('cancelled')
    })

    it('processing → shipped, cancelled', () => {
        expect(ORDER_STATUS_TRANSITIONS.processing).toContain('shipped')
        expect(ORDER_STATUS_TRANSITIONS.processing).toContain('cancelled')
    })
})

describe('ORDER_STATUS_TRANSITIONS — helper validation', () => {
    function isValidTransition(from: string, to: string): boolean {
        return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false
    }

    it('validates full happy path: pending → confirmed → ready_to_ship → shipped → completed', () => {
        expect(isValidTransition('pending', 'confirmed')).toBe(true)
        expect(isValidTransition('confirmed', 'ready_to_ship')).toBe(true)
        expect(isValidTransition('ready_to_ship', 'shipped')).toBe(true)
        expect(isValidTransition('shipped', 'completed')).toBe(true)
    })

    it('validates cancellation at any cancellable stage', () => {
        expect(isValidTransition('pending', 'cancelled')).toBe(true)
        expect(isValidTransition('confirmed', 'cancelled')).toBe(true)
        expect(isValidTransition('processing', 'cancelled')).toBe(true)
    })

    it('rejects invalid backward transition', () => {
        expect(isValidTransition('completed', 'shipped')).toBe(false)
        expect(isValidTransition('shipped', 'ready_to_ship')).toBe(false)
    })

    it('returns false for unknown status', () => {
        expect(isValidTransition('nonexistent', 'confirmed')).toBe(false)
    })
})

// ─── TC-F10.01: COD Auto-pay Hook ──────────────────────────────────────
describe('Orders collection — beforeChange hook', () => {
    // Extract the beforeChange hook from Orders collection config
    const beforeChangeHook = Orders.hooks?.beforeChange?.[0]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F10.01-1] status=completed + paymentMethod=cod → paymentStatus=paid', async () => {
        // Arrange
        const data = {
            status: 'completed',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid' // Before the hook runs
        }
        const originalDoc = {
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid'
        }

        // Act
        const result = await beforeChangeHook({ data, originalDoc })

        // Assert
        expect(result.paymentStatus).toBe('paid')
    })

    it('[TC-F10.01-2] status=completed + paymentMethod=qr_banking → paymentStatus unchanged', async () => {
        // Arrange
        const data = {
            status: 'completed',
            paymentMethod: 'qr_banking',
            paymentStatus: 'paid' // Already paid, should stay paid
        }
        const originalDoc = {
            status: 'pending',
            paymentMethod: 'qr_banking',
            paymentStatus: 'paid'
        }

        // Act
        const result = await beforeChangeHook({ data, originalDoc })

        // Assert
        expect(result.paymentStatus).toBe('paid') // No change
    })

    it('[TC-F10.01-3] status=cancelled + paymentStatus=unpaid → paymentStatus=cancelled', async () => {
        // Arrange
        const data = {
            status: 'cancelled',
            paymentStatus: 'unpaid'
        }
        const originalDoc = {
            status: 'pending',
            paymentStatus: 'unpaid'
        }

        // Act
        const result = await beforeChangeHook({ data, originalDoc })

        // Assert
        expect(result.paymentStatus).toBe('cancelled')
    })

    it('[TC-F10.01-4] status=cancelled + paymentStatus=paid → paymentStatus unchanged (already paid)', async () => {
        // Arrange
        const data = {
            status: 'cancelled',
            paymentStatus: 'paid' // Already paid, should stay as is
        }
        const originalDoc = {
            status: 'pending',
            paymentStatus: 'paid'
        }

        // Act
        const result = await beforeChangeHook({ data, originalDoc })

        // Assert
        expect(result.paymentStatus).toBe('paid') // No change when already paid
    })

    it('[TC-F10.01-5] status no change → no hook modification', async () => {
        // Arrange
        const data = {
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid'
        }
        const originalDoc = {
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid'
        }

        // Act
        const result = await beforeChangeHook({ data, originalDoc })

        // Assert
        expect(result.paymentStatus).toBe('unpaid') // No change
    })
})
