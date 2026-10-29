/**
 * Unit Tests — Keyword-Aware SEO Generation (AC-15)
 * Coverage Map (QA Doc Traceability):
 *   TC-F05.13-01 → tracked keywords are sent to seo.generate-meta when provided
 *   TC-F05.13-02 → no keywords → an empty keyword list (no "Target Keywords" line is composed here)
 *   TC-F05.13-03 → without an AI actor the template meta is returned (no OpenAI key any more)
 * The keyword wording of the prompt is ai-platform's (apps/ai-platform seo-blog-tasks.spec.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'

const runTask = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask }) }))
vi.mock('@/lib/ai/capture-generation', () => ({
    startCapture: vi.fn(async () => null),
    finishCapture: vi.fn(async () => undefined),
}))

import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as unknown as AgentActor

describe('generateAutoSEOMeta — keyword integration [TC-F05.13-01..03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        runTask.mockReset()
        vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    })

    it('[TC-F05.13-01] sends the tracked keywords and context to seo.generate-meta', async () => {
        runTask.mockResolvedValue({
            output: {
                metaTitle: 'Best Shoes | ShoeStore Malaysia',
                metaDescription: 'Buy the best shoes online at ShoeStore Malaysia.',
            },
        })

        await generateAutoSEOMeta('product', 'Running Shoes', 'ShoeStore', 'Great running shoes', ['best shoes', 'running shoes malaysia'], undefined, ACTOR)

        expect(runTask).toHaveBeenCalledWith(
            'seo.generate-meta',
            expect.objectContaining({
                type: 'product',
                itemName: 'Running Shoes',
                siteName: 'ShoeStore',
                context: 'Great running shoes',
                keywords: ['best shoes', 'running shoes malaysia'],
            }),
            expect.anything(),
        )
    })

    it('[TC-F05.13-02] sends an empty keyword list when none are tracked', async () => {
        runTask.mockResolvedValue({ output: { metaTitle: 'About Us | MyBiz Malaysia', metaDescription: 'Learn about MyBiz.' } })

        await generateAutoSEOMeta('page', 'About Us', 'MyBiz', 'Our company info', undefined, undefined, ACTOR)

        expect(runTask.mock.calls[0]![1]).toMatchObject({ keywords: [] })
    })

    it('[TC-F05.13-03] returns the template meta when no AI actor is in scope', async () => {
        const result = await generateAutoSEOMeta('page', 'Contact', 'MyBiz')

        expect(result.title).toContain('Contact')
        expect(result.title).toContain('MyBiz')
        expect(result.description).toBeTruthy()
        expect(runTask).not.toHaveBeenCalled()
    })
})
