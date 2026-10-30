/**
 * Unit Tests: generateAutoSEOMeta — no-actor template meta and ECH AI platform path
 * (file name kept from the OpenAI era; the in-process OpenAI path was removed in the
 * AI platform hard cutover, see docs/qa/F-ai-copilot.md §AISEC)
 * TC-IDs: TC-F08-03-01, TC-AISEC-03
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiClientError, SEO_CONTEXT_MAX_CHARS } from '@ech/ai-contracts'
import type { AgentActor } from '@/lib/ai-platform/context'

// ─── Mocks (top-level) ──────────────────────────────────────────────────────
const { mockRunTask, mockGetAiTaskClient, mockStartCapture, mockFinishCapture } = vi.hoisted(() => ({
    mockRunTask: vi.fn(),
    mockGetAiTaskClient: vi.fn(),
    mockStartCapture: vi.fn(),
    mockFinishCapture: vi.fn(),
}))

vi.mock('@/lib/ai-platform/task-client', () => ({
    getAiTaskClient: (...args: unknown[]) => mockGetAiTaskClient(...args),
}))

vi.mock('@/lib/ai/capture-generation', () => ({
    startCapture: (...args: unknown[]) => mockStartCapture(...args),
    finishCapture: (...args: unknown[]) => mockFinishCapture(...args),
}))

import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

const ACTOR = {
    user: { id: 7, email: 'owner@shop.my' },
    tenantId: '1',
    organizationId: 'org_1',
    role: 'owner',
} as unknown as AgentActor

const CAPTURE = { id: 'cap-1' }

// ─── No actor: template meta, no model call ────────────────────────────────

describe('generateAutoSEOMeta — no actor → template meta [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStartCapture.mockResolvedValue(CAPTURE)
        mockFinishCapture.mockResolvedValue(undefined)
    })

    it('returns product template meta with the item and site name', async () => {
        const result = await generateAutoSEOMeta('product', 'Batik Shirt', 'KL Fashion')

        expect(result).toEqual({
            title: 'Batik Shirt | KL Fashion | Buy Online Malaysia',
            description: 'Shop Batik Shirt at KL Fashion. High quality and best prices in Malaysia. Buy online today!',
        })
    })

    it('returns page template meta with the page and site name', async () => {
        const result = await generateAutoSEOMeta('page', 'About Us', 'KL Fashion')

        expect(result).toEqual({
            title: 'About Us | KL Fashion Online Malaysia',
            description: "Welcome to KL Fashion's About Us page. Discover our services and offerings in Malaysia.",
        })
    })

    it('treats an explicit null actor (seo-queue without a publisher) the same way [TC-AISEC-03]', async () => {
        const result = await generateAutoSEOMeta('page', 'Services', 'MyBiz', undefined, [], undefined, null)

        expect(result.title).toBe('Services | MyBiz Online Malaysia')
        expect(mockGetAiTaskClient).not.toHaveBeenCalled()
        expect(mockRunTask).not.toHaveBeenCalled()
    })

    it('records the template as a no-actor-fallback capture without touching the platform [TC-AISEC-03]', async () => {
        await generateAutoSEOMeta('product', 'Item', 'Shop')

        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, {
            status: 'success',
            outputSnapshot: {
                path: 'no-actor-fallback',
                title: 'Item | Shop | Buy Online Malaysia',
                description: 'Shop Item at Shop. High quality and best prices in Malaysia. Buy online today!',
            },
        })
        expect(mockGetAiTaskClient).not.toHaveBeenCalled()
    })

    it('rejects an already-aborted signal before doing any work', async () => {
        const controller = new AbortController()
        controller.abort()

        await expect(
            generateAutoSEOMeta('page', 'Contact', 'Biz', undefined, [], controller.signal),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(mockStartCapture).not.toHaveBeenCalled()
    })
})

// ─── Actor: seo.generate-meta on the ECH AI platform ───────────────────────

describe('generateAutoSEOMeta — ECH AI platform path [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRunTask.mockReset()
        mockGetAiTaskClient.mockReturnValue({ runTask: mockRunTask })
        mockStartCapture.mockResolvedValue(CAPTURE)
        mockFinishCapture.mockResolvedValue(undefined)
    })

    it('returns the title and description the platform task produced', async () => {
        mockRunTask.mockResolvedValue({
            output: {
                metaTitle: 'Batik Shirt | KL Fashion | Buy Online Malaysia',
                metaDescription: 'Shop premium Batik Shirt at KL Fashion. Authentic Malaysian batik with fast delivery across Malaysia.',
            },
        })

        const result = await generateAutoSEOMeta('product', 'Batik Shirt', 'KL Fashion', undefined, [], undefined, ACTOR)

        expect(result).toEqual({
            title: 'Batik Shirt | KL Fashion | Buy Online Malaysia',
            description: 'Shop premium Batik Shirt at KL Fashion. Authentic Malaysian batik with fast delivery across Malaysia.',
        })
        expect(mockGetAiTaskClient).toHaveBeenCalledWith(ACTOR)
        expect(mockRunTask).toHaveBeenCalledTimes(1)
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, expect.objectContaining({
            status: 'success',
            outputSnapshot: expect.objectContaining({ path: 'ai-platform' }),
        }))
    })

    it('sends the item, site name, page type, context and keywords to seo.generate-meta', async () => {
        mockRunTask.mockResolvedValue({ output: { metaTitle: 'Services | MyBiz Malaysia', metaDescription: 'Discover our services.' } })

        await generateAutoSEOMeta('page', 'Services', 'MyBiz', 'Traditional Malaysian coconut rice', ['nasi lemak', 'kl cafe'], undefined, ACTOR)

        expect(mockRunTask).toHaveBeenCalledWith(
            'seo.generate-meta',
            {
                type: 'page',
                itemName: 'Services',
                siteName: 'MyBiz',
                context: 'Traditional Malaysian coconut rice',
                keywords: ['nasi lemak', 'kl cafe'],
            },
            { signal: expect.any(AbortSignal) },
        )
    })

    it('caps the context and keyword list before sending them to the platform', async () => {
        mockRunTask.mockResolvedValue({ output: { metaTitle: 'T', metaDescription: 'D' } })
        const keywords = Array.from({ length: 40 }, (_, i) => `kw-${i}`)

        await generateAutoSEOMeta('product', 'Item', 'Shop', 'c'.repeat(SEO_CONTEXT_MAX_CHARS + 500), keywords, undefined, ACTOR)

        const input = mockRunTask.mock.calls[0]![1] as { context: string; keywords: string[] }
        expect(input.context.length).toBe(SEO_CONTEXT_MAX_CHARS)
        expect(input.keywords).toHaveLength(30)
    })

    it('truncates a long platform title to 60 characters and description to 160 [TC-F08-03-01]', async () => {
        mockRunTask.mockResolvedValue({ output: { metaTitle: 'A'.repeat(100), metaDescription: 'D'.repeat(200) } })

        const result = await generateAutoSEOMeta('page', 'About', 'MyBiz', undefined, [], undefined, ACTOR)

        expect(result.title).toHaveLength(60)
        expect(result.description).toHaveLength(160)
    })

    it('falls back to "itemName | siteName" when the platform returns an empty title', async () => {
        mockRunTask.mockResolvedValue({ output: { metaTitle: '', metaDescription: '' } })

        const result = await generateAutoSEOMeta('product', 'My Product', 'My Store', undefined, [], undefined, ACTOR)

        expect(result).toEqual({ title: 'My Product | My Store', description: '' })
    })

    it('falls back to the capped template when the workspace quota is reached [TC-F08-03-01]', async () => {
        mockRunTask.mockRejectedValue(new AiClientError("Your workspace reached today's AI limit.", 429))

        const result = await generateAutoSEOMeta('product', 'Item', 'Shop', undefined, [], undefined, ACTOR)

        expect(result).toEqual({
            title: 'Item | Shop | Buy Online Malaysia',
            description: 'Shop Item at Shop. High quality and best prices in Malaysia. Buy online today!',
        })
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, expect.objectContaining({
            status: 'success',
            outputSnapshot: expect.objectContaining({ path: 'rate-limit-fallback' }),
        }))
    })

    it('[TC-F37-04-54] a busy provider (provider_rate_limited) is thrown to the caller, not hidden behind the template', async () => {
        mockRunTask.mockRejectedValue(new AiClientError('The AI is busy right now. Try again in a minute.', 429, 'provider_rate_limited'))

        const error = await generateAutoSEOMeta('product', 'Item', 'Shop', undefined, [], undefined, ACTOR).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(Error)
        expect((error as Error).cause).toMatchObject({ status: 429, code: 'provider_rate_limited' })
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, expect.objectContaining({ status: 'failed' }))
    })

    it('throws and records a failed capture for non-quota platform errors [TC-F08-03-01]', async () => {
        mockRunTask.mockRejectedValue(new Error('Network connection timeout'))

        await expect(
            generateAutoSEOMeta('product', 'Item', 'Shop', undefined, [], undefined, ACTOR),
        ).rejects.toThrow('AI meta generation failed: Network connection timeout')
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, {
            status: 'failed',
            error: 'Network connection timeout',
        })
    })

    it('throws with the platform detail for a non-quota outage (AiClientError 503); callers must map it for users', async () => {
        mockRunTask.mockRejectedValue(new AiClientError('upstream 503 from provider x', 503))

        await expect(
            generateAutoSEOMeta('page', 'Contact', 'Biz', undefined, [], undefined, ACTOR),
        ).rejects.toThrow('AI meta generation failed: upstream 503 from provider x')
    })

    it('throws AbortError and records the capture as aborted when the caller aborts mid-call', async () => {
        const controller = new AbortController()
        mockRunTask.mockImplementation(async () => {
            controller.abort()
            throw new Error('The operation was aborted')
        })

        await expect(
            generateAutoSEOMeta('page', 'Contact', 'Biz', undefined, [], controller.signal, ACTOR),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, { status: 'failed', error: 'aborted' })
    })
})
