/**
 * TC-AIWB-92 — a generation that ran without AI records WHY (no workspace, staff outside the workspace,
 * record without user/tenant, platform off) instead of ending as a plain success.
 * TC-AIWB-93 — the reason travels on the site-generation outcome (modeReason `no_ai_actor` + aiSkipReason),
 * in template-first mode too, and an unconfigured platform keeps `missing_api_key`.
 * Real: generation-actor.ts, the membership check in context.ts, openai-generator.ts mode logic.
 * Faked: the Payload lookup, the session module, the actor-scope module (scripted platform double).
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { scripted } from '@/__tests__/helpers/scripted-ai-platform'

vi.mock('@/lib/ai-platform/actor-scope', async (importOriginal) => {
    const { scriptedActorScope } = await import('@/__tests__/helpers/scripted-ai-platform')
    return scriptedActorScope(await importOriginal<any>())
})
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => null) }))

import { resolveGenerationRecordActor, classifyActorFailure } from '@/lib/ai/generation-actor'
import { AgentAccessError } from '@/lib/ai-platform/context'
import { generateSiteWithAI, resolveSiteGenerationMode } from '@/lib/ai/openai-generator'

const MEMBER = {
    id: 7,
    email: 'merchant@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 1, name: 'Kedai Kopi' }, status: 'active', role: 'owner' }],
}
const STAFF = { id: 1, email: 'staff@ech.my', roles: ['super-admin'], tenants: [] }

const findByID = vi.fn()
const payload = { findByID } as unknown as Parameters<typeof resolveGenerationRecordActor>[0]

beforeEach(() => {
    findByID.mockReset().mockResolvedValue(MEMBER)
    scripted.create = null
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
})

afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.GEN_MODE
})

describe('resolveGenerationRecordActor skip reasons [TC-AIWB-92]', () => {
    it('returns the actor and no reason for an active member', async () => {
        const result = await resolveGenerationRecordActor(payload, { user: 7, tenant: 1 })
        expect(result.actor).toMatchObject({ tenantId: '1', role: 'owner' })
        expect(result.skipReason).toBeUndefined()
    })

    it.each([
        ['a record without a user', { tenant: 1 }, 'record_missing_user'],
        ['a record without a workspace', { user: 7 }, 'record_missing_workspace'],
    ] as const)('says why for %s', async (_label, record, reason) => {
        expect(await resolveGenerationRecordActor(payload, record)).toEqual({ actor: null, skipReason: reason })
        expect(findByID).not.toHaveBeenCalled()
    })

    it('says not_workspace_member for a lapsed membership', async () => {
        findByID.mockResolvedValue({ ...MEMBER, tenants: [{ tenant: { id: 2 }, status: 'active', role: 'owner' }] })
        expect(await resolveGenerationRecordActor(payload, { user: 7, tenant: 1 })).toEqual({ actor: null, skipReason: 'not_workspace_member' })
    })

    it('says not_workspace_member for platform staff outside the workspace', async () => {
        findByID.mockResolvedValue(STAFF)
        expect(await resolveGenerationRecordActor(payload, { user: 1, tenant: 1 })).toEqual({ actor: null, skipReason: 'not_workspace_member' })
    })

    it('says actor_lookup_failed when the user cannot be read', async () => {
        findByID.mockRejectedValue(new Error('db down'))
        expect(await resolveGenerationRecordActor(payload, { user: 7, tenant: 1 })).toEqual({ actor: null, skipReason: 'actor_lookup_failed' })
    })

    it('says ai_unconfigured when the platform is off', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')
        expect(await resolveGenerationRecordActor(payload, { user: 7, tenant: 1 })).toEqual({ actor: null, skipReason: 'ai_unconfigured' })
    })

    it('classifies access refusals apart from unexpected failures', () => {
        expect(classifyActorFailure(new AgentAccessError('no', 403))).toBe('not_workspace_member')
        expect(classifyActorFailure(new Error('boom'))).toBe('actor_lookup_failed')
    })
})

describe('site generation outcome carries the reason [TC-AIWB-93]', () => {
    it('records no_ai_actor + the reason in the default template-first mode (used to be silent)', async () => {
        const decision = await resolveSiteGenerationMode('no_workspace')
        expect(decision).toEqual({
            requestedGenMode: 'template-first',
            effectiveGenMode: 'template-first',
            modeReason: 'no_ai_actor',
            aiSkipReason: 'no_workspace',
        })
    })

    it('records no_ai_actor for ai-first as well', async () => {
        process.env.GEN_MODE = 'ai-first'
        expect(await resolveSiteGenerationMode('not_workspace_member')).toMatchObject({
            requestedGenMode: 'ai-first',
            modeReason: 'no_ai_actor',
            aiSkipReason: 'not_workspace_member',
        })
    })

    it('keeps missing_api_key when the platform itself is not configured', async () => {
        expect(await resolveSiteGenerationMode('ai_unconfigured')).toMatchObject({ modeReason: 'missing_api_key' })
        expect((await resolveSiteGenerationMode('ai_unconfigured')).aiSkipReason).toBeUndefined()
        expect(await resolveSiteGenerationMode()).toMatchObject({ modeReason: 'missing_api_key' })
    })

    it('records no reason when an actor is available and the mode is the configured default', async () => {
        scripted.mockImplementation(() => ({ chat: { completions: { create: vi.fn() } } }))
        expect(await resolveSiteGenerationMode()).toEqual({ requestedGenMode: 'template-first', effectiveGenMode: 'template-first' })
    })

    it('the rule-based result of a run with no billable actor reports no_ai_actor and the reason', async () => {
        const modeDecision = await resolveSiteGenerationMode('not_workspace_member')
        const output = await generateSiteWithAI(
            { businessName: 'Kedai Kopi', industry: 'Restaurant', products: 'Coffee', shortDescription: 'A cozy cafe' },
            undefined, undefined, undefined, undefined, undefined,
            { modeDecision },
        )

        expect(output.result.blocks.length).toBeGreaterThan(0)
        expect(output.effectiveGenMode).toBe('template-first')
        expect(output.modeReason).toBe('no_ai_actor')
        expect(output.aiSkipReason).toBe('not_workspace_member')
    })
})
