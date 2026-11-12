// @vitest-environment node
/**
 * Staff re-invite sets a temporary password. It must call payload.update without `req`,
 * so syncKeyStringOnPasswordUpdate sees no super-admin and keeps the user's keyString
 * (encrypted SSO password). Passing a super-admin `req` (or `user`) would overwrite it with the temp password.
 * TC-F02.66 (docs/qa/F02-auth.md).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PayloadRequest } from 'payload'

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 10, plan: 'pro' }),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn().mockResolvedValue({ enabled: false }),
}))

import { Users } from '@/collections/Users'
import { syncKeyStringOnPasswordUpdate } from '@/lib/auth/sync-key-string-on-password-update'

type HookArgs = Parameters<typeof syncKeyStringOnPasswordUpdate>[0]

const inviteHandler = (Users.endpoints || []).find((e) => e.path === '/invite-staff')?.handler

describe('POST /invite-staff re-invite keeps keyString', () => {
    let payload: Record<string, ReturnType<typeof vi.fn>>
    let savedKey: string | undefined

    beforeEach(() => {
        vi.clearAllMocks()
        // A real key so the hook check below would produce a keyString if a super-admin reached it
        savedKey = process.env.SSO_ENCRYPTION_KEY
        process.env.SSO_ENCRYPTION_KEY = 'a'.repeat(64)
        payload = {
            // Existing user who is not yet in tenant 5 and not an owner elsewhere
            find: vi.fn().mockResolvedValue({ docs: [{ id: 42, email: 'staff@test.com', tenants: [] }] }),
            update: vi.fn().mockResolvedValue({}),
            findByID: vi.fn().mockResolvedValue({ id: 5, name: 'Shop' }),
            sendEmail: vi.fn().mockResolvedValue({}),
        }
    })

    afterEach(() => {
        if (savedKey === undefined) delete process.env.SSO_ENCRYPTION_KEY
        else process.env.SSO_ENCRYPTION_KEY = savedKey
    })

    it('[TC-F02.66] sets the temp password without req or user (no keyString overwrite)', async () => {
        // Arrange: caller is a super-admin who also owns tenant 5
        const req = {
            json: vi.fn().mockResolvedValue({ email: 'staff@test.com', name: 'Staff', tenantId: '5', role: 'admin' }),
            headers: new Headers(),
            payload,
            user: {
                id: 1,
                email: 'owner@test.com',
                roles: ['super-admin'],
                tenants: [{ tenant: 5, role: 'owner', status: 'active' }],
            },
        } as unknown as PayloadRequest

        expect(inviteHandler).toBeDefined()

        // Act
        const res = (await inviteHandler!(req)) as Response

        // Assert
        expect(res.status).toBe(200)
        const passwordUpdate = payload.update.mock.calls
            .map(([args]) => args as Record<string, unknown>)
            .find((args) => typeof (args.data as Record<string, unknown>)?.password === 'string')
        expect(passwordUpdate).toBeDefined()
        expect(passwordUpdate).not.toHaveProperty('req')
        expect(passwordUpdate).not.toHaveProperty('user')
        expect(passwordUpdate!.data).not.toHaveProperty('keyString')

        // Run the real hook the way Payload would for this call: `req` if given, else a req built from `user`.
        const hookReq = passwordUpdate!.req ?? { user: passwordUpdate!.user ?? null, payload: { logger: { error: vi.fn() } } }
        const hookOut = syncKeyStringOnPasswordUpdate({
            data: passwordUpdate!.data,
            operation: 'update',
            req: hookReq,
        } as unknown as HookArgs) as Record<string, unknown>
        expect(hookOut).not.toHaveProperty('keyString')
    })
})
