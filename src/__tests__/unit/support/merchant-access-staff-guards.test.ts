// @vitest-environment node
/**
 * TC-F15.38: inside a merchant-access session the staff endpoints still work, except the moves that would
 * create lasting access (owner/admin roles, re-inviting an existing account, touching an owner).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 10, plan: 'pro' }),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn().mockResolvedValue({ enabled: false }) }))

import { Users } from '@/collections/Users'
import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'

const handler = (path: string) => (Users.endpoints || []).find((e) => e.path === path)!.handler
const owner = { id: 1, email: 'owner@x.com', roles: ['tenant-owner'], tenants: [{ tenant: 5, role: 'owner', status: 'active' }] }
const member = (id: number, role: string) => ({ id, email: `u${id}@x.com`, tenants: [{ tenant: 5, role, status: 'active' }] })

let payload: Record<string, ReturnType<typeof vi.fn>>
let sessionAuth: Record<string, string>
const normalAuth = { authorization: 'JWT plain' }

function makeReq(body: unknown, headers: Record<string, string>) {
    return { json: vi.fn().mockResolvedValue(body), headers: new Headers(headers), payload, user: owner } as unknown as PayloadRequest
}
async function call(path: string, body: unknown, headers: Record<string, string>) {
    return (await handler(path)(makeReq(body, headers))) as Response
}
async function expectForbidden(res: Response) {
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ errors: [{ message: 'impersonation_forbidden_action' }] })
}

beforeEach(async () => {
    vi.clearAllMocks()
    process.env.PAYLOAD_SECRET = 'staff-guard-secret'
    process.env.MAIL_HOST = ''
    sessionAuth = { authorization: `JWT ${await signMerchantSessionToken({ id: 1, email: owner.email }, 7)}` }
    payload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        findByID: vi.fn().mockImplementation(async ({ collection, id }: { collection: string; id: number }) =>
            collection === 'tenants' ? { id: 5, name: 'Shop' } : id === 2 ? member(2, 'editor') : id === 3 ? member(3, 'owner') : null),
        create: vi.fn().mockResolvedValue({ id: 99, firstName: 'N' }),
        update: vi.fn().mockResolvedValue({}),
        sendEmail: vi.fn().mockResolvedValue({}),
    }
})

describe('[TC-F15.38] staff endpoints inside a merchant-access session', () => {
    it.each(['editor', 'viewer', 'custom'])('TC-F15.38: invites a new %s', async (role) => {
        const res = await call('/invite-staff', { email: 'new@x.com', name: 'N', tenantId: '5', role }, sessionAuth)
        expect(res.status).toBe(200)
        expect(payload.create).toHaveBeenCalledTimes(1)
    })

    it.each(['owner', 'admin', 'superuser'])('TC-F15.38: refuses to invite role %s', async (role) => {
        await expectForbidden(await call('/invite-staff', { email: 'new@x.com', name: 'N', tenantId: '5', role }, sessionAuth))
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.sendEmail).not.toHaveBeenCalled()
    })

    it('TC-F15.38: refuses to invite an email that already has an account (no password reset)', async () => {
        payload.find.mockResolvedValue({ docs: [{ id: 42, email: 'old@x.com', tenants: [] }] })

        await expectForbidden(await call('/invite-staff', { email: 'old@x.com', name: 'N', tenantId: '5', role: 'editor' }, sessionAuth))

        expect(payload.update).not.toHaveBeenCalled()
        expect(payload.sendEmail).not.toHaveBeenCalled()
    })

    it('TC-F15.38: a normal owner session keeps inviting admins and existing accounts', async () => {
        expect((await call('/invite-staff', { email: 'new@x.com', name: 'N', tenantId: '5', role: 'admin' }, normalAuth)).status).toBe(200)
        payload.find.mockResolvedValue({ docs: [{ id: 42, email: 'old@x.com', tenants: [] }] })
        expect((await call('/invite-staff', { email: 'old@x.com', name: 'N', tenantId: '5', role: 'owner' }, normalAuth)).status).toBe(200)
    })

    it('TC-F15.38: update-staff allows an editor/viewer change, refuses owner/admin targets and roles', async () => {
        expect((await call('/update-staff', { userId: 2, tenantId: '5', role: 'viewer' }, sessionAuth)).status).toBe(200)
        payload.update.mockClear()

        await expectForbidden(await call('/update-staff', { userId: 2, tenantId: '5', role: 'admin' }, sessionAuth))
        await expectForbidden(await call('/update-staff', { userId: 2, tenantId: '5', role: 'owner' }, sessionAuth))
        await expectForbidden(await call('/update-staff', { userId: 3, tenantId: '5', role: 'editor' }, sessionAuth))
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('TC-F15.38: update-staff on an owner target still works for a normal session', async () => {
        const res = await call('/update-staff', { userId: 3, tenantId: '5', role: 'owner' }, normalAuth)
        expect(res.status).not.toBe(403)
    })

    it('TC-F15.38: update-staff-status and remove-staff refuse an owner target, allow others', async () => {
        await expectForbidden(await call('/update-staff-status', { userId: 3, tenantId: '5', status: 'inactive' }, sessionAuth))
        await expectForbidden(await call('/remove-staff', { userId: 3, tenantId: '5' }, sessionAuth))
        expect(payload.update).not.toHaveBeenCalled()

        expect((await call('/update-staff-status', { userId: 2, tenantId: '5', status: 'inactive' }, sessionAuth)).status).toBe(200)
        expect((await call('/remove-staff', { userId: 2, tenantId: '5' }, sessionAuth)).status).toBe(200)
    })

    it('TC-F15.38: bulk-remove-staff refuses the whole batch when any target is an owner', async () => {
        await expectForbidden(await call('/bulk-remove-staff', { userIds: [2, 3], tenantId: '5' }, sessionAuth))
        expect(payload.update).not.toHaveBeenCalled()

        expect((await call('/bulk-remove-staff', { userIds: [2], tenantId: '5' }, sessionAuth)).status).toBe(200)
        expect(payload.update).toHaveBeenCalledTimes(1)
    })

    it('TC-F15.38: a fake Authorization header does not hide the session cookie', async () => {
        const cookie = sessionAuth.authorization.replace('JWT ', '')
        const res = await call('/invite-staff', { email: 'new@x.com', name: 'N', tenantId: '5', role: 'owner' },
            { authorization: 'Bearer x', cookie: `payload-token=${cookie}` })
        await expectForbidden(res)
    })
})
