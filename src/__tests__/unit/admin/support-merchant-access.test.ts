/**
 * TC-F15.31..37 — `support` seat opens a merchant's CMS through a one-time, logged link (no merchant OTP).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT, decodeJwt } from 'jose'

const { getCurrentUser, findByID, find, recordMerchantAccessLink, redeemMerchantAccessLink, checkRateLimit } = vi.hoisted(() => ({
    checkRateLimit: vi.fn(),
    getCurrentUser: vi.fn(),
    findByID: vi.fn(),
    find: vi.fn(),
    recordMerchantAccessLink: vi.fn(),
    redeemMerchantAccessLink: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser, authUnavailableResponse: vi.fn(), isAuthUnavailableError: () => false }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID, find })) }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit }))
vi.mock('@/lib/support/merchant-access-events', () => ({ recordMerchantAccessLink, redeemMerchantAccessLink }))

import { canUseMerchantAccess, hasStaffRole } from '@/lib/admin/studio-roles'
import {
    signMerchantAccessToken,
    verifyMerchantAccessToken,
} from '@/lib/support/merchant-access-token'
import { GET as searchAccounts, POST as createLink } from '@/app/api/admin/merchant-access/route'
import { POST as redeemLink } from '@/app/api/auth/merchant-access/route'
import { middleware } from '@/middleware'
import { verifySessionToken } from '@/lib/auth/session-token'

const SECRET = 'merchant-access-test-secret'
const support = { id: 7, email: 'support@primecommerce.asia', roles: ['support'] }
const merchant = { id: 3185, email: 'owner@example.com', roles: ['tenant-owner'] }

const createRequest = (body: unknown) =>
    new NextRequest('https://web-cms.test/api/admin/merchant-access', { method: 'POST', body: JSON.stringify(body) })
const redeemRequest = (token: unknown) =>
    new NextRequest('https://web-cms.test/api/auth/merchant-access', { method: 'POST', body: JSON.stringify({ token }) })

async function pageRequest(path: string, roles: string[] | null | 'no-claim') {
    const headers: Record<string, string> = { host: 'primeweb.app' }
    if (roles) {
        const token = await new SignJWT(roles === 'no-claim' ? { id: 7 } : { id: 7, roles })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode('any'))
        headers.cookie = `payload-token=${token}`
    }
    return new NextRequest(`https://primeweb.app${path}`, { headers })
}

beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYLOAD_SECRET = SECRET
    redeemMerchantAccessLink.mockResolvedValue({ actorEmail: 'ben@primecommerce.asia' })
    checkRateLimit.mockResolvedValue({ allowed: true, resetAt: 0 })
})

describe('[TC-F15.31] support role helpers', () => {
    it('TC-F15.31: support and super-admin may use merchant access; merchants and viewers may not', () => {
        expect(canUseMerchantAccess(['support'])).toBe(true)
        expect(canUseMerchantAccess(['super-admin'])).toBe(true)
        expect(canUseMerchantAccess(['studio-viewer'])).toBe(false)
        expect(canUseMerchantAccess(['tenant-owner'])).toBe(false)
        expect(hasStaffRole(['tenant-owner'])).toBe(false)
        expect(hasStaffRole(['tenant-owner', 'support'])).toBe(true)
    })
})

describe('[TC-F15.32] link token', () => {
    it('TC-F15.32: round-trips and is never shaped like a session', async () => {
        // Arrange / Act
        const token = await signMerchantAccessToken({ jti: 'j-1', targetUserId: 3185, actorUserId: 7 })

        // Assert
        expect(await verifyMerchantAccessToken(token)).toEqual({ jti: 'j-1', targetUserId: 3185, actorUserId: 7 })
        const claims = decodeJwt(token)
        expect(claims.collection).toBeUndefined()
        expect(claims.mfa_verified).toBeUndefined()
    })

    it('TC-F15.32: rejects a token signed with another secret or another audience', async () => {
        // Arrange
        const foreign = await new SignJWT({ typ: 'merchant-access-link', act: 7 })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject('3185')
            .setAudience('merchant-access')
            .setJti('j-2')
            .setExpirationTime('5m')
            .sign(new TextEncoder().encode('other-secret'))
        const session = await new SignJWT({ id: 3185, collection: 'users', mfa_verified: true })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('5m')
            .sign(new TextEncoder().encode(SECRET))

        // Act / Assert
        expect(await verifyMerchantAccessToken(foreign)).toBeNull()
        expect(await verifyMerchantAccessToken(session)).toBeNull()
    })
})

describe('[TC-F15.33] create link API', () => {
    it.each([
        ['signed out', null, 401],
        ['merchant', merchant, 403],
        ['studio-viewer', { id: 9, email: 'v@x', roles: ['studio-viewer'] }, 403],
    ])('TC-F15.33: refuses a %s caller', async (_label, user, status) => {
        // Arrange
        getCurrentUser.mockResolvedValue(user)

        // Act
        const response = await createLink(createRequest({ userId: 3185 }))

        // Assert
        expect(response.status).toBe(status)
        expect(recordMerchantAccessLink).not.toHaveBeenCalled()
    })

    it('TC-F15.33: support gets a one-time link, logged with both accounts', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(support)
        findByID.mockResolvedValue(merchant)

        // Act
        const response = await createLink(createRequest({ userId: 3185 }))
        const body = (await response.json()) as { data: { url: string } }

        // Assert
        expect(response.status).toBe(201)
        // Token in the fragment: browsers never send it, so it stays out of server and proxy logs.
        expect(body.data.url).toMatch(/^https:\/\/web-cms\.test\/sso\/merchant-access#token=[^?&]+$/)
        expect(getCurrentUser).toHaveBeenCalledWith(expect.any(NextRequest))
        expect(recordMerchantAccessLink).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ actor: { id: 7, email: support.email }, target: { id: 3185, email: merchant.email } }),
        )
    })

    it('TC-F15.33: never opens a staff account', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(support)
        findByID.mockResolvedValue({ id: 1, email: 'ben@primecommerce.asia', roles: ['super-admin'] })

        // Act
        const response = await createLink(createRequest({ userId: 1 }))

        // Assert
        expect(response.status).toBe(403)
        expect(recordMerchantAccessLink).not.toHaveBeenCalled()
    })

    it('TC-F15.33: caps how many links one seat can create per minute', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(support)
        checkRateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 })

        // Act
        const response = await createLink(createRequest({ userId: 3185 }))

        // Assert
        expect(response.status).toBe(429)
        expect(checkRateLimit).toHaveBeenCalledWith('merchant-access-mint:7', expect.any(Number), expect.any(Number))
        expect(recordMerchantAccessLink).not.toHaveBeenCalled()
    })

    it('TC-F15.33: search drops staff accounts from results', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(support)
        find
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [merchant, { id: 1, email: 'staff@x.com', roles: ['support'] }] })

        // Act
        const response = await searchAccounts(new NextRequest('https://web-cms.test/api/admin/merchant-access?q=example'))
        const body = (await response.json()) as { data: { id: number }[] }

        // Assert
        expect(body.data.map((a) => a.id)).toEqual([3185])
    })
})

describe('[TC-F15.34] redeem link', () => {
    it('TC-F15.34: signs the browser in as the merchant and records who acted', async () => {
        // Arrange
        findByID.mockResolvedValue(merchant)
        const token = await signMerchantAccessToken({ jti: 'j-3', targetUserId: 3185, actorUserId: 7 })

        // Act
        const response = await redeemLink(redeemRequest(token))
        const cookie = response.cookies.get('payload-token')?.value ?? ''

        // Assert
        expect(response.status).toBe(200)
        expect(redeemMerchantAccessLink).toHaveBeenCalledWith(expect.anything(), 'j-3', null)
        expect(decodeJwt(cookie)).toMatchObject({ id: 3185, collection: 'users', mfa_verified: true, impersonated_by: 7, impersonated_by_email: 'ben@primecommerce.asia' })
    })

    it('TC-F15.34: a used or expired link answers 401 without a session', async () => {
        // Arrange
        redeemMerchantAccessLink.mockResolvedValue(null)
        const token = await signMerchantAccessToken({ jti: 'j-4', targetUserId: 3185, actorUserId: 7 })

        // Act
        const response = await redeemLink(redeemRequest(token))

        // Assert
        expect(response.status).toBe(401)
        expect(response.cookies.get('payload-token')).toBeUndefined()
    })

    it('TC-F15.34: the minted cookie is a real merchant session for getCurrentUser', async () => {
        // Arrange
        findByID.mockResolvedValue(merchant)
        const token = await signMerchantAccessToken({ jti: 'j-6', targetUserId: 3185, actorUserId: 7 })

        // Act
        const response = await redeemLink(redeemRequest(token))
        const cookie = response.cookies.get('payload-token')?.value ?? ''

        // Assert — the link token itself never passes as a session
        expect(await verifySessionToken(cookie, { appSecrets: [SECRET] })).toMatchObject({ kind: 'app', id: 3185 })
        expect(await verifySessionToken(token, { appSecrets: [SECRET] })).toBeNull()
    })

    it('TC-F15.34: does not open an account whose every store is suspended', async () => {
        // Arrange
        findByID.mockResolvedValue({ ...merchant, tenants: [{ tenant: 55 }] })
        find.mockResolvedValue({ docs: [{ id: 55, status: 'suspended' }] })
        const token = await signMerchantAccessToken({ jti: 'j-7', targetUserId: 3185, actorUserId: 7 })

        // Act
        const response = await redeemLink(redeemRequest(token))

        // Assert
        expect(response.status).toBe(401)
        expect(response.cookies.get('payload-token')).toBeUndefined()
    })

    it('TC-F15.34: refuses when the account became staff after the link was made', async () => {
        // Arrange
        findByID.mockResolvedValue({ ...merchant, roles: ['tenant-owner', 'super-admin'] })
        const token = await signMerchantAccessToken({ jti: 'j-5', targetUserId: 3185, actorUserId: 7 })

        // Act
        const response = await redeemLink(redeemRequest(token))

        // Assert
        expect(response.status).toBe(401)
        expect(response.cookies.get('payload-token')).toBeUndefined()
    })
})

describe('[TC-F15.35] /support route guard', () => {
    it.each([
        ['signed out', null, '/login'],
        ['merchant', ['tenant-owner'], '/login'],
        ['studio-viewer', ['studio-viewer'], '/login'],
    ])('TC-F15.35: sends a %s user to login', async (_label, roles, to) => {
        // Act
        const response = await middleware(await pageRequest('/support/merchant-access', roles))

        // Assert
        expect(new URL(response.headers.get('location') ?? '').pathname).toBe(to)
    })

    it.each([
        ['support user', ['support'] as string[] | 'no-claim'],
        ['token without a roles claim (renewed session; the layout checks the DB roles)', 'no-claim' as const],
    ])('TC-F15.35: lets a %s through to the layout', async (_label, roles) => {
        // Act
        const response = await middleware(await pageRequest('/support/merchant-access', roles))

        // Assert
        expect(response.headers.get('location')).toBeNull()
    })
})

describe('[TC-F15.41] super-admin signed in at /admin (password only)', () => {
    const superAdmin = { id: 1, email: 'ben@primecommerce.asia', roles: ['super-admin'] }

    it('TC-F15.41: searches merchants (200) and creates a link (201) logged with the super-admin as actor', async () => {
        // Arrange: no OTP involved, the route only needs a super-admin / support user
        getCurrentUser.mockResolvedValue(superAdmin)
        findByID.mockResolvedValue(merchant)
        find.mockResolvedValue({ docs: [] })

        // Act
        const search = await searchAccounts(new NextRequest('https://web-cms.test/api/admin/merchant-access?q=owner'))
        const created = await createLink(createRequest({ userId: 3185 }))

        // Assert
        expect(search.status).toBe(200)
        expect(created.status).toBe(201)
        expect(recordMerchantAccessLink).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ actor: { id: 1, email: 'ben@primecommerce.asia' } }),
        )
    })

    it('TC-F15.41: signed out is 401 and studio-viewer is 403', async () => {
        getCurrentUser.mockResolvedValue(null)
        expect((await createLink(createRequest({ userId: 3185 }))).status).toBe(401)

        getCurrentUser.mockResolvedValue({ id: 9, email: 'v@x.com', roles: ['studio-viewer'] })
        expect((await createLink(createRequest({ userId: 3185 }))).status).toBe(403)
    })
})
