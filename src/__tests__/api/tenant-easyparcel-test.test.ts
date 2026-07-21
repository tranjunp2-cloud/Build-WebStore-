import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    mockFindByID,
    mockUpdate,
    mockWalletBalance,
    mockGetAccountInfo,
    mockGetValidToken,
} = vi.hoisted(() => ({
    mockFindByID: vi.fn(),
    mockUpdate: vi.fn(),
    mockWalletBalance: vi.fn(),
    mockGetAccountInfo: vi.fn(),
    mockGetValidToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(
        { id: 1, roles: ['super-admin'], tenants: [] },
        req,
        ctx,
    )),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
    })),
}))

vi.mock('@/lib/shipping/easyparcel/client', () => ({
    walletBalance: mockWalletBalance,
    getAccountInfo: mockGetAccountInfo,
}))

vi.mock('@/lib/shipping/easyparcel/token-manager', () => ({
    getValidToken: mockGetValidToken,
}))

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: string,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'tx-1' })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import { POST } from '@/app/api/tenant/[id]/easyparcel-test/route'

async function callPost(tenantId: string, body: unknown = {}) {
    const request = new Request(`http://localhost/api/tenant/${tenantId}/easyparcel-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return POST(request, { params: Promise.resolve({ id: tenantId }) })
}

describe('POST /api/tenant/[id]/easyparcel-test', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetValidToken.mockResolvedValue('access-token')
        mockWalletBalance.mockResolvedValue({
            data: { wallet: [{ balance: 42, currency: 'MYR' }] },
        })
        mockGetAccountInfo.mockResolvedValue({
            data: { account: { name: 'Merchant' }, address: { pickup_address: null } },
        })
        mockUpdate.mockResolvedValue({ id: 'tenant-1' })
    })

    it('persists a successful test while the same connection is current', async () => {
        mockFindByID
            .mockResolvedValueOnce({ easyParcelIntegration: { accessToken: 'access-token' } })
            .mockResolvedValueOnce({ easyParcelIntegration: { accessToken: 'access-token' } })

        const response = await callPost('tenant-success')

        expect(response.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: 'tenant-success',
            req: { transactionID: 'tx-1' },
        }))
    })

    it('does not restore testedAt or warehouses after Disconnect changes the connection', async () => {
        mockFindByID
            .mockResolvedValueOnce({ easyParcelIntegration: { accessToken: 'access-token' } })
            .mockResolvedValueOnce({ easyParcelIntegration: { accessToken: null } })

        const response = await callPost('tenant-stale', { syncWarehouse: true })

        expect(response.status).toBe(409)
        expect((await response.json()).error?.code).toBe('EP_CONNECTION_CHANGED')
        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
