/**
 * TC-PERF-142 — Payload REST refuses the password step's token (issued before the OTP) for every user but
 * super-admins, except on the login / OTP / password-reset endpoints.
 * Real: lib/auth/payload-rest-otp-guard.ts, lib/auth/session-token.ts, lib/auth/session-user.ts (passesOtpGate),
 * jose (tokens are really signed here). Faked: the Payload instance (derived secret + the users roles read).
 */
import { SignJWT } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    candidateTokens,
    PRE_OTP_REST_PATHS,
    refusePreOtpPayloadToken,
    restPath,
} from '@/lib/auth/payload-rest-otp-guard'

const DERIVED_SECRET = 'derived-payload-secret-0123456789ab'
const RAW_SECRET = 'raw-payload-secret-for-tests-0123456789'

const sign = (secret: string, claims: Record<string, unknown>, header: Record<string, unknown> = {}) =>
    new SignJWT({ id: 7, collection: 'users', ...claims })
        .setProtectedHeader({ alg: 'HS256', ...header })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret))
/** The token POST /api/users/login returns before the OTP step (Payload's own, derived secret). */
const passwordToken = (claims: Record<string, unknown> = {}) => sign(DERIVED_SECRET, { sid: 's1', ...claims }, { authVersion: 1 })
/** The verify-otp token (raw secret, mfa_verified). */
const otpToken = () => sign(RAW_SECRET, { mfa_verified: true })

const findByID = vi.fn()
const loadPayload = vi.fn(async () => ({ secret: DERIVED_SECRET, findByID }) as never)

const request = (path: string, headers: Record<string, string> = {}) => new Request(`http://app.test${path}`, { headers })

beforeEach(() => {
    findByID.mockReset().mockResolvedValue({ id: 7, roles: ['tenant-owner'] })
    loadPayload.mockClear()
})

describe('pre-OTP Payload token on Payload REST [TC-PERF-142]', () => {
    it.each(['/api/orders', '/api/customers?depth=2', '/api/users/me', '/api/media/12', '/api/users/invite-staff'])(
        'refuses a tenant user\'s password-only token on %s (401)',
        async (path) => {
            // Arrange
            const req = request(path, { authorization: `JWT ${await passwordToken()}` })

            // Act
            const res = await refusePreOtpPayloadToken(req, loadPayload)

            // Assert
            expect(res?.status).toBe(401)
        },
    )

    it('refuses the token sent as the payload-token cookie too', async () => {
        // Arrange
        const req = request('/api/orders', { cookie: `theme=dark; payload-token=${await passwordToken()}` })

        // Act
        const res = await refusePreOtpPayloadToken(req, loadPayload)

        // Assert
        expect(res?.status).toBe(401)
    })

    it('TC-PERF-142: refuses a password cookie whose name Payload trims', async () => {
        // Arrange
        const token = await passwordToken()
        const req = request('/api/orders', { cookie: `payload-token =${token.replaceAll('.', '%2E')}` })
        // Act / Assert
        expect((await refusePreOtpPayloadToken(req, loadPayload))?.status).toBe(401)
    })

    it('TC-PERF-142: refuses a percent-encoded password-only cookie', async () => {
        // Arrange
        const token = (await passwordToken()).replaceAll('.', '%2E')
        const req = request('/api/orders', { cookie: `payload-token=${token}` })
        // Act
        const res = await refusePreOtpPayloadToken(req, loadPayload)
        // Assert
        expect(res?.status).toBe(401)
    })

    it.each([...PRE_OTP_REST_PATHS].map((p) => `/api/${p}`))('lets the login / OTP flow endpoint %s through', async (path) => {
        // Arrange
        const req = request(path, { authorization: `JWT ${await passwordToken()}` })

        // Act / Assert
        expect(await refusePreOtpPayloadToken(req, loadPayload)).toBeNull()
    })

    it('keeps a super-admin\'s password token (Payload admin panel) working', async () => {
        // Arrange
        findByID.mockResolvedValue({ id: 7, roles: ['super-admin'] })
        const req = request('/api/orders', { authorization: `JWT ${await passwordToken()}` })

        // Act / Assert
        expect(await refusePreOtpPayloadToken(req, loadPayload)).toBeNull()
        expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'users', id: 7, select: { roles: true } }))
    })

    it('uses the database roles, not the token: a demoted super-admin is refused', async () => {
        // Arrange — the JWT still says super-admin (saveToJWT), the user no longer is
        findByID.mockResolvedValue({ id: 7, roles: ['tenant-owner'] })
        const req = request('/api/tenants', { authorization: `JWT ${await passwordToken({ roles: ['super-admin'] })}` })

        // Act / Assert
        expect((await refusePreOtpPayloadToken(req, loadPayload))?.status).toBe(401)
    })

    it('passes a Payload token that carries the OTP proof', async () => {
        const req = request('/api/orders', { authorization: `JWT ${await passwordToken({ mfa_verified: true })}` })

        expect(await refusePreOtpPayloadToken(req, loadPayload)).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('does not touch requests without a token or with the OTP / SSO session token', async () => {
        // Arrange
        const anonymous = request('/api/orders')
        const otp = request('/api/orders', { cookie: `payload-token=${await otpToken()}` })

        // Act / Assert — anonymous costs nothing; the app token is not Payload's (REST ignores it anyway)
        expect(await refusePreOtpPayloadToken(anonymous, loadPayload)).toBeNull()
        expect(loadPayload).not.toHaveBeenCalled()
        expect(await refusePreOtpPayloadToken(otp, loadPayload)).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('refuses when the roles cannot be read (fails closed)', async () => {
        findByID.mockRejectedValue(new Error('db down'))
        const req = request('/api/orders', { authorization: `Bearer ${await passwordToken()}` })

        expect((await refusePreOtpPayloadToken(req, loadPayload))?.status).toBe(401)
    })
})

describe('request parsing [TC-PERF-142]', () => {
    it('normalises the REST path', () => {
        expect(restPath('http://x/api/users/login?x=1')).toBe('users/login')
        expect(restPath('http://x/api/orders/')).toBe('orders')
    })

    it('decodes cookies once, deduplicates after decoding and leaves headers untouched', () => {
        // Arrange
        const req = request('/api/x', { authorization: 'JWT a.b.c', cookie: 'payload-token=a%2Eb%2Ec; payload-token=%252E' })
        // Act / Assert
        expect(candidateTokens(req)).toEqual(['a.b.c', '%2E'])
        expect(candidateTokens(request('/api/x', { authorization: 'JWT a%2Eb', cookie: 'payload-token=%broken' }))).toEqual(['a%2Eb', '%broken'])
    })

    it('keeps both Next and Payload interpretations when reserved escapes differ', () => {
        // Arrange
        const req = request('/api/x', { cookie: 'payload-token =a%2Fb.c.d' })
        // Act / Assert
        expect(candidateTokens(req)).toEqual(['a/b.c.d', 'a%2Fb.c.d'])
    })

    it('collects the header and the cookie token once each', () => {
        const req = request('/api/x', { authorization: 'JWT aaa', cookie: 'a=1; payload-token=bbb; payload-token=aaa' })

        expect(candidateTokens(req)).toEqual(['aaa', 'bbb'])
    })
})
