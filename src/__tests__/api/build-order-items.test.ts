import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

/**
 * Direct unit tests for buildOrderItems.
 * Calls the function with an inline mock Payload — no HTTP layer.
 * TC-IDs: TC-F09.230–236 (GH-1084 Phase 03)
 *
 * Coverage targets: eligibility guard, variant guards, pricing, OOS, non-variant path.
 */

// ─── Mocks (top-level, per testing.md) ────────────────────────────────

const mockFindByID = vi.fn()

// ─── Helpers ──────────────────────────────────────────────────────────

/** Creates an inline mock Payload instance. Reuse per-test; reset in beforeEach. */
function makeMockPayload(): Payload {
    return { findByID: mockFindByID } as unknown as Payload
}

/**
 * Base valid product doc with all required fields.
 * Pass overrides to test specific guard conditions.
 */
function mockProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'prod-1',
        name: 'Shirt',
        price: 50,
        currency: 'MYR',
        inventory: 10,
        status: 'active',       // required for eligibility guard (Phase 02)
        tenant: 'tenant-1',
        images: [],
        hasVariants: false,
        variants: [],
        ...overrides,
    }
}

/** Single-item order for the base product. No variant field. */
const ITEMS_ONE = [{ productId: 'prod-1', quantity: 1 }]
/** Tenant used across all tests. */
const TENANT = 'tenant-1'

// ─── Import source under test (after mocks are set up) ─────────────────

import { buildOrderItems } from '@/app/api/orders/stripe-checkout/build-order-items'

// ─── Tests ────────────────────────────────────────────────────────────

describe('buildOrderItems [TC-F09.230–236: GH-1084 direct unit coverage]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── Eligibility guard (Phase 02) ────────────────────────────────────

    it('[TC-F09.230] product with status=draft → 404 PRODUCT_NOT_FOUND', async () => {
        // Arrange: draft product (inactive in storefront)
        mockFindByID.mockResolvedValueOnce(mockProduct({ status: 'draft' }))

        // Act
        const result = await buildOrderItems(makeMockPayload(), ITEMS_ONE, TENANT)

        // Assert: eligibility guard fires before variant / stock logic
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse!.status).toBe(404)
        const body = await result.errorResponse!.json()
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
        expect(result.orderItems).toHaveLength(0)
    })

    it('[TC-F09.231] product with deletedAt set → 404 PRODUCT_NOT_FOUND', async () => {
        // Arrange: soft-deleted product (deletedAt populated)
        mockFindByID.mockResolvedValueOnce(mockProduct({ deletedAt: '2026-01-01T00:00:00Z' }))

        // Act
        const result = await buildOrderItems(makeMockPayload(), ITEMS_ONE, TENANT)

        // Assert: soft-delete guard fires
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse!.status).toBe(404)
        const body = await result.errorResponse!.json()
        expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
        expect(result.orderItems).toHaveLength(0)
    })

    // ── Variant guards ──────────────────────────────────────────────────

    it('[TC-F09.232] VARIANT_REQUIRED: hasVariants product without variant field → 422', async () => {
        // Arrange: variant product; items omit variant (simulates direct API bypass)
        mockFindByID.mockResolvedValueOnce(mockProduct({
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 5 }],
        }))

        // Act: no variant in items
        const result = await buildOrderItems(makeMockPayload(), ITEMS_ONE, TENANT)

        // Assert: VARIANT_REQUIRED fires before price/stock resolution
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse!.status).toBe(422)
        const body = await result.errorResponse!.json()
        expect(body.error.code).toBe('VARIANT_REQUIRED')
    })

    it('[TC-F09.233] VARIANT_NOT_FOUND: variant name does not exist on product → 422', async () => {
        // Arrange: product has Red variant; request references Purple (stale or typo)
        mockFindByID.mockResolvedValueOnce(mockProduct({
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 5 }],
        }))

        // Act: request non-existent variant Purple
        const result = await buildOrderItems(
            makeMockPayload(),
            [{ productId: 'prod-1', quantity: 1, variant: 'Purple' }],
            TENANT,
        )

        // Assert: VARIANT_NOT_FOUND prevents silent base-price fallback
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse!.status).toBe(422)
        const body = await result.errorResponse!.json()
        expect(body.error.code).toBe('VARIANT_NOT_FOUND')
    })

    // ── Variant pricing ─────────────────────────────────────────────────

    it('[TC-F09.234] variant.price used as unitPrice — not base product.price', async () => {
        // Arrange: base RM 50; Red variant RM 75
        mockFindByID.mockResolvedValueOnce(mockProduct({
            price: 50,
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 5 }],
        }))

        // Act: order Red variant
        const result = await buildOrderItems(
            makeMockPayload(),
            [{ productId: 'prod-1', quantity: 1, variant: 'Red' }],
            TENANT,
        )

        // Assert: no error; unitPrice = variant.price (75 ≠ base 50)
        expect(result.errorResponse).toBeUndefined()
        expect(result.orderItems).toHaveLength(1)
        expect(result.orderItems[0].unitPrice).toBe(75)
        expect(result.orderItems[0].variant).toBe('Red')
        // Stripe line item in sen: 75 * 100 = 7500
        expect(result.checkoutItems[0].price).toBe(7500)
        // Display name includes variant
        expect(result.checkoutItems[0].name).toBe('Shirt (Red)')
        expect(result.subtotal).toBe(75)
    })

    // ── Per-variant stock check (Phase 01) ─────────────────────────

    it('[TC-F09.235] OOS guard uses variant.stock for variant products', async () => {
        // Arrange: variant.stock=0 (exhausted); aggregate inventory=10 (irrelevant for variants).
        // Guard must fire on variant.stock, not p.inventory (per-variant decrement in place).
        mockFindByID.mockResolvedValueOnce(mockProduct({
            inventory: 10,
            hasVariants: true,
            variants: [{ name: 'Red', price: 75, stock: 0 }], // Red variant is out of stock
        }))

        // Act: request 1 unit of Red variant
        const result = await buildOrderItems(
            makeMockPayload(),
            [{ productId: 'prod-1', quantity: 1, variant: 'Red' }],
            TENANT,
        )

        // Assert: OUT_OF_STOCK based on variant.stock=0, not p.inventory=10
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse!.status).toBe(422)
        const body = await result.errorResponse!.json()
        expect(body.error.code).toBe('OUT_OF_STOCK')
    })

    // ── Non-variant happy path ───────────────────────────────────────────

    it('[TC-F09.236] non-variant product: base price used, no variant guards — happy path', async () => {
        // Arrange: simple product without variants
        mockFindByID.mockResolvedValueOnce(mockProduct({
            price: 49.9,
            hasVariants: false,
            variants: [],
        }))

        // Act: no variant field (correct for non-variant product)
        const result = await buildOrderItems(makeMockPayload(), ITEMS_ONE, TENANT)

        // Assert: success; base price; no variant name in display
        expect(result.errorResponse).toBeUndefined()
        expect(result.orderItems).toHaveLength(1)
        expect(result.orderItems[0].unitPrice).toBe(49.9)
        expect(result.orderItems[0].variant).toBe('')
        expect(result.checkoutItems[0].name).toBe('Shirt')
        // Stripe price in sen: Math.round(49.9 * 100) = 4990
        expect(result.checkoutItems[0].price).toBe(4990)
        expect(result.subtotal).toBe(49.9)
    })
})
