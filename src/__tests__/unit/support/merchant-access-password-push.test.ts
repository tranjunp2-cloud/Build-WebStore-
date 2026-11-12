// @vitest-environment node
/**
 * TC-F15.40: a merchant-access session cannot change the merchant's password or register for push / realtime
 * notification channels.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentUser, create, find, login, update } = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    login: vi.fn(),
    update: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser,
    withAuth: (handler: (u: unknown, r: Request, c: unknown) => unknown) => async (req: Request, ctx?: unknown) =>
        handler(await getCurrentUser(req), req, ctx),
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ create, find, login, update, sendEmail: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: 0 }) }))
vi.mock('@/lib/firebase/firebase-admin-app', () => ({ getFirebaseAdminApp: vi.fn().mockResolvedValue(null), getFirebaseServerConfig: vi.fn().mockReturnValue(null) }))
vi.mock('@/lib/notifications/notification-signal-env', () => ({
    getNotificationSignalEnv: vi.fn().mockReturnValue(null),
    signalUid: vi.fn(),
    userSignalPath: vi.fn(),
    broadcastSignalPath: vi.fn(),
}))

import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'
import { POST as passwordPOST } from '@/app/api/users/me/password/route'
import { POST as pushPOST } from '@/app/api/notifications/push-subscribe/route'
import { GET as firebaseGET } from '@/app/api/notifications/firebase-token/route'
import { NextRequest } from 'next/server'

const merchant = { id: 3185, email: 'owner@x.com', roles: ['tenant-owner'], tenants: [{ tenant: 5, role: 'editor', status: 'active' }] }
const FORBIDDEN = 'impersonation_forbidden_action'
let sessionHeaders: Record<string, string>

const req = (path: string, method: string, body: unknown, headers: Record<string, string>) =>
    new NextRequest(`https://app.test${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })

beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('PAYLOAD_SECRET', 'password-push-secret')
    const token = await signMerchantSessionToken({ id: 3185, email: merchant.email }, 7)
    // fake Authorization header + the impersonation cookie: still blocked
    sessionHeaders = { authorization: 'Bearer x', cookie: `payload-token=${token}` }
    getCurrentUser.mockResolvedValue(merchant)
    find.mockResolvedValue({ docs: [] })
})

describe('[TC-F15.40] password and push inside a merchant-access session', () => {
    it('TC-F15.40: POST /api/users/me/password is 403 without a password attempt (staff-role merchant too)', async () => {
        const res = await passwordPOST(req('/api/users/me/password', 'POST',
            { currentPassword: 'old-pass-1', newPassword: 'New-pass-123!', confirmPassword: 'New-pass-123!' }, sessionHeaders))

        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: FORBIDDEN })
        expect(login).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })

    it('TC-F15.40: POST /api/notifications/push-subscribe is 403 and stores nothing', async () => {
        const body = { endpoint: 'https://push.test/abc', keys: { p256dh: 'k', auth: 'a' } }

        const res = await pushPOST(req('/api/notifications/push-subscribe', 'POST', body, sessionHeaders), {} as never)

        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: FORBIDDEN })
        expect(create).not.toHaveBeenCalled()
    })

    it('TC-F15.40: GET /api/notifications/firebase-token is 403', async () => {
        const res = await firebaseGET(req('/api/notifications/firebase-token', 'GET', null, sessionHeaders), {} as never)

        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: FORBIDDEN })
    })

    it('TC-F15.40: a normal session still reaches push-subscribe and firebase-token logic', async () => {
        const push = await pushPOST(req('/api/notifications/push-subscribe', 'POST', { endpoint: 'bad' }, {}), {} as never)
        const fb = await firebaseGET(req('/api/notifications/firebase-token', 'GET', null, {}), {} as never)

        expect(push.status).toBe(400)
        expect(fb.status).toBe(200)
    })
})
