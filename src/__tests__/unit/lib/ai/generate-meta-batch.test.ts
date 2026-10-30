/**
 * Unit Tests: generateAutoSEOMetaBatch / pickValidBatchMeta — one seo.generate-meta-batch call
 * for a chunk of pages/products, with the answer validated against what was sent.
 * TC-IDs: TC-F37-04-43
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AiClientError, SEO_META_BATCH_CONTEXT_MAX_CHARS } from '@ech/ai-contracts'
import type { AgentActor } from '@/lib/ai-platform/context'

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

import { generateAutoSEOMetaBatch, pickValidBatchMeta } from '@/lib/ai/generate-meta-batch'

const ACTOR = {
    user: { id: 7, email: 'owner@shop.my' },
    tenantId: '1',
    organizationId: 'org_1',
    role: 'owner',
} as unknown as AgentActor
const CAPTURE = { id: 'cap-1' }

const sent = [{ id: '1' }, { id: '2' }, { id: '3' }]
const entry = (id: string, metaTitle = 'Title', metaDescription = 'Description') => ({ id, metaTitle, metaDescription })

describe('pickValidBatchMeta [TC-F37-04-43]', () => {
    it('keeps ids we sent, trimmed and capped to 60 / 160 characters', () => {
        const valid = pickValidBatchMeta(sent, [entry('1', `  ${'T'.repeat(80)}  `, 'D'.repeat(200)), entry('2', ' Short ', ' Desc ')])

        expect(valid.get('1')).toEqual({ title: 'T'.repeat(60), description: 'D'.repeat(160) })
        expect(valid.get('2')).toEqual({ title: 'Short', description: 'Desc' })
        expect(valid.has('3')).toBe(false)
    })

    it('drops ids we never sent, empty or blank strings, and repeated ids (first answer wins)', () => {
        const valid = pickValidBatchMeta(sent, [
            entry('99'),
            entry('1', '', 'Description'),
            entry('2', 'Title', '   '),
            entry('3', 'First', 'First description'),
            entry('3', 'Second', 'Second description'),
        ])

        expect([...valid.keys()]).toEqual(['3'])
        expect(valid.get('3')).toEqual({ title: 'First', description: 'First description' })
    })
})

describe('generateAutoSEOMetaBatch [TC-F37-04-43]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRunTask.mockReset()
        mockGetAiTaskClient.mockReturnValue({ runTask: mockRunTask })
        mockStartCapture.mockResolvedValue(CAPTURE)
        mockFinishCapture.mockResolvedValue(undefined)
    })

    it('sends one seo.generate-meta-batch task with every item, site name and capped keywords/context', async () => {
        mockRunTask.mockResolvedValue({ output: { items: [entry('1'), entry('2')] } })
        const keywords = Array.from({ length: 40 }, (_, i) => `kw-${i}`)

        const result = await generateAutoSEOMetaBatch(
            [
                { id: '1', type: 'page', itemName: 'About', context: 'c'.repeat(SEO_META_BATCH_CONTEXT_MAX_CHARS + 50) },
                { id: '2', type: 'product', itemName: 'Kopi' },
            ],
            'My Store',
            ACTOR,
            { keywords },
        )

        expect(mockRunTask).toHaveBeenCalledTimes(1)
        const [taskId, input, init] = mockRunTask.mock.calls[0] as [string, { siteName: string; keywords: string[]; items: Array<{ id: string; type: string; context?: string }> }, { signal: AbortSignal }]
        expect(taskId).toBe('seo.generate-meta-batch')
        expect(input.siteName).toBe('My Store')
        expect(input.keywords).toHaveLength(30)
        expect(input.items.map((item) => [item.id, item.type])).toEqual([['1', 'page'], ['2', 'product']])
        expect(input.items[0].context).toHaveLength(SEO_META_BATCH_CONTEXT_MAX_CHARS)
        expect(init.signal).toBeInstanceOf(AbortSignal)
        expect([...result.keys()]).toEqual(['1', '2'])
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, expect.objectContaining({ status: 'success', outputSnapshot: expect.objectContaining({ requested: 2, valid: 2 }) }))
    })

    it('returns only the valid answers when the model skips or garbles some items', async () => {
        mockRunTask.mockResolvedValue({ output: { items: [entry('1'), entry('zzz'), entry('3', '', '')] } })

        const result = await generateAutoSEOMetaBatch([{ id: '1', type: 'page', itemName: 'A' }, { id: '2', type: 'page', itemName: 'B' }, { id: '3', type: 'page', itemName: 'C' }], 'Shop', ACTOR)

        expect([...result.keys()]).toEqual(['1'])
    })

    it('throws with the platform error as cause so the caller can classify it (busy, timeout...)', async () => {
        const busy = new AiClientError('The AI is busy right now. Try again in a minute.', 429, 'provider_rate_limited')
        mockRunTask.mockRejectedValue(busy)

        const error = await generateAutoSEOMetaBatch([{ id: '1', type: 'page', itemName: 'A' }], 'Shop', ACTOR).catch((e: unknown) => e)

        expect((error as Error).cause).toBe(busy)
        expect(mockFinishCapture).toHaveBeenCalledWith(CAPTURE, expect.objectContaining({ status: 'failed' }))
    })

    it('rejects more than 20 items, aborts early on a closed signal, and skips an empty list', async () => {
        const many = Array.from({ length: 21 }, (_, i) => ({ id: String(i), type: 'page' as const, itemName: `P${i}` }))
        const controller = new AbortController()
        controller.abort()

        await expect(generateAutoSEOMetaBatch(many, 'Shop', ACTOR)).rejects.toThrow(RangeError)
        await expect(generateAutoSEOMetaBatch(many.slice(0, 1), 'Shop', ACTOR, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
        expect((await generateAutoSEOMetaBatch([], 'Shop', ACTOR)).size).toBe(0)
        expect(mockRunTask).not.toHaveBeenCalled()
        expect(mockStartCapture).not.toHaveBeenCalled()
    })
})
