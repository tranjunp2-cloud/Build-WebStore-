/**
 * POST /api/tenant/[id]/easyparcel-save route tests — F36 Phase 05 (GH-1333)
 * Tests: save guard (enabled=true requires warehouse + ≥1 courier), array persistence, legacy scalar.
 *
 * TC-F14.140, TC-F14.141 from docs/qa/F14-shipping.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
let mockUser = { id: 1, roles: ['super-admin'], tenants: [] }

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        update: mockUpdate,
    })),
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
    state: 'Selangor',
    postcode: '47810',
    country: 'MY',
    isDefault: true,
}

describe('POST /api/tenant/[id]/easyparcel-save — F36', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 1, roles: ['super-admin'], tenants: [] }
    })

    // TC-F14.140: enabled=true + empty selectedCouriers → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + empty selectedCouriers → 400 EP_NOT_READY', async () => {
        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: [],
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F14.140 variant: enabled=true + missing selectedCouriers → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + missing selectedCouriers → 400 EP_NOT_READY', async () => {
        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F14.140 variant: enabled=true + incomplete warehouse → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + incomplete warehouse (missing phone) → 400 EP_NOT_READY', async () => {
        const incompleteWh = { ...completeWarehouse, phone: '' }
        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [incompleteWh],
            selectedCouriers: ['jnt', 'flash'],
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // TC-F14.141: valid array + complete warehouse → 200 OK, persist array + legacy scalar
    it('[TC-F14.141] valid selectedCouriers + complete warehouse → 200 OK, persist array + legacy scalar', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: ['jnt', 'flash'],
        })

        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(1)

        // Check the data passed to update
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.collection).toBe('tenants')
        expect(updateCall.id).toBe('tenant-1')
        expect(updateCall.data.easyParcelIntegration.selectedCouriers).toEqual(['jnt', 'flash'])
        expect(updateCall.data.easyParcelIntegration.selectedCourier).toBe('jnt') // legacy scalar = first element
    })

    // TC-F14.141 variant: single courier → legacy scalar = that courier
    it('[TC-F14.141] single selectedCourier → legacy scalar mirrors it', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: ['flash'],
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.data.easyParcelIntegration.selectedCouriers).toEqual(['flash'])
        expect(updateCall.data.easyParcelIntegration.selectedCourier).toBe('flash')
    })

    // enabled=false is always OK (no guard)
    it('enabled=false is always OK, even with empty couriers', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: false,
            warehouses: [completeWarehouse],
            selectedCouriers: [],
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(false)
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

    // Sanitize: non-string couriers in array filtered
    it('sanitizes non-string couriers from array', async () => {
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })

        const res = await callPost('tenant-1', {
            enabled: true,
            warehouses: [completeWarehouse],
            selectedCouriers: ['jnt', 123, null, 'flash', undefined, '   '],
        })

        expect(res.status).toBe(200)
        const updateCall = mockUpdate.mock.calls[0][0]
        // Non-strings and empty strings filtered out
        expect(updateCall.data.easyParcelIntegration.selectedCouriers).toEqual(['jnt', 'flash'])
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
})
