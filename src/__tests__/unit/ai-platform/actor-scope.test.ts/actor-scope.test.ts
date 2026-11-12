/**
 * TC-AIMV-03 — the AI actor scope that every composed sitegen / migration step reads.
 * Real: actor-scope.ts (AsyncLocalStorage, config gate, completeComposed mapping).
 * Faked: the platform client only (task-client), so the wire call and its reply are observable.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'
import {
    AiUnavailableError,
    bindAiActor,
    completeComposed,
    currentAiActor,
    enterAiActorScope,
    runWithAiActor,
} from '@/lib/ai-platform/actor-scope'

const runTask = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask }) }))

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as unknown as AgentActor
const OTHER = { user: { id: 8 }, tenantId: '2', organizationId: 'org_2', role: 'member' } as unknown as AgentActor
const usage = { model: 'openai:gpt-5.4-mini', inputTokens: 120, outputTokens: 30 }

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    runTask.mockReset()
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('currentAiActor [TC-AIMV-03]', () => {
    it('is null outside an actor scope', () => {
        expect(currentAiActor()).toBeNull()
    })

    it('is the scoped actor inside runWithAiActor when the platform is configured', async () => {
        const seen = await runWithAiActor(ACTOR, async () => currentAiActor())

        expect(seen).toBe(ACTOR)
    })

    it('is null inside a scope when the platform is not configured', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const seen = await runWithAiActor(ACTOR, async () => currentAiActor())

        expect(seen).toBeNull()
    })

    it('does not leak the actor out of the scope', async () => {
        await runWithAiActor(ACTOR, async () => undefined)

        expect(currentAiActor()).toBeNull()
    })
})

describe('bindAiActor [TC-AIMV-03]', () => {
    it('carries the actor into a callback that runs later, outside the scope', async () => {
        const later = await runWithAiActor(ACTOR, async () => bindAiActor(() => currentAiActor()))

        expect(currentAiActor()).toBeNull()
        expect(later()).toBe(ACTOR)
    })

    it('returns the task unchanged when no actor is in scope', () => {
        const task = () => 'value'

        expect(bindAiActor(task)).toBe(task)
    })
})

describe('enterAiActorScope [TC-AIMV-03]', () => {
    it('makes the actor available to the rest of the calling async work', async () => {
        const seen = await runWithAiActor(OTHER, async () => {
            enterAiActorScope(ACTOR)
            await Promise.resolve()
            return currentAiActor()
        })

        expect(seen).toBe(ACTOR)
    })
})

describe('completeComposed [TC-AIMV-03]', () => {
    it('throws AiUnavailableError without an actor and makes no platform call', async () => {
        await expect(completeComposed('sitegen.site-plan', { user: 'Plan the site' })).rejects.toBeInstanceOf(AiUnavailableError)
        expect(runTask).not.toHaveBeenCalled()
    })

    it('sends the composed system and user text with sampling and returns a JSON object as content', async () => {
        runTask.mockResolvedValue({ taskId: 'sitegen.personalize', output: { heroHeadline: 'Kopi' }, usage })

        const completion = await runWithAiActor(ACTOR, () => completeComposed('sitegen.personalize', {
            system: 'Rules',
            user: 'Brief',
            temperature: 0.8,
            maxOutputTokens: 300,
        }))

        expect(runTask).toHaveBeenCalledWith('sitegen.personalize', { system: 'Rules', user: 'Brief', temperature: 0.8, maxOutputTokens: 300 }, { signal: undefined })
        expect(completion).toEqual({ content: '{"heroHeadline":"Kopi"}', model: 'openai:gpt-5.4-mini', inputTokens: 120, outputTokens: 30 })
    })

    it('omits sampling fields the caller did not set and defaults system to empty text', async () => {
        runTask.mockResolvedValue({ taskId: 'sitegen.site-plan', output: { pages: [] }, usage })

        await runWithAiActor(ACTOR, () => completeComposed('sitegen.site-plan', { user: 'Brief' }))

        expect(runTask.mock.calls[0]![1]).toEqual({ system: '', user: 'Brief' })
    })

    it('returns the text of a text step as plain content, not as JSON', async () => {
        runTask.mockResolvedValue({ taskId: 'i18n.translate-image-terms', output: { text: 'kopi, teh tarik' }, usage })

        const completion = await runWithAiActor(ACTOR, () => completeComposed('i18n.translate-image-terms', { user: 'coffee, tea' }))

        expect(completion.content).toBe('kopi, teh tarik')
    })

    it('forwards the caller signal to the platform call', async () => {
        runTask.mockResolvedValue({ taskId: 'sitegen.page-blocks', output: { pages: [] }, usage })
        const controller = new AbortController()

        await runWithAiActor(ACTOR, () => completeComposed('sitegen.page-blocks', { user: 'Brief' }, { signal: controller.signal }))

        expect(runTask.mock.calls[0]![2]).toEqual({ signal: controller.signal })
    })
})
