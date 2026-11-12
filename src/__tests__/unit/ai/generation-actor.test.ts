/**
 * TC-AIMV-06 — admin rerun and the recovery worker generate as the record's user, in the record's
 * tenant (actorForGenerationRecord). A missing user or tenant, a non-member, or a failed lookup → null
 * (rule-based generation, never platform staff billing).
 * Real: generation-actor.ts and the membership check in context.ts. Faked: the Payload lookup and the session module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actorForGenerationRecord } from '@/lib/ai/generation-actor'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => null) }))

const MEMBER = {
    id: 7,
    email: 'merchant@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 1, name: 'Kedai Kopi' }, status: 'active', role: 'owner' }],
}

const findByID = vi.fn()
const payload = { findByID } as unknown as Parameters<typeof actorForGenerationRecord>[0]

beforeEach(() => {
    findByID.mockReset().mockResolvedValue(MEMBER)
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
})

describe('actorForGenerationRecord [TC-AIMV-06]', () => {
    it('resolves the record user as the actor in the record tenant', async () => {
        const actor = await actorForGenerationRecord(payload, { user: 7, tenant: 1 })

        expect(findByID).toHaveBeenCalledWith({ collection: 'users', id: '7', depth: 1, overrideAccess: true })
        expect(actor).toMatchObject({ tenantId: '1', role: 'owner', user: MEMBER })
    })

    it('accepts relation objects for the user and the tenant', async () => {
        const actor = await actorForGenerationRecord(payload, { user: { id: 7 }, tenant: { id: 1 } })

        expect(actor?.tenantId).toBe('1')
    })

    it('returns null when the record has no user', async () => {
        expect(await actorForGenerationRecord(payload, { tenant: 1 })).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('returns null when the record has no tenant', async () => {
        expect(await actorForGenerationRecord(payload, { user: 7 })).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('returns null when the user is not an active member of the record tenant', async () => {
        findByID.mockResolvedValue({ ...MEMBER, tenants: [{ tenant: { id: 2 }, status: 'active', role: 'owner' }] })

        expect(await actorForGenerationRecord(payload, { user: 7, tenant: 1 })).toBeNull()
    })

    it('returns null when the membership in the record tenant is pending', async () => {
        findByID.mockResolvedValue({ ...MEMBER, tenants: [{ tenant: { id: 1 }, status: 'pending', role: 'owner' }] })

        expect(await actorForGenerationRecord(payload, { user: 7, tenant: 1 })).toBeNull()
    })

    it('returns null when the user lookup fails', async () => {
        findByID.mockRejectedValue(new Error('User deleted'))

        expect(await actorForGenerationRecord(payload, { user: 7, tenant: 1 })).toBeNull()
    })

    it('returns null when AI is not configured, without reading the user', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        expect(await actorForGenerationRecord(payload, { user: 7, tenant: 1 })).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })
})
