import { describe, it, expect } from 'vitest'
import { ORDER_STATUS_GROUPS, ORDER_STATUS_LABEL_KEY } from '@/lib/orders/status-groups'

// ─────────────────────────────────────────────────────────────────────────────
// TC-F10-1286 — ORDER_STATUS_GROUPS + ORDER_STATUS_LABEL_KEY
// GH-1286: stats boxes count incorrect vs table (DB status vs UI label mismatch)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-F10-1286] ORDER_STATUS_GROUPS', () => {
    it('[TC-F10-1286-01] pending group includes new and payment_failed', () => {
        expect(ORDER_STATUS_GROUPS.pending).toEqual(
            expect.arrayContaining(['pending', 'new', 'payment_failed'])
        )
        expect(ORDER_STATUS_GROUPS.pending).toHaveLength(3)
    })

    it('[TC-F10-1286-02] ready_to_ship group contains only ready_to_ship', () => {
        expect(ORDER_STATUS_GROUPS.ready_to_ship).toEqual(['ready_to_ship'])
    })

    it('[TC-F10-1286-03] confirmed group contains only confirmed', () => {
        expect(ORDER_STATUS_GROUPS.confirmed).toEqual(['confirmed'])
    })

    it('[TC-F10-1286-04] shipped group contains only shipped', () => {
        expect(ORDER_STATUS_GROUPS.shipped).toEqual(['shipped'])
    })

    it('[TC-F10-1286-05] completed group includes paid (Stripe legacy)', () => {
        expect(ORDER_STATUS_GROUPS.completed).toEqual(
            expect.arrayContaining(['completed', 'paid'])
        )
        expect(ORDER_STATUS_GROUPS.completed).toHaveLength(2)
    })

    it('[TC-F10-1286-06] cancelled group contains only cancelled', () => {
        expect(ORDER_STATUS_GROUPS.cancelled).toEqual(['cancelled'])
    })

    it('[TC-F10-1286-07] refunded group contains only refunded', () => {
        expect(ORDER_STATUS_GROUPS.refunded).toEqual(['refunded'])
    })

    it('[TC-F10-1286-08] no DB status appears in more than one group', () => {
        // Arrange
        const allEntries = Object.values(ORDER_STATUS_GROUPS).flat()
        const seen = new Set<string>()

        // Act + Assert — each status must appear exactly once
        for (const status of allEntries) {
            expect(seen.has(status), `"${status}" appears in multiple groups`).toBe(false)
            seen.add(status)
        }
    })
})

describe('[TC-F10-1286] ORDER_STATUS_LABEL_KEY', () => {
    it('[TC-F10-1286-09] pending → label key "pending"', () => {
        expect(ORDER_STATUS_LABEL_KEY.pending).toBe('pending')
    })

    it('[TC-F10-1286-10] new → label key "pending" (shows as Pending badge)', () => {
        expect(ORDER_STATUS_LABEL_KEY.new).toBe('pending')
    })

    it('[TC-F10-1286-11] payment_failed → label key "pending" (shows as Pending badge)', () => {
        expect(ORDER_STATUS_LABEL_KEY.payment_failed).toBe('pending')
    })

    it('[TC-F10-1286-12] ready_to_ship → label key "readyToShip"', () => {
        expect(ORDER_STATUS_LABEL_KEY.ready_to_ship).toBe('readyToShip')
    })

    it('[TC-F10-1286-13] shipped → label key "shipped"', () => {
        expect(ORDER_STATUS_LABEL_KEY.shipped).toBe('shipped')
    })

    it('[TC-F10-1286-14] every OrderStatus key has a defined label key (no undefined)', () => {
        const statuses = Object.keys(ORDER_STATUS_LABEL_KEY)
        for (const s of statuses) {
            expect(
                ORDER_STATUS_LABEL_KEY[s as keyof typeof ORDER_STATUS_LABEL_KEY],
                `"${s}" has no label key`
            ).toBeTruthy()
        }
    })
})
