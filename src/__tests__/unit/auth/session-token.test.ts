/**
 * TC-PERF-016..019 — session token kind decided once, request memo, pool timeout detection.
 * Real: lib/auth/session-token.ts, lib/auth/request-memo.ts, lib/db/pool-errors.ts, jose (tokens really signed).
 * Faked: nothing.
 */
import { SignJWT } from 'jose'
import { describe, expect, it, vi } from 'vitest'

import {
    appSessionSecrets,
    readAuthorizationToken,
    SessionSignatureError,
    verifySessionToken,
} from '@/lib/auth/session-token'
import { memoizePerRequest } from '@/lib/auth/request-memo'
import { isPoolAcquireTimeout } from '@/lib/db/pool-errors'

const RAW = 'raw-secret-0123456789-raw-secret-01'
const DERIVED = 'derived-secret-0123456789-derived'
const PEER = 'peer-secret-0123456789-peer-secret'
const secrets = { payloadSecret: DERIVED, appSecrets: [RAW, PEER] }

const sign = (secret: string, claims: Record<string, unknown>, header: Record<string, unknown> = {}) =>
    new SignJWT({ id: 7, collection: 'users', ...claims })
        .setProtectedHeader({ alg: 'HS256', ...header })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret))

describe('reading the token and the app secrets [TC-PERF-016]', () => {
    it.each([
        ['Bearer abc', 'abc'],
        ['JWT abc', 'abc'],
        ['Basic abc', null],
        [null, null],
    ])('Authorization %j gives %j', (header, expected) => {
        const req = new Request('http://app.test', header ? { headers: { authorization: header } } : {})

        expect(readAuthorizationToken(req)).toBe(expected)
    })

    it('tries PAYLOAD_SECRET first, then a different SSO_SHARED_SECRET, never twice the same', () => {
        expect(appSessionSecrets({ PAYLOAD_SECRET: RAW, SSO_SHARED_SECRET: PEER })).toEqual([RAW, PEER])
        expect(appSessionSecrets({ PAYLOAD_SECRET: RAW, SSO_SHARED_SECRET: RAW })).toEqual([RAW])
        expect(appSessionSecrets({ PAYLOAD_SECRET: RAW })).toEqual([RAW])
    })
})

describe('token kind [TC-PERF-017]', () => {
    it('reads a Payload login token as kind payload with its session id', async () => {
        const claims = await verifySessionToken(await sign(DERIVED, { sid: 's1' }, { authVersion: 1 }), secrets)

        expect(claims).toEqual({ kind: 'payload', id: 7, sid: 's1', mfaVerified: false })
    })

    it('reads an OTP token as kind app', async () => {
        const claims = await verifySessionToken(await sign(RAW, { mfa_verified: true }), secrets)

        expect(claims).toEqual({ kind: 'app', id: 7, mfaVerified: true })
    })

    it('falls back to the app rules when an authVersion header is not signed by Payload', async () => {
        const claims = await verifySessionToken(await sign(PEER, { mfa_verified: true }, { authVersion: 1 }), secrets)

        expect(claims).toEqual({ kind: 'app', id: 7, mfaVerified: true })
    })

    it('does not accept a derived-secret token without the authVersion header (Payload would not either)', async () => {
        await expect(verifySessionToken(await sign(DERIVED, { sid: 's1' }), secrets)).rejects.toBeInstanceOf(SessionSignatureError)
    })

    it('gives null for a garbage token', async () => {
        expect(await verifySessionToken('not-a-jwt', secrets)).toBeNull()
    })
})

describe('expired tokens [TC-PERF-018]', () => {
    it('reports expiry rather than a wrong secret when the signature matched', async () => {
        const expired = await new SignJWT({ id: 7, collection: 'users', mfa_verified: true })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('-1m')
            .sign(new TextEncoder().encode(PEER))

        const error = await verifySessionToken(expired, secrets).catch((e: unknown) => e)

        expect(error).not.toBeInstanceOf(SessionSignatureError)
        expect((error as { code?: string }).code).toBe('ERR_JWT_EXPIRED')
    })
})

describe('per-request memo and pool timeouts [TC-PERF-019]', () => {
    it('shares one load per scope and key, separate per scope', async () => {
        const load = vi.fn(async () => 'user')
        const requestA = {}
        const requestB = {}

        await Promise.all([memoizePerRequest(requestA, 't', load), memoizePerRequest(requestA, 't', load)])
        await memoizePerRequest(requestB, 't', load)

        expect(load).toHaveBeenCalledTimes(2)
    })

    it('forgets a failed load so the same request may retry', async () => {
        const scope = {}
        const load = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce('user')

        await expect(memoizePerRequest(scope, 't', load)).rejects.toThrow('busy')
        await expect(memoizePerRequest(scope, 't', load)).resolves.toBe('user')
    })

    it('recognises pg-pool\'s acquire timeout, also wrapped by drizzle', () => {
        const pgError = new Error('timeout exceeded when trying to connect')

        expect(isPoolAcquireTimeout(pgError)).toBe(true)
        expect(isPoolAcquireTimeout(Object.assign(new Error('Failed query: select 1'), { cause: pgError }))).toBe(true)
        expect(isPoolAcquireTimeout(new Error('duplicate key value'))).toBe(false)
        expect(isPoolAcquireTimeout(null)).toBe(false)
    })
})
