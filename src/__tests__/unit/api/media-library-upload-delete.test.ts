/**
 * TC-PERF-190..193 — Dashboard Media page upload and delete on the app session (GH-2187).
 * The page used Payload REST (`POST /api/media`, `DELETE /api/media/{id}`), which refuses the app's post-OTP token
 * (403 for shop owners). It now uses `POST /api/media/upload` and `DELETE /api/media/library/{id}`.
 * Real: both route handlers, lib/auth.ts getCurrentUser (OTP gate + same-site check for cookie sessions),
 * lib/auth/session-token.ts + session-user.ts (tokens really signed with jose), lib/media/media-access.ts
 * (canWriteMedia, assignMediaTenant). Faked: Payload (users / media reads, create, delete), the cookie store.
 */
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let sessionCookie: string | undefined
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({ get: (name: string) => (name === 'payload-token' && sessionCookie ? { value: sessionCookie } : undefined) })),
}))

const findByID = vi.fn()
const create = vi.fn()
const remove = vi.fn()
const getPayload = vi.fn()
vi.mock('payload', () => ({ getPayload: (...args: unknown[]) => getPayload(...args) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST as upload } from '@/app/api/media/upload/route'
import { DELETE as deleteMedia } from '@/app/api/media/library/[id]/route'
import { assignMediaTenant } from '@/lib/media/media-access'

const RAW_SECRET = 'raw-payload-secret-for-tests-0123456789'
const HOST = 'app.test'
const SHOP = 42

const owner = {
    id: 7,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: SHOP, name: 'Shop', slug: 'shop', status: 'active' }, role: 'owner', status: 'active', permissions: [] }],
    sessions: [{ id: 's1', expiresAt: '2099-01-01T00:00:00.000Z' }],
}

const media: Record<number, { id: number; tenant: number | null; private: boolean }> = {
    1: { id: 1, tenant: SHOP, private: false }, // this shop's upload
    2: { id: 2, tenant: 99, private: false }, // another shop's file
    3: { id: 3, tenant: null, private: false }, // legacy file without a tenant
    4: { id: 4, tenant: SHOP, private: true }, // buyer payment receipt
}

/** The token verify-otp hands out: raw PAYLOAD_SECRET, `mfa_verified`, no Payload version header. */
const otpToken = () =>
    new SignJWT({ id: 7, collection: 'users', mfa_verified: true })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(RAW_SECRET))

const sameSite = { host: HOST, origin: `http://${HOST}` }
const crossSite = { host: HOST, origin: 'https://evil.example' }

