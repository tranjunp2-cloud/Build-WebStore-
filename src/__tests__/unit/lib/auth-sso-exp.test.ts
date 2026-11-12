/**
 * TC-AISEC-114 — getCurrentUser refuses custom/peer SSO JWTs without `exp`.
 *
 * The SSO_SHARED_SECRET fallback (and the PAYLOAD_SECRET custom-token path) used to accept a
 * token with no expiry — a forever credential. Real jose signs/verifies here so the claim check
 * itself is exercised, not a mock of it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'

const mockCookieGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockCookieGet })),
}))

const mockAuth = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        secret: 'derived-secret-for-tests-0123456789',
        auth: mockAuth,
        findByID: mockFindByID,
        db: { defaultIDType: 'number' },
        collections: { users: { config: { auth: {} } } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { getCurrentUser } from '@/lib/auth'

const PAYLOAD_SECRET = 'payload-secret-for-tests-0123456789'
const SSO_SECRET = 'peer-sso-secret-for-tests-0123456789'
const claims = { id: 42, collection: 'users', mfa_verified: true }

async function sign(secret: string, withExp: boolean): Promise<string> {
    const jwt = new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt()
    if (withExp) jwt.setExpirationTime('1h')
    return jwt.sign(new TextEncoder().encode(secret))
}

describe('TC-AISEC-114 — custom/SSO JWT must carry exp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('PAYLOAD_SECRET', PAYLOAD_SECRET)
        vi.stubEnv('SSO_SHARED_SECRET', SSO_SECRET)
        mockFindByID.mockResolvedValue({ id: 42, email: 'owner@shop.test' })
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it('refuses a token signed with SSO_SHARED_SECRET that has no exp', async () => {
        // Arrange
        mockCookieGet.mockReturnValue({ value: await sign(SSO_SECRET, false) })

        // Act
        const user = await getCurrentUser()

        // Assert
        expect(user).toBeNull()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('accepts a token signed with SSO_SHARED_SECRET that has exp', async () => {
        mockCookieGet.mockReturnValue({ value: await sign(SSO_SECRET, true) })

        const user = await getCurrentUser()

        expect(user).toEqual({ id: 42, email: 'owner@shop.test', collection: 'users' })
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', id: 42 }))
    })

    it('refuses a no-exp token even when the peer secret equals PAYLOAD_SECRET', async () => {
        vi.stubEnv('SSO_SHARED_SECRET', PAYLOAD_SECRET)
        mockCookieGet.mockReturnValue({ value: await sign(PAYLOAD_SECRET, false) })

        const user = await getCurrentUser()

        expect(user).toBeNull()
    })

    it('still accepts a verify-otp style PAYLOAD_SECRET token with exp', async () => {
        mockCookieGet.mockReturnValue({ value: await sign(PAYLOAD_SECRET, true) })

        const user = await getCurrentUser()

        expect(user).toEqual({ id: 42, email: 'owner@shop.test', collection: 'users' })
    })
})
