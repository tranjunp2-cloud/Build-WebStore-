/**
 * POST /api/tenant/[id]/easyparcel-save route tests — F36 Phase 05 (GH-1333)
 * Tests: save guard (enabled=true requires warehouse complete), warehouse persistence.
 * NO courier selection — auto-cheapest at checkout.
 *
 * TC-F14.140 from docs/qa/F14-shipping.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
let mockUser = { id: 1, roles: ['super-admin'], tenants: [] }

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
    })),
}))

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: string,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'tx-1' })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Import route AFTER mocks
import { POST } from '@/app/api/tenant/[id]/easyparcel-save/route'

// Test helper: make POST request
async function callPost(tenantId: string, body: unknown) {
    const request = new Request(`http://localhost/api/tenant/${tenantId}/easyparcel-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const ctx = { params: Promise.resolve({ id: tenantId }) }
    return POST(request, ctx)
}

// Test fixtures
const completeWarehouse = {
    id: 'w-1',
    label: 'HQ',
    phone: '0123456789',
    address1: 'No.12 Jalan',
    city: 'Petaling Jaya',
    state: 'Selangor',
    postcode: '47810',
    country: 'MY',
    isDefault: true,
}

const canonicalWarehouse = {
    ...completeWarehouse,
    phone: '60123456789',
}

describe('POST /api/tenant/[id]/easyparcel-save — F36', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 1, roles: ['super-admin'], tenants: [] }
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            easyParcelIntegration: {
                accessToken: 'connected-token',
                refreshToken: 'connected-refresh-token',
            },
        })
    })

    // TC-F14.140: enabled=true + incomplete warehouse → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + incomplete warehouse (missing phone) → 400 EP_NOT_READY', async () => {
        const incompleteWh = { ...completeWarehouse, phone: '' }
        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [incompleteWh],
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F14.140 variant: enabled=true + empty warehouses → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + empty warehouses → 400 EP_NOT_READY', async () => {
        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [],
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F36.202: settings replacement requires explicit warehouses semantics.
    it('[TC-F36.202] enabled=true + missing warehouses → 400 INVALID_REQUEST', async () => {
        const res = await callPost('tenant-1', {
            enabled: true,
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('INVALID_REQUEST')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F36.202] empty payload cannot clear saved settings', async () => {
        const res = await callPost('tenant-1', {})
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('INVALID_REQUEST')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F14.141: enabled=true + complete warehouse → 200 OK, persist warehouse + enabled
    it('[TC-F14.141] enabled=true + complete warehouse → 200 OK, persist warehouse', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
        })

        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(1)

        // Check the data passed to update
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.collection).toBe('tenants')
        expect(updateCall.id).toBe('tenant-1')
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([
            expect.objectContaining(canonicalWarehouse),
        ])
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(true)
        expect(updateCall.data.easyParcelIntegration.warehouse).toBeNull()
        expect(await res.json()).toEqual({
            success: true,
            data: {
                enabled: true,
                warehouses: [expect.objectContaining(canonicalWarehouse)],
            },
        })
        // NO selectedCouriers or selectedCourier in new spec
    })

    // TC-F14.141 variant: multiple warehouses
    it('[TC-F14.141] enabled=true + multiple complete warehouses → 200 OK, persist all', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const wh2 = { ...completeWarehouse, id: 'w-2', label: 'Branch', isDefault: false }

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse, wh2],
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([
            expect.objectContaining(canonicalWarehouse),
            expect.objectContaining({ ...wh2, phone: '60123456789' }),
        ])
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(true)
    })

    // enabled=false is always OK (no guard)
    it('enabled=false is always OK (no warehouse check)', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: false,
            warehouses: [],
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(false)
        expect(updateCall.data.easyParcelIntegration.warehouse).toBeNull()
    })

    it('rejects a stale save after EasyParcel has been disconnected', async () => {
        mockFindByID.mockResolvedValue({
            id: 'tenant-1',
            easyParcelIntegration: { accessToken: null, refreshToken: null },
        })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
        })

        expect(res.status).toBe(409)
        expect((await res.json()).error?.code).toBe('EP_NOT_CONNECTED')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // Ownership check: non-admin, non-owned tenant → 403
    it('non-admin user, wrong tenant → 403 FORBIDDEN', async () => {
        mockUser = { id: 2, roles: [], tenants: [{ tenant: { id: 'tenant-2' } }] }
        const res = await callPost('tenant-1', { enabled: false })
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error?.code).toBe('FORBIDDEN')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // Ignore selectedCouriers in request (not part of new spec)
    it('ignores selectedCouriers param (not accepted in new spec)', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: ['jnt', 'flash'], // Ignored
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        // Route should only persist enabled + warehouses, not couriers
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(true)
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([
            expect.objectContaining(canonicalWarehouse),
        ])
    })

    // Error handling: update fails → 500 INTERNAL_ERROR
    it('update fails → 500 INTERNAL_ERROR', async () => {
        mockUpdate.mockRejectedValue(new Error('DB error'))

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: ['jnt'],
        })
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error?.code).toBe('INTERNAL_ERROR')
    })

    it('[TC-F36.202] rejects a non-array warehouses payload', async () => {
        const res = await callPost('tenant-1', { enabled: false, warehouses: completeWarehouse })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('INVALID_REQUEST')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F36.202] rejects malformed phone and postcode values', async () => {
        const invalidPhone = await callPost('tenant-1', {
            enabled: false,
            warehouses: [{ ...completeWarehouse, phone: 'abc0123456789' }],
        })
        const invalidPostcode = await callPost('tenant-1', {
            enabled: false,
            warehouses: [{ ...completeWarehouse, postcode: '4781A' }],
        })

        expect(invalidPhone.status).toBe(400)
        expect((await invalidPhone.json()).error?.code).toBe('INVALID_WAREHOUSE')
        expect(invalidPostcode.status).toBe(400)
        expect((await invalidPostcode.json()).error?.code).toBe('INVALID_WAREHOUSE')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F36.202] rejects non-string phone and postcode values', async () => {
        const invalidPhone = await callPost('tenant-1', {
            enabled: false,
            warehouses: [{ ...completeWarehouse, phone: 123456789 }],
        })
        const invalidPostcode = await callPost('tenant-1', {
            enabled: false,
            warehouses: [{ ...completeWarehouse, postcode: 47810 }],
        })

        expect(invalidPhone.status).toBe(400)
        expect((await invalidPhone.json()).error?.code).toBe('INVALID_WAREHOUSE')
        expect(invalidPostcode.status).toBe(400)
        expect((await invalidPostcode.json()).error?.code).toBe('INVALID_WAREHOUSE')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F36.202] enforces one default and persists it first', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })
        const branch = { ...completeWarehouse, id: 'w-2', label: 'Branch', isDefault: true }

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [{ ...completeWarehouse, isDefault: false }, branch],
        })

        expect(res.status).toBe(200)
        const saved = mockUpdate.mock.calls[0][0].data.easyParcelIntegration.warehouses
        expect(saved.map((warehouse: typeof completeWarehouse) => warehouse.id)).toEqual(['w-2', 'w-1'])
        expect(saved.map((warehouse: typeof completeWarehouse) => warehouse.isDefault)).toEqual([true, false])
    })

    it('[TC-F36.202] assigns stable unique IDs to missing and duplicate IDs', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })
        const withoutId = { ...completeWarehouse, id: undefined }
        const duplicateId = { ...completeWarehouse, label: 'Branch', isDefault: false }

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [withoutId, duplicateId, { ...duplicateId, label: 'Branch 2' }],
        })

        expect(res.status).toBe(200)
        const saved = mockUpdate.mock.calls[0][0].data.easyParcelIntegration.warehouses
        const ids = saved.map((warehouse: typeof completeWarehouse) => warehouse.id)
        expect(ids.every((id: string) => typeof id === 'string' && id.length > 0)).toBe(true)
        expect(new Set(ids).size).toBe(3)
        expect((await res.json()).data.warehouses.map((warehouse: typeof completeWarehouse) => warehouse.id)).toEqual(ids)
    })
})