function uploadRequest(headers: Record<string, string>) {
    const form = new FormData()
    form.append('file', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shop-logo.png', { type: 'image/png' }))
    form.append('alt', 'shop logo')
    return new Request(`http://${HOST}/api/media/upload`, { method: 'POST', headers, body: form }) as never
}

function deleteRequest(id: number | string, headers: Record<string, string>) {
    const req = new Request(`http://${HOST}/api/media/library/${id}`, { method: 'DELETE', headers })
    return deleteMedia(req, { params: Promise.resolve({ id: String(id) }) })
}

beforeEach(async () => {
    vi.stubEnv('PAYLOAD_SECRET', RAW_SECRET)
    sessionCookie = await otpToken()
    findByID.mockReset().mockImplementation(async (args: { collection: string; id: number }) =>
        args.collection === 'users' ? structuredClone(owner) : structuredClone(media[args.id] ?? null))
    create.mockReset().mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 10, ...args.data }))
    remove.mockReset().mockResolvedValue({ id: 1 })
    getPayload.mockReset().mockResolvedValue({
        secret: 'derived-payload-secret-0123456789ab',
        findByID,
        create,
        delete: remove,
        db: { defaultIDType: 'number' },
        collections: { users: { config: { auth: {} } } },
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('upload on the app session [TC-PERF-190]', () => {
    it('TC-PERF-190: shop owner with the post-OTP cookie → 200, row created as that user, which puts it in their shop', async () => {
        // Act
        const res = await upload(uploadRequest(sameSite))

        // Assert
        expect(res.status).toBe(200)
        expect(create).toHaveBeenCalledTimes(1)
        const args = create.mock.calls[0][0]
        expect(args).toMatchObject({ collection: 'media', data: { alt: 'shop logo' }, file: { name: 'shop-logo.png', mimetype: 'image/png' } })
        expect(args.user).toMatchObject({ id: 7 })
        // The Media beforeChange hook Payload runs for this user sets the tenant to the owner's shop
        const data = assignMediaTenant({ data: { ...args.data }, operation: 'create', req: { user: args.user } } as never)
        expect(data).toMatchObject({ tenant: SHOP, private: false })
    })

    it('TC-PERF-190: no session → 401, nothing created', async () => {
        // Arrange
        sessionCookie = undefined

        // Act
        const res = await upload(uploadRequest(sameSite))

        // Assert
        expect(res.status).toBe(401)
        expect(create).not.toHaveBeenCalled()
    })

    it('TC-PERF-190: cookie session from another site (or with no Origin / Referer) → 401, nothing created', async () => {
        // Act
        const crossRes = await upload(uploadRequest(crossSite))
        const bareRes = await upload(uploadRequest({ host: HOST }))

        // Assert
        expect(crossRes.status).toBe(401)
        expect(bareRes.status).toBe(401)
        expect(create).not.toHaveBeenCalled()
    })
})

describe('delete own file on the app session [TC-PERF-191]', () => {
    it('TC-PERF-191: shop owner deletes their shop’s file → 200, deleted as that user with access checked', async () => {
        // Act
        const res = await deleteRequest(1, sameSite)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true, id: 1 })
        expect(remove).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 1, overrideAccess: false, user: expect.objectContaining({ id: 7 }) }))
    })

    it('TC-PERF-191: Media delete access refusing inside Payload still answers 403, not 500', async () => {
        // Arrange
        remove.mockRejectedValue(Object.assign(new Error('You are not allowed to perform this action.'), { status: 403 }))

        // Act
        const res = await deleteRequest(1, sameSite)

        // Assert
        expect(res.status).toBe(403)
    })
})

describe('delete refused for files that are not the shop’s to delete [TC-PERF-192]', () => {
    it.each([
        ['another shop’s file', 2],
        ['legacy file without a tenant', 3],
        ['buyer payment receipt (private)', 4],
    ])('TC-PERF-192: %s → 403, nothing deleted', async (_label, id) => {
        // Act
        const res = await deleteRequest(id, sameSite)

        // Assert
        expect(res.status).toBe(403)
        expect(remove).not.toHaveBeenCalled()
    })

    it('TC-PERF-192: unknown or malformed id → 404, nothing deleted', async () => {
        // Act
        const missing = await deleteRequest(555, sameSite)
        const malformed = await deleteRequest('1;drop', sameSite)

        // Assert
        expect(missing.status).toBe(404)
        expect(malformed.status).toBe(404)
        expect(remove).not.toHaveBeenCalled()
    })
})

describe('delete refused without a same-site session [TC-PERF-193]', () => {
    it('TC-PERF-193: no session → 401, nothing read or deleted', async () => {
        // Arrange
        sessionCookie = undefined

        // Act
        const res = await deleteRequest(1, sameSite)

        // Assert
        expect(res.status).toBe(401)
        expect(remove).not.toHaveBeenCalled()
    })

    it('TC-PERF-193: cookie session from another site or with no Origin / Referer → 401, nothing deleted', async () => {
        // Act
        const crossRes = await deleteRequest(1, crossSite)
        const bareRes = await deleteRequest(1, { host: HOST })

        // Assert
        expect(crossRes.status).toBe(401)
        expect(bareRes.status).toBe(401)
        expect(remove).not.toHaveBeenCalled()
    })

    it('TC-PERF-193: the password-only Payload token (no OTP) → 401, nothing deleted', async () => {
        // Arrange — Payload's own login token: derived secret, version header, no mfa_verified
        sessionCookie = await new SignJWT({ id: 7, collection: 'users', sid: 's1' })
            .setProtectedHeader({ alg: 'HS256', authVersion: 1, typ: 'JWT' } as never)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode('derived-payload-secret-0123456789ab'))

        // Act
        const res = await deleteRequest(1, sameSite)

        // Assert
        expect(res.status).toBe(401)
        expect(remove).not.toHaveBeenCalled()
    })
})
