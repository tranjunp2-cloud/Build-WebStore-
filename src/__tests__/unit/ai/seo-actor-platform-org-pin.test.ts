// @vitest-environment node
/**
 * TC-PERF-183 — AI actors built from a session user (no tenant `metaData` since TC-PERF-151) are billed to the
 * tenant's pinned platform org (`metaData.platformOrgId`), not the derived `org_<hash>`:
 *   - `withAiActorFor` (product status toggle → the SEO its hook queues, `save-product.ts`);
 *   - the hook's `req.user` (publisher) in `resolveSeoActor`.
 * Same rule as TC-AISEC-016 for `resolveActorForUser`.
 * Real: lib/ai/seo-actor.ts, lib/ai-platform/context.ts (actorForSessionUserInTenant), actor-scope, bridge-token.
 * Faked: Payload (the tenants pin read), the cookie store (context.ts imports next/headers).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }))
const findByID = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID })) }))
vi.mock('@payload-config', () => ({ default: {} }))

import type { Payload } from 'payload'
import { currentAiActor } from '@/lib/ai-platform/actor-scope'
import { resolveSeoActor, withAiActorFor } from '@/lib/ai/seo-actor'
import { toPlatformOrganizationId } from '@/lib/auth/bridge-token'

const PINNED_ORG = 'org_legacyech0000000000000001'
/** The session user (SESSION_USER_POPULATE): tenant trimmed to id/name/slug/status, no metaData. */
const sessionUser = {
    id: 3,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 42, name: 'Shop', slug: 'shop', status: 'active' }, role: 'owner', status: 'active' }],
}
const pinnedTenant = { id: 42, metaData: { platformOrgId: PINNED_ORG, platformOrgName: 'Legacy ECH' } }

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'https://ai.example.test')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(40))
    findByID.mockReset()
    findByID.mockResolvedValue(pinnedTenant)
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('session-user AI actors use the tenant platform-org pin [TC-PERF-183]', () => {
    it('withAiActorFor runs the write as the session user in the pinned org', async () => {
        // Arrange
        let scoped: ReturnType<typeof currentAiActor> = null

        // Act
        const result = await withAiActorFor(sessionUser, 42, async () => {
            scoped = currentAiActor()
            return 'written'
        })

        // Assert
        expect(result).toBe('written')
        expect(scoped).toMatchObject({ tenantId: '42', organizationId: PINNED_ORG, role: 'owner' })
        expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'tenants', id: 42, select: { metaData: true } }))
    })

    it('withAiActorFor keeps the derived org for a tenant with no pin', async () => {
        findByID.mockResolvedValue({ id: 42, metaData: null })
        let scoped: ReturnType<typeof currentAiActor> = null

        await withAiActorFor(sessionUser, 42, async () => { scoped = currentAiActor() })

        expect(scoped).toMatchObject({ organizationId: toPlatformOrganizationId('42') })
    })

    it('withAiActorFor still runs the write (as nobody) for a non-member, without reading the tenant', async () => {
        let scoped: ReturnType<typeof currentAiActor> = null

        const result = await withAiActorFor(sessionUser, 99, async () => { scoped = currentAiActor(); return 'written' })

        expect(result).toBe('written')
        expect(scoped).toBeNull()
        expect(findByID).not.toHaveBeenCalled()
    })

    it('resolveSeoActor bills the hook publisher (session user) to the pinned org', async () => {
        // Arrange
        const payload = { find: vi.fn() } as unknown as Payload

        // Act
        const { actor } = await resolveSeoActor(payload, { id: 5, tenant: 42 }, { publisher: sessionUser })

        // Assert
        expect(actor).toMatchObject({ tenantId: '42', organizationId: PINNED_ORG })
        expect(payload.find).not.toHaveBeenCalled() // no fallback to the site's generation record
    })

    it('a fully loaded publisher (Local API read, metaData present) needs no extra tenant read', async () => {
        const loaded = { ...sessionUser, tenants: [{ ...sessionUser.tenants[0], tenant: { ...sessionUser.tenants[0].tenant, ...pinnedTenant } }] }

        const { actor } = await resolveSeoActor({ find: vi.fn() } as unknown as Payload, { id: 5, tenant: 42 }, { publisher: loaded })

        expect(actor).toMatchObject({ organizationId: PINNED_ORG })
        expect(findByID).not.toHaveBeenCalled()
    })
})
