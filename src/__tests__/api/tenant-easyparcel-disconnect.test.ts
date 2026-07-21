/** EasyParcel disconnect persistence contract — TC-F36.11. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpdate = vi.fn()
let mockUser = { id: 1, roles: ['super-admin'], tenants: [] as Array<{ tenant: { id: string } }> }

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ update: mockUpdate })),
}))

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: string,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'tx-1' })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import { DELETE } from '@/app/api/tenant/[id]/easyparcel-disconnect/route'

async function callDelete(tenantId: string) {
    const request = new Request(`http://localhost/api/tenant/${tenantId}/easyparcel-disconnect`, {
        method: 'DELETE',
    })
    return DELETE(request, { params: Promise.resolve({ id: tenantId }) })
}

describe('[TC-F36.11] DELETE /api/tenant/[id]/easyparcel-disconnect', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 1, roles: ['super-admin'], tenants: [] }
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })
    })

    it('clears OAuth data and all pickup addresses', async () => {
        // Arrange
        const tenantId = 'tenant-1'

        // Act
        const response = await callDelete(tenantId)

        // Assert
        expect(response.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants',
            id: tenantId,
            data: {
                easyParcelIntegration: {
                    accessToken: null,
                    refreshToken: null,
                    tokenExpiresAt: null,
                    tokenRefreshExpiresAt: null,
                    accountName: null,
                    accountEmail: null,
                    enabled: false,
                    testedAt: null,
                    warehouse: null,
                    warehouses: [],
                },
            },
            overrideAccess: true,
            req: { transactionID: 'tx-1' },
        }))
        expect(await response.json()).toEqual({ success: true })
    })

    it('rejects a user from another tenant before clearing data', async () => {
        // Arrange
        mockUser = { id: 2, roles: [], tenants: [{ tenant: { id: 'tenant-2' } }] }

        // Act
        const response = await callDelete('tenant-1')

        // Assert
        expect(response.status).toBe(403)
        expect((await response.json()).error?.code).toBe('FORBIDDEN')
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
