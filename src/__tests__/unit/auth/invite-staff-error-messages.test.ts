// @vitest-environment node
/**
 * GH-2305 contract: every rejection from the real POST /invite-staff handler maps to translated drawer copy,
 * so a reworded server message cannot silently bring the raw English toast back.
 * TC-F19-2305-07 (docs/qa/F19-store-configuration.md). Real: Users endpoint handler, classifyInviteStaffError,
 * Payload ValidationError. Faked: plan subscription, email template, the payload instance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError, type PayloadRequest } from 'payload'

const { canUseWithinLimit } = vi.hoisted(() => ({ canUseWithinLimit: vi.fn() }))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 10, plan: 'pro' }),
    canUseWithinLimit,
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: vi.fn().mockResolvedValue({ enabled: false }),
}))

import { Users } from '@/collections/Users'
import { classifyInviteStaffError } from '@/app/(dashboard)/settings/staff/invite-staff-error'

const inviteHandler = (Users.endpoints || []).find((e) => e.path === '/invite-staff')?.handler

type Existing = { tenants: Array<{ tenant: number; role: string; status: string }> } | null

function buildReq(opts: { email?: string; requesterRole?: string; existing?: Existing; createError?: Error }) {
    const payload = {
        find: vi.fn().mockResolvedValue({ docs: opts.existing ? [{ id: 42, email: opts.email, ...opts.existing }] : [] }),
        create: vi.fn().mockImplementation(async () => { if (opts.createError) throw opts.createError; return { id: 43 } }),
        update: vi.fn().mockResolvedValue({}),
        findByID: vi.fn().mockResolvedValue({ id: 5, name: 'Shop' }),
        sendEmail: vi.fn().mockResolvedValue({}),
    }
    return {
        json: vi.fn().mockResolvedValue({ email: opts.email ?? 'staff@example.com', name: 'Staff', tenantId: '5', role: 'admin' }),
        headers: new Headers(),
        payload,
        user: { id: 1, email: 'owner@example.com', roles: [], tenants: [{ tenant: 5, role: opts.requesterRole ?? 'owner', status: 'active' }] },
    } as unknown as PayloadRequest
}

async function rejectionMessage(req: PayloadRequest) {
    const res = (await inviteHandler!(req)) as Response
    expect(res.ok).toBe(false)
    const body = (await res.json()) as { errors?: Array<{ message?: string }> }
    return body.errors?.[0]?.message
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    vi.clearAllMocks()
    canUseWithinLimit.mockResolvedValue(true)
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    consoleError.mockRestore()
})

describe('[TC-F19-2305-07] POST /invite-staff rejections map to translated copy', () => {
    it.each([
        ['self invite', () => buildReq({ email: 'Owner@Example.com' }), { target: 'email', key: 'errorSelfInvite' }],
        ['email over 254 characters', () => buildReq({ email: `${'a'.repeat(250)}@example.com` }), { target: 'email', key: 'errorEmailTooLong' }],
        ['already in this store', () => buildReq({ existing: { tenants: [{ tenant: 5, role: 'admin', status: 'active' }] } }), { target: 'email', key: 'errorAlreadyMember' }],
        ['owner of another store', () => buildReq({ existing: { tenants: [{ tenant: 9, role: 'owner', status: 'active' }] } }), { target: 'email', key: 'errorOwnerElsewhere' }],
        ['requester is not the owner', () => buildReq({ requesterRole: 'admin' }), { target: 'toast', key: 'inviteNotAllowed' }],
        [
            'Payload rejects the email',
            () => buildReq({ createError: new ValidationError({ collection: 'users', errors: [{ path: 'email', label: 'Email', message: 'validation:emailAddress' }] }) }),
            { target: 'email', key: 'errorEmailInvalid' },
        ],
    ] as const)('%s', async (_label, makeReq, expected) => {
        // Arrange
        const req = makeReq()

        // Act
        const message = await rejectionMessage(req)

        // Assert
        expect(classifyInviteStaffError(message)).toEqual(expected)
    })

    it('staff limit reached on the plan', async () => {
        // Arrange
        canUseWithinLimit.mockResolvedValue(false)

        // Act
        const message = await rejectionMessage(buildReq({}))

        // Assert
        expect(classifyInviteStaffError(message)).toEqual({ target: 'toast', key: 'inviteLimitReached' })
    })
})
