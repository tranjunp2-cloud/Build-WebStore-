/**
 * POST /api/tenant/[id]/easyparcel-save route tests — F36 Phase 05 (GH-1333)
 * Tests: save guard (enabled=true requires warehouse complete), warehouse persistence.
 * NO courier selection — auto-cheapest at checkout.
 *
 * TC-F14.140 from docs/qa/F14-shipping.md
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

    // TC-F14.140 variant: enabled=true + missing warehouses → 400 EP_NOT_READY
    it('[TC-F14.140] enabled=true + missing warehouses → 400 EP_NOT_READY', async () => {
        const res = await callPost('tenant-1', {
            enabled: true,
        })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error?.code).toBe('EP_NOT_READY')
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
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([completeWarehouse])
        expect(updateCall.data.easyParcelIntegration.enabled).toBe(true)
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
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([completeWarehouse, wh2])
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
        expect(updateCall.data.easyParcelIntegration.warehouses).toEqual([completeWarehouse])
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
