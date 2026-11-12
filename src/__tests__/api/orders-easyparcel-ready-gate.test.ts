/**
 * EasyParcel Ready-Gate Tests — F36 Phase 04 [GH-1333]
 * Regression tests for order-flow ready-gate: when EP is enabled and ready (token + default warehouse complete),
 * checkout uses EP rates with auto-cheapest courier selection. Otherwise falls back to flat rate.
 * Courier selection is NO LONGER user-configurable; checkout always picks the cheapest EP option.
 *
 * TC-F36.xx references from docs/qa/F36-easyparcel.md (if exists) or relative to F14 shipping baseline.
 * This test file extends orders-calculate-shipping.test.ts with EP-specific ready-gate scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/shipping/get-rates', () => ({
    getRates: vi.fn(),
}))
vi.mock('@/lib/shipping/easyparcel/token-manager', () => ({
    getValidToken: vi.fn(),
}))

import { POST } from '@/app/api/orders/calculate-shipping/route'
import { getPayload } from 'payload'
import { getRates } from '@/lib/shipping/get-rates'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
// #2179: store availability has its own tests (store-unavailable.test.ts); here a store is unavailable only when suspended.
vi.mock('@/lib/storefront/store-availability', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/storefront/store-availability')>()),
    isTenantUnavailable: vi.fn(async (_payload: unknown, tenant: { status?: unknown } | null) => tenant?.status === 'suspended'),
    isTenantIdUnavailable: vi.fn(async () => false),
    isSiteDocTenantUnavailable: vi.fn(async (_payload: unknown, site: { tenant?: { status?: unknown } | unknown }) => (site.tenant as { status?: unknown } | null)?.status === 'suspended'),
}))

// ─── Helpers ──────────────────────────────────────────────────────────

function callPost(body: unknown) {
    return POST(new Request('http://localhost/api/orders/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }))
}

/**
 * Mock site + tenant with given EP integration config.
 * If tenantId provided, also mock the tenant findByID for EP config.
 */
function mockSiteWithTenant(
    shippingConfig: any,
    tenantId: string,
    epIntegration: any = {},
) {
    // Site findByID returns site with tenant reference
    mockFindByID.mockImplementation((opts) => {
        if (opts.collection === 'sites') {
            return Promise.resolve({
                id: 'site-1',
                shippingConfig,
                tenant: { id: tenantId },
            })
        }
        if (opts.collection === 'tenants') {
            return Promise.resolve({
                id: tenantId,
                easyParcelIntegration: epIntegration,
            })
        }
        return Promise.resolve(null)
    })
}

const validBase = { siteId: 'site-1', state: 'Selangor', subtotalSen: 5000 }
const tenantId = 'tenant-1'

// ─── EP Ready-Gate Tests ──────────────────────────────────────────────

