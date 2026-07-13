/**
 * Unit Tests: extract-image-keywords
 * TC-IDs: TC-F38-RAW-18, TC-F38-RAW-19, TC-F38-RAW-20
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F38-image-provider-multi-source.md
 * GH-1185: LLM-derived keywords for per-site Pixabay image pool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractImageKeywords, mergeKeywords } from '@/lib/ai/extract-image-keywords'

// Mock OpenAI at top level
vi.mock('openai', () => ({
    default: vi.fn(),
}))

describe('extract-image-keywords', () => {
    beforeEach(() => {
        delete process.env.OPENAI_API_KEY
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('TC-F38-RAW-18: extractImageKeywords returns keywords', () => {
        it('extracts 2-4 keywords from business info via gpt-4.1-nano', async () => {
            // Arrange: mock OpenAI
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [
                                        {
                                            message: {
                                                content: JSON.stringify({
                                                    keywords: ['phở bò', 'gỏi cuốn', 'cơm tấm'],
                                                }),
                                            },
                                        },
                                    ],
                                }),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Nhà Hàng Phở',
                industry: 'F&B',
                shortDescription: 'Nhà hàng phở truyền thống',
                language: 'vi',
            })

            // Assert: returns keywords, trimmed, < 4 items
            expect(result).toEqual(['phở bò', 'gỏi cuốn', 'cơm tấm'])
            expect(result.length).toBeLessThanOrEqual(4)
            expect(result.every((k) => k.trim() === k)).toBe(true)
        })

        it('caps extracted keywords at 4 items even if LLM returns more', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [
                                        {
                                            message: {
                                                content: JSON.stringify({
                                                    keywords: [
                                                        'phở',
                                                        'gỏi',
                                                        'cơm',
                                                        'bánh',
                                                        'nước',
                                                    ],
                                                }),
                                            },
                                        },
                                    ],
                                }),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Nhà Hàng Phở',
            })

            // Assert
            expect(result.length).toBeLessThanOrEqual(4)
            expect(result).toEqual(['phở', 'gỏi', 'cơm', 'bánh'])
        })
    })

    describe('TC-F38-RAW-19: graceful fallback on error', () => {
        it('returns [] when OPENAI_API_KEY missing', async () => {
            // Arrange: no API key
            delete process.env.OPENAI_API_KEY

            // Act
            const result = await extractImageKeywords({
                businessName: 'Test Business',
            })

            // Assert
            expect(result).toEqual([])
        })

        it('returns [] on OpenAI timeout', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockRejectedValue(
                                    new Error('Request timeout after 10000ms'),
                                ),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Test',
            })

            // Assert
            expect(result).toEqual([])
            expect(console.warn).toHaveBeenCalled()
        })

        it('returns [] on malformed JSON from OpenAI', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [
                                        {
                                            message: {
                                                content: 'not valid json',
                                            },
                                        },
                                    ],
                                }),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Test',
            })

            // Assert
            expect(result).toEqual([])
        })

        it('returns [] when keywords field is missing from JSON', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [
                                        {
                                            message: {
                                                content: JSON.stringify({
                                                    result: 'phở',
                                                }),
                                            },
                                        },
                                    ],
                                }),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Test',
            })

            // Assert
            expect(result).toEqual([])
        })

        it('returns [] when keywords is not an array', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [
                                        {
                                            message: {
                                                content: JSON.stringify({
                                                    keywords: 'not an array',
                                                }),
                                            },
                                        },
                                    ],
                                }),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({
                businessName: 'Test',
            })

            // Assert
            expect(result).toEqual([])
        })

        it('returns [] when all business inputs empty/missing', async () => {
            // Arrange
            const OpenAI = await import('openai').then((m) => m.default)
            vi.mocked(OpenAI).mockImplementation(
                () =>
                    ({
                        chat: {
                            completions: {
                                create: vi.fn(),
                            },
                        },
                    }) as any,
            )
            process.env.OPENAI_API_KEY = 'test-key'

            // Act
            const result = await extractImageKeywords({})

            // Assert
            expect(result).toEqual([])
            // Should NOT call OpenAI since no content
            expect(vi.mocked(OpenAI).mock.results[0].value.chat.completions.create).not.toHaveBeenCalled()
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
