/**
 * Unit Tests: extract-image-keywords
 * TC-IDs: TC-F38-RAW-18, TC-F38-RAW-19, TC-F38-RAW-20
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F38-image-provider-multi-source.md
 * GH-1185: LLM-derived keywords for per-site Pixabay image pool
 *
 * The model call is the AI platform task `sitegen.image-keywords` (composed prompt via
 * completeComposed). The platform client is faked; the actor scope is real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiClientError } from '@ech/ai-contracts'
import { extractImageKeywords, mergeKeywords } from '@/lib/ai/extract-image-keywords'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

const runTask = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask }) }))

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const inScope = <T>(run: () => Promise<T>) => runWithAiActor(ACTOR, run)
const answer = (output: unknown) => ({ taskId: 'sitegen.image-keywords', output, usage: { model: 'test', inputTokens: 10, outputTokens: 5 } })
const BUSINESS = { businessName: 'Kedai Phở', industry: 'restaurant', products: 'phở bò, gỏi cuốn' }

describe('extract-image-keywords', () => {
    beforeEach(() => {
        vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
        runTask.mockReset()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    describe('TC-F38-RAW-18: extractImageKeywords returns keywords', () => {
        it('extracts 2-4 keywords from business info via the sitegen.image-keywords task', async () => {
            runTask.mockResolvedValue(answer({ keywords: ['phở bò', 'gỏi cuốn', 'cơm tấm'] }))

            const result = await inScope(() => extractImageKeywords(BUSINESS))

            expect(result).toEqual(['phở bò', 'gỏi cuốn', 'cơm tấm'])
            expect(runTask).toHaveBeenCalledWith(
                'sitegen.image-keywords',
                expect.objectContaining({
                    temperature: 0.4,
                    maxOutputTokens: 120,
                    user: expect.stringContaining('Business name: Kedai Phở'),
                }),
                expect.anything(),
            )
        })

        it('caps extracted keywords at 4 items and 2 words each even if the model returns more', async () => {
            runTask.mockResolvedValue(answer({ keywords: ['phở bò nướng hành', 'gỏi', 'cơm', 'bánh', 'chè'] }))

            const result = await inScope(() => extractImageKeywords(BUSINESS))

            expect(result).toEqual(['phở bò', 'gỏi', 'cơm', 'bánh'])
        })
    })

    describe('TC-F38-RAW-19: graceful fallback on error', () => {
        it('returns [] without any AI actor in scope, and makes no platform call', async () => {
            const result = await extractImageKeywords(BUSINESS)

            expect(result).toEqual([])
            expect(runTask).not.toHaveBeenCalled()
        })

        it('returns [] when the platform times out or is down', async () => {
            runTask.mockRejectedValue(new AiClientError('The AI took too long to answer.', 504))

            expect(await inScope(() => extractImageKeywords(BUSINESS))).toEqual([])
        })

        it('returns [] when the answer has no keywords field', async () => {
            runTask.mockResolvedValue(answer({}))

            expect(await inScope(() => extractImageKeywords(BUSINESS))).toEqual([])
        })

        it('returns [] when keywords is not an array', async () => {
            runTask.mockResolvedValue(answer({ keywords: 'phở bò' }))

            expect(await inScope(() => extractImageKeywords(BUSINESS))).toEqual([])
        })

        it('returns [] when all business inputs are empty, without calling the platform', async () => {
            const result = await inScope(() => extractImageKeywords({ businessName: ' ', products: '' }))

            expect(result).toEqual([])
            expect(runTask).not.toHaveBeenCalled()
        })
    })

    describe('TC-F38-RAW-20: mergeKeywords order, dedup, cap', () => {
        it('merges with base products first, case-insensitive dedup, capped 3', () => {
            // Arrange: base products + extracted keywords (same phrase in different case)
            const base = ['phở bò', 'gỏi cuốn']
            const extra = ['PHỞ BÒ', 'cơm', 'bánh']

            // Act
            const result = mergeKeywords(base, extra, 3)

            // Assert: base first, case-insensitive dedup (PHỞ BÒ == phở bò), cap 3
            expect(result).toEqual(['phở bò', 'gỏi cuốn', 'cơm'])
            expect(result.length).toBe(3)
        })

        it('preserves case of first occurrence (base wins)', () => {
            // Arrange
            const base = ['Phở Bò']
            const extra = ['phở bò', 'cơm']

            // Act
            const result = mergeKeywords(base, extra)

            // Assert: first "Phở Bò" kept with its case
            expect(result[0]).toBe('Phở Bò')
            expect(result).toEqual(['Phở Bò', 'cơm'])
        })

        it('fills with extracted when base empty', () => {
            // Arrange
            const base: string[] = []
            const extra = ['phở', 'gỏi', 'cơm']

            // Act
            const result = mergeKeywords(base, extra, 3)

            // Assert
            expect(result).toEqual(['phở', 'gỏi', 'cơm'])
        })

        it('trims whitespace from terms', () => {
            // Arrange
            const base = ['  phở bò  ', 'gỏi']
            const extra = ['  cơm  ']

            // Act
            const result = mergeKeywords(base, extra)

            // Assert
            expect(result).toEqual(['phở bò', 'gỏi', 'cơm'])
        })

        it('skips empty/whitespace-only terms', () => {
            // Arrange
            const base = ['phở', '', '   ', 'gỏi']
            const extra = ['cơm']

            // Act
            const result = mergeKeywords(base, extra)

            // Assert
            expect(result).toEqual(['phở', 'gỏi', 'cơm'])
        })

        it('respects custom cap parameter', () => {
            // Arrange
            const base = ['a', 'b']
            const extra = ['c', 'd', 'e']

            // Act
            const result = mergeKeywords(base, extra, 2)

            // Assert
            expect(result).toEqual(['a', 'b'])
        })

        it('handles single-item cap (edge case)', () => {
            // Arrange
            const base = ['a', 'b']
            const extra = ['c']

            // Act
            const result = mergeKeywords(base, extra, 1)

            // Assert
            expect(result).toEqual(['a'])
        })
    })
})
