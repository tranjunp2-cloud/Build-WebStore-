// @vitest-environment node
/**
 * TC-PERF-154 — The Payload admin panel never renders for a tenant user's password-step token: Payload put the
 * user with whole tenant rows (Xendit / EasyParcel / ECH secrets) into the RSC payload even of its "unauthorized"
 * redirect. Such a token is sent to /login and the cookie dropped; super-admins and OTP tokens are untouched.
 * Real: middleware.ts, lib/auth/admin-panel-guard.ts, jose. Faked: the slug / domain lookups (fetch).
 */
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPreOtpTenantPayloadToken } from '@/lib/auth/admin-panel-guard'
import { middleware } from '@/middleware'

const sign = (claims: Record<string, unknown>, header: Record<string, unknown> = {}) =>
    new SignJWT({ id: 7, collection: 'users', ...claims })
        .setProtectedHeader({ alg: 'HS256', ...header })
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('any-secret-0123456789abcdef'))
const passwordToken = (roles: string[]) => sign({ sid: 's1', roles }, { authVersion: 1 })
const visit = (path: string, token: string) =>
    middleware(new NextRequest(`https://localhost${path}`, { headers: { host: 'localhost', cookie: `payload-token=${token}` } }))

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })))
})
afterEach(() => vi.unstubAllGlobals())

describe('Payload admin panel and the password-step token [TC-PERF-154]', () => {
    it.each(['/admin', '/admin/collections/orders', '/admin/unauthorized'])('redirects a tenant user\'s token on %s to /login and drops it', async (path) => {
        // Act
        const res = await visit(path, await passwordToken(['tenant-owner']))

        // Assert
        expect(res.status).toBe(307)
        expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
        expect(res.headers.get('set-cookie')).toMatch(/payload-token=;/)
    })

    it('lets a super-admin\'s token through to Payload', async () => {
        const res = await visit('/admin/collections/orders', await passwordToken(['super-admin']))

        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
    })

    it('classifies tokens', async () => {
        expect(isPreOtpTenantPayloadToken(await passwordToken(['tenant-owner']))).toBe(true)
        expect(isPreOtpTenantPayloadToken(await passwordToken([]))).toBe(true)
        expect(isPreOtpTenantPayloadToken(await passwordToken(['super-admin']))).toBe(false)
        expect(isPreOtpTenantPayloadToken(await sign({ mfa_verified: true, roles: [] }, { authVersion: 1 }))).toBe(false)
        expect(isPreOtpTenantPayloadToken(await sign({ mfa_verified: true }))).toBe(false) // OTP / SSO app token
        expect(isPreOtpTenantPayloadToken('not-a-jwt')).toBe(false)
        expect(isPreOtpTenantPayloadToken(undefined)).toBe(false)
    })
})