describe('POST /api/orders/calculate-shipping — EP ready-gate [TC-F36.xx]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getRates).mockClear()
        vi.mocked(getValidToken).mockClear()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.01: EP Ready: accessToken + complete default warehouse
    // → uses EP (calls getRates with auto-cheapest)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.01] EP enabled=true + isEpReady=true (token + warehouse) → uses EP rates, not flat', async () => {
        // Arrange: Complete EP config
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ Warehouse',
            phone: '0123456789',
            address1: 'No.12 Jalan Merdeka',
            city: 'Kuala Lumpur',
            state: 'Selangor',
            postcode: '47810',
            country: 'MY',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'valid-token-xyz',
            refreshToken: 'refresh-xyz',
            tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
            warehouses: [completeWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Mock getValidToken to return the token
        vi.mocked(getValidToken).mockResolvedValue('valid-token-xyz')

        // Mock getRates to return a single EP rate (not flat rate)
        const mockEpRate = {
            courier: 'easyparcel',
            serviceId: 'ep-standard',
            courierName: 'EasyParcel',
            serviceName: 'Standard Delivery',
            priceSen: 1200, // RM 12
            codAvailable: true,
            estDelivery: '2-3 business days',
        }
        vi.mocked(getRates).mockResolvedValue({
            rates: [mockEpRate],
            degraded: false,
        })

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.fee).toBe(12) // RM 12 (from EP, not flat rate)
        expect(body.data.rates).toHaveLength(1)
        expect(body.data.rates[0].courier).toBe('easyparcel')
        expect(body.data.degraded).toBe(false)

        // Verify EP was actually called (not flat-rate path)
        expect(vi.mocked(getRates)).toHaveBeenCalled()
        expect(vi.mocked(getValidToken)).toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.02: EP enabled=true + warehouse complete (courier NOT required)
    // → uses EP rates (auto-cheapest, no user courier selection needed)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.02] EP enabled=true + warehouse complete (no courier selection) → uses EP rates', async () => {
        // Arrange: EP config with warehouse only (courier not selected, not required)
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            refreshToken: 'refresh-xyz',
            tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
            warehouses: [completeWarehouse],
            // NO selectedCourier field (courier auto-picked at checkout)
        }

        mockSiteWithTenant(null, tenantId, epConfig)
        vi.mocked(getValidToken).mockResolvedValue('token-xyz')

        // Mock getRates to return cheapest EP option
        const mockEpRate = {
            courier: 'easyparcel',
            serviceId: 'ep-standard',
            courierName: 'EasyParcel',
            serviceName: 'Standard',
            priceSen: 1000,
            codAvailable: false,
            estDelivery: '2-3 days',
        }
        vi.mocked(getRates).mockResolvedValue({
            rates: [mockEpRate],
            degraded: false,
        })

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert: Should use EP rates (auto-cheapest), NOT flat rate
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.rates).toHaveLength(1)
        expect(body.data.rates[0].courier).toBe('easyparcel') // EP auto-cheapest
        expect(vi.mocked(getRates)).toHaveBeenCalled() // EP path taken
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.03: EP enabled=true, warehouse lacks required phone (< 8 digits)
    // → flat rate fallback (warehouse incomplete)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.03] EP enabled=true but default warehouse phone too short (< 8 digits) → flat rate', async () => {
        // Arrange: Warehouse with incomplete phone
        const incompleteWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '123', // Only 3 digits — fails isWarehouseComplete
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [incompleteWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert: Flat rate because warehouse is incomplete
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.04: EP enabled=true, warehouse lacks postcode
    // → flat rate fallback (warehouse incomplete)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.04] EP enabled=true but default warehouse missing postcode → flat rate', async () => {
        // Arrange: Warehouse without postcode
        const incompleteWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '', // MISSING
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [incompleteWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.05: EP enabled=false (dù đủ token + warehouse + courier)
    // → flat rate (integration disabled)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.05] EP enabled=false even with token+warehouse+courier → flat rate', async () => {
        // Arrange: EP configured but NOT enabled
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: false, // DISABLED
            accessToken: 'token-xyz',
            warehouses: [completeWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.06: No items provided (backward-compat)
    // → flat rate (EP path requires items)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.06] EP ready but items not provided → flat rate (backward-compat)', async () => {
        // Arrange
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [completeWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act: NO items field
        const res = await callPost({ ...validBase }) // items omitted
        const body = await res.json()

        // Assert: Flat rate (items missing)
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.07: items=[] (empty array)
    // → flat rate
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.07] EP ready but items=[] (empty) → flat rate', async () => {
        // Arrange
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            city: 'KL',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [completeWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act
        const res = await callPost({ ...validBase, items: [] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.08: No tenant found (site.tenant = null)
    // → flat rate (no EP config available)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.08] Site has no tenant → flat rate (no EP config)', async () => {
        // Arrange
        mockFindByID.mockImplementation((opts) => {
            if (opts.collection === 'sites') {
                return Promise.resolve({
                    id: 'site-1',
                    shippingConfig: null,
                    tenant: null, // No tenant
                })
            }
            return Promise.resolve(null)
        })

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.09: Multiple warehouses, only first is default
    // → uses default warehouse (isDefault=true)
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.09] Multiple warehouses, uses the one marked isDefault=true', async () => {
        // Arrange: 3 warehouses, middle one is default
        const warehouse1 = {
            id: 'w1',
            label: 'Branch 1',
            phone: '0123456789',
            address1: 'Branch 1 St',
            city: 'Johor Bahru',
            state: 'Johor',
            postcode: '80000',
        }

        const warehouse2 = {
            id: 'w2',
            label: 'HQ Default',
            phone: '0111111111',
            address1: 'HQ St',
            city: 'Petaling Jaya',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true, // This one
        }

        const warehouse3 = {
            id: 'w3',
            label: 'Branch 3',
            phone: '0222222222',
            address1: 'Branch 3 St',
            city: 'George Town',
            state: 'Penang',
            postcode: '10000',
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [warehouse1, warehouse2, warehouse3],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)
        vi.mocked(getValidToken).mockResolvedValue('token-xyz')

        const mockEpRate = {
            courier: 'easyparcel',
            serviceId: 'ep-standard',
            courierName: 'EasyParcel',
            serviceName: 'Standard',
            priceSen: 1200,
            codAvailable: true,
            estDelivery: '2-3 days',
        }
        vi.mocked(getRates).mockResolvedValue({ rates: [mockEpRate], degraded: false })

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert: EP path taken (warehouse2 is complete and default)
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('easyparcel')

        // Verify getRates was called with sender state from warehouse2 (Selangor)
        expect(vi.mocked(getRates)).toHaveBeenCalledWith(
            expect.objectContaining({
                senderState: 'Selangor',
                senderPostcode: '47810',
            }),
            'token-xyz',
            expect.any(Object),
            'Selangor',
        )
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.10: Fallback to legacy single warehouse when warehouses=[]
    // → uses legacy warehouse field if present + ready
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.10] warehouses=[] but legacy warehouse field exists and complete → uses EP', async () => {
        // Arrange: No modern warehouses array, but legacy warehouse field
        const legacyWarehouse = {
            name: 'Legacy Warehouse', // Old schema uses 'name' instead of 'label'
            phone: '0123456789',
            address1: 'Legacy St',
            city: 'Petaling Jaya',
            state: 'Selangor',
            postcode: '47810',
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouses: [], // Empty array
            warehouse: legacyWarehouse, // Fallback to this
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)
        vi.mocked(getValidToken).mockResolvedValue('token-xyz')

        const mockEpRate = {
            courier: 'easyparcel',
            serviceId: 'ep-standard',
            courierName: 'EasyParcel',
            serviceName: 'Standard',
            priceSen: 1200,
            codAvailable: true,
            estDelivery: '2-3 days',
        }
        vi.mocked(getRates).mockResolvedValue({ rates: [mockEpRate], degraded: false })

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert: Legacy warehouse is complete, so EP path is taken
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('easyparcel')
        expect(vi.mocked(getRates)).toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.11: getValidToken throws (token expired, refresh fails)
    // → falls back to flat rate, no error thrown
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.11] getValidToken throws (token expired) → flat rate fallback, no error', async () => {
        // Arrange: EP config appears ready but token is stale
        const completeWarehouse = {
            id: 'w1',
            label: 'HQ',
            phone: '0123456789',
            address1: 'No.12',
            state: 'Selangor',
            postcode: '47810',
            isDefault: true,
        }

        const epConfig = {
            enabled: true,
            accessToken: 'expired-token',
            warehouses: [completeWarehouse],
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)
        vi.mocked(getValidToken).mockRejectedValue(new Error('Token refresh failed'))

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert: No error thrown, flat rate returned
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.rates[0].courier).toBe('flat')
    })

    // ──────────────────────────────────────────────────────────────────
    // TC-F36.12: Legacy warehouse lacking required field (e.g., no phone)
    // → not ready, flat rate
    // ──────────────────────────────────────────────────────────────────

    it('[TC-F36.12] Legacy warehouse incomplete (missing phone) → flat rate', async () => {
        // Arrange
        const incompleteLegacy = {
            name: 'Legacy',
            phone: '', // Missing phone
            address1: 'St',
            state: 'Selangor',
            postcode: '47810',
        }

        const epConfig = {
            enabled: true,
            accessToken: 'token-xyz',
            warehouse: incompleteLegacy, // Only legacy
            selectedCourier: 'EP-CR0AP',
        }

        mockSiteWithTenant(null, tenantId, epConfig)

        // Act
        const res = await callPost({ ...validBase, items: [{ productId: 'p1', quantity: 1 }] })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.rates[0].courier).toBe('flat')
        expect(vi.mocked(getRates)).not.toHaveBeenCalled()
    })
})
