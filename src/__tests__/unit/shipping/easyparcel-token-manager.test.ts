import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: string,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'tx-1' })),
}))

import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'

function makePayload(currentRefreshToken: string | null) {
    return {
        findByID: vi.fn().mockResolvedValue({
            easyParcelIntegration: {
                accessToken: currentRefreshToken ? 'old-access' : null,
                refreshToken: currentRefreshToken,
            },
        }),
        update: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
    } as unknown as Payload
}

const expiredConnection = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    tokenExpiresAt: '2020-01-01T00:00:00.000Z',
}

describe('EasyParcel token refresh concurrency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
                refresh_token_expires_in: 86400,
            }),
        } as Response)
    })

    it('persists refreshed tokens when the refresh token is still current', async () => {
        const payload = makePayload('old-refresh')

        await expect(getValidToken(expiredConnection, 'token-current', payload))
            .resolves.toBe('new-access')
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            req: { transactionID: 'tx-1' },
            data: {
                easyParcelIntegration: expect.objectContaining({
                    accessToken: 'new-access',
                    refreshToken: 'new-refresh',
                }),
            },
        }))
    })

    it('does not restore refreshed tokens after the connection was disconnected', async () => {
        const payload = makePayload(null)

        await expect(getValidToken(expiredConnection, 'token-disconnected', payload))
            .rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
        expect(payload.update).not.toHaveBeenCalled()
    })
})
