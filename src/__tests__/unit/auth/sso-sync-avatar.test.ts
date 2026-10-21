import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { POST } from '@/app/api/v1/sso/sync-avatar/route'
import { getCurrentUser } from '@/lib/auth'
import { resolveSsoOwner } from '@/lib/sso/avatar-sync/resolve-sso-owner'
import { applyAvatarState } from '@/lib/sso/avatar-sync/apply-avatar-state'
import { AvatarDownloadError } from '@/lib/sso/avatar-sync/download-sso-avatar'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/sso/avatar-sync/resolve-sso-owner', () => ({ resolveSsoOwner: vi.fn() }))
vi.mock('@/lib/sso/avatar-sync/apply-avatar-state', () => ({ applyAvatarState: vi.fn() }))

// Fixture = contract example (contract-sso-pw2-avatar-sync.md)
const presentBody = {
    sso_user_id: 1234,
    email: 'owner@example.com',
    state: 'PRESENT',
    avatar_url: 'https://sso-bucket.s3.ap-southeast-1.amazonaws.com/images/users/12341760940800.1234.png',
    avatar_key: '12341760940800.1234.png',
    changed_at: '2026-10-20T06:40:00Z',
    trigger: 'update',
}

const makeRequest = (body: unknown, auth = 'Bearer admin-token') =>
    new NextRequest('http://localhost/api/v1/sso/sync-avatar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
        body: JSON.stringify(body),
    })

describe('POST /api/v1/sso/sync-avatar', () => {
    const ownerDoc = { id: 7, tenants: [{ role: 'owner' }] }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.mocked(getPayload).mockResolvedValue({} as any)
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, roles: ['super-admin'] } as any)
    })

    // TC-F23-SSO-09: endpoint requires the SSO service (super-admin) Bearer token
    it('returns 401 without a Bearer token', async () => {
        const res = await POST(makeRequest(presentBody, ''))
        expect(res.status).toBe(401)
        expect(resolveSsoOwner).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09
    it('returns 403 when the caller is not super-admin', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 2, roles: ['tenant-owner'] } as any)
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(403)
    })

    // TC-F23-SSO-11: PRESENT without avatar_url is rejected by the contract schema
    it('returns 400 for a payload that breaks the contract', async () => {
        const { avatar_url: _omit, ...invalid } = presentBody
        const res = await POST(makeRequest(invalid))
        expect(res.status).toBe(400)
        expect(resolveSsoOwner).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-09: unmapped Owner → 409 with reason, avatar untouched
    it('returns 409 with the reason when the Owner cannot be mapped', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: false, reason: 'ambiguous_email' })
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ reason: 'ambiguous_email' })
        expect(applyAvatarState).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-11: email mapping disabled (default) → 409 with its own reason, never a silent bind
    it('returns 409 email_bind_disabled when the Owner is not bound yet and email binding is off', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: false, reason: 'email_bind_disabled' })
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ reason: 'email_bind_disabled' })
        expect(applyAvatarState).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-06: a database error must surface as 500 (SSO retries), not as a permanent 409
    it('lets SSO retry by returning 500 when resolving the Owner hits a database error', async () => {
        vi.mocked(resolveSsoOwner).mockRejectedValue(Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' }))
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(500)
    })

    // TC-F23-SSO-06: transient download failure keeps last-known avatar and asks SSO to retry
    it('returns 502 when the avatar download fails transiently', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: true, user: ownerDoc, bound: false })
        vi.mocked(applyAvatarState).mockRejectedValue(new AvatarDownloadError('HTTP 503', true))
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(502)
    })

    // TC-F23-SSO-08: deterministic rejection (URL/size/type/4xx) → 422 so SSO does not retry
    it('returns 422 when the avatar is rejected permanently', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: true, user: ownerDoc, bound: false })
        vi.mocked(applyAvatarState).mockRejectedValue(new AvatarDownloadError('Avatar is not a JPEG or PNG image'))
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(422)
    })

    // TC-F23-SSO-01: happy path passes the resolved Owner and parsed input to the applier
    it('returns 200 with the apply result', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: true, user: ownerDoc, bound: true })
        vi.mocked(applyAvatarState).mockResolvedValue('updated')

        const res = await POST(makeRequest(presentBody))

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: 'updated', bound: true })
        expect(resolveSsoOwner).toHaveBeenCalledWith({}, { ssoUserId: 1234, email: 'owner@example.com' })
        expect(applyAvatarState).toHaveBeenCalledWith({}, ownerDoc, expect.objectContaining({ state: 'PRESENT', avatar_key: presentBody.avatar_key }))
    })

    // TC-F23-SSO-02: ABSENT state is accepted without url/key
    it('accepts an ABSENT payload', async () => {
        vi.mocked(resolveSsoOwner).mockResolvedValue({ ok: true, user: ownerDoc, bound: false })
        vi.mocked(applyAvatarState).mockResolvedValue('cleared')
        const body = { sso_user_id: 1234, email: 'owner@example.com', state: 'ABSENT', changed_at: '2026-10-20T06:40:00+00:00', trigger: 'backfill' }

        const res = await POST(makeRequest(body))

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ result: 'cleared' })
    })

    // Unexpected errors are not leaked
    it('returns 500 on unexpected errors', async () => {
        vi.mocked(resolveSsoOwner).mockRejectedValue(new Error('db down'))
        const res = await POST(makeRequest(presentBody))
        expect(res.status).toBe(500)
    })
})
