/**
 * TC-AIWB-95 — once the model provider reports no credit left (platform 402), the rest of the run skips the
 * platform call (no per-step round trip / timeout) and the run reports insufficient_quota.
 * TC-AIWB-96 — users never see provider billing detail: 402 maps to the generic outage message.
 * Real: actor-scope.ts (completeComposed, scope), ai-tasks.ts describeAiTaskFailure, the real ai-contracts client.
 * Faked: the network (fetch) and the context-token signer.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AiClientError } from '@ech/ai-contracts'

vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {},
    resolveActorForUser: vi.fn(),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import {
    AiProviderCreditError,
    AiUnavailableError,
    aiQuotaHitInScope,
    completeComposed,
    runWithAiActor,
} from '@/lib/ai-platform/actor-scope'
import { describeAiTaskFailure } from '@/lib/ai-platform/ai-tasks'
import type { AgentActor } from '@/lib/ai-platform/context'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'

const fetchMock = vi.fn<typeof fetch>()
const actor = (): AgentActor => ({ user: { id: 7 } as never, tenantId: '1', organizationId: 'org_1', role: 'owner' })

const taskOk = () => Response.json({
    taskId: 'sitegen.personalize',
    promptVersion: 'sitegen.personalize@1',
    requestId: 'r1',
    output: { headline: 'Hi' },
    usage: { provider: 'openai', model: 'gpt-4.1-nano', costUsdMicros: 1, latencyMs: 5, fallbacks: [] },
})
const credit402 = () => Response.json({ title: 'Task failed', status: 402, detail: 'The AI provider has no credit left.', code: 'provider_insufficient_quota' }, { status: 402 })

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('provider credit exhaustion fails the run fast [TC-AIWB-95]', () => {
    it('the first 402 is surfaced; later steps of the same run never reach the platform', async () => {
        fetchMock.mockResolvedValueOnce(credit402())

        await runWithAiActor(actor(), async () => {
            await expect(completeComposed('sitegen.personalize', { user: 'a' })).rejects.toMatchObject({ status: 402 })
            expect(aiQuotaHitInScope()).toBe(true)

            const second = completeComposed('sitegen.sample-products', { user: 'b' })
            await expect(second).rejects.toBeInstanceOf(AiProviderCreditError)
            await expect(second).rejects.toBeInstanceOf(AiUnavailableError) // steps already fall back on this
            await expect(completeComposed('sitegen.blog-seeds', { user: 'c' })).rejects.toBeInstanceOf(AiProviderCreditError)
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not poison another run (another request builds its own actor)', async () => {
        fetchMock.mockResolvedValueOnce(credit402()).mockResolvedValueOnce(taskOk())

        await runWithAiActor(actor(), async () => {
            await expect(completeComposed('sitegen.personalize', { user: 'a' })).rejects.toMatchObject({ status: 402 })
        })
        const result = await runWithAiActor(actor(), () => completeComposed('sitegen.personalize', { user: 'a' }))

        expect(JSON.parse(result.content)).toEqual({ headline: 'Hi' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('a plain 429 (workspace quota) still reports insufficient_quota but keeps later steps calling', async () => {
        fetchMock
            .mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))
            .mockResolvedValueOnce(taskOk())

        await runWithAiActor(actor(), async () => {
            await expect(completeComposed('sitegen.personalize', { user: 'a' })).rejects.toMatchObject({ status: 429 })
            expect(aiQuotaHitInScope()).toBe(true)
            await expect(completeComposed('sitegen.personalize', { user: 'b' })).resolves.toBeDefined()
        })
    })

    it('a 503 outage does not claim quota', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'The AI could not complete this task.' }, { status: 503 }))

        await runWithAiActor(actor(), async () => {
            await expect(completeComposed('sitegen.personalize', { user: 'a' })).rejects.toMatchObject({ status: 503 })
            expect(aiQuotaHitInScope()).toBe(false)
        })
    })
})

describe('site generation on an exhausted provider [TC-AIWB-95]', () => {
    it('falls back to the template site, reports insufficient_quota, and stops calling the platform after the first 402', async () => {
        fetchMock.mockImplementation(async () => credit402())

        const output = await runWithAiActor(actor(), () =>
            generateSiteWithAI({ businessName: 'Kedai Kopi', industry: 'Restaurant', products: 'Coffee', shortDescription: 'A cozy cafe' }))

        expect(output.result.blocks.length).toBeGreaterThan(0)
        expect(output.effectiveGenMode).toBe('template-first')
        expect(output.modeReason).toBe('insufficient_quota')
        // Parallel in-flight steps may each see the 402 once; the point is it is bounded, not one per step.
        expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2)
    })
})

describe('user-facing mapping of provider billing errors [TC-AIWB-96]', () => {
    it('maps 402 to a generic 502 without billing wording', () => {
        const failure = describeAiTaskFailure(new AiClientError('The AI provider has no credit left.', 402))
        expect(failure.status).toBe(502)
        expect(failure.message).not.toMatch(/credit|billing|quota/i)
    })
})
