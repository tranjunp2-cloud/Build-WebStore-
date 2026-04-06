/**
 * Unit Tests: generateAutoSEOMeta — OpenAI success and error paths
 * TC-IDs: TC-F08-03-01
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock OpenAI before importing the module under test
const mockCreate = vi.fn()

vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    })),
}))

vi.mock('@/lib/ai/config', () => ({
    SYSTEM_PROMPTS: {
        'seo-generation': 'You are an SEO expert.',
    },
}))

import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

// ─── TC-F08-03-01: SEO meta — OpenAI success path ───────────────────────────

describe('generateAutoSEOMeta — OpenAI success path [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.OPENAI_API_KEY = 'test-key-123'
    })

    afterEach(() => {
        delete process.env.OPENAI_API_KEY
    })

    it('returns parsed title and description from OpenAI response', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'Batik Shirt | KL Fashion | Buy Online Malaysia',
                        metaDescription: 'Shop premium Batik Shirt at KL Fashion. Authentic Malaysian batik with fast delivery across Malaysia. Order now!',
                    }),
                },
            }],
        })

        // Act
        const result = await generateAutoSEOMeta('product', 'Batik Shirt', 'KL Fashion')

        // Assert
        expect(result.title).toBe('Batik Shirt | KL Fashion | Buy Online Malaysia')
        expect(result.description).toContain('Shop premium Batik Shirt')
        expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('truncates title to 60 characters [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'A'.repeat(100),
                        metaDescription: 'A valid description here.',
                    }),
                },
            }],
        })

        // Act
        const result = await generateAutoSEOMeta('product', 'Item', 'Shop')

        // Assert
        expect(result.title.length).toBeLessThanOrEqual(60)
    })

    it('truncates description to 160 characters [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'Short Title',
                        metaDescription: 'D'.repeat(200),
                    }),
                },
            }],
        })

        // Act
        const result = await generateAutoSEOMeta('page', 'About', 'MyBiz')

        // Assert
        expect(result.description.length).toBeLessThanOrEqual(160)
    })

    it('accepts "title" key as fallback for metaTitle [TC-F08-03-01]', async () => {
        // Arrange — OpenAI returns "title" instead of "metaTitle"
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        title: 'Services | MyBiz Malaysia',
                        description: 'Discover our wide range of professional services in Malaysia.',
                    }),
                },
            }],
        })

        // Act
        const result = await generateAutoSEOMeta('page', 'Services', 'MyBiz')

        // Assert
        expect(result.title).toBe('Services | MyBiz Malaysia')
        expect(result.description).toContain('professional services')
    })

    it('falls back to itemName|siteName when OpenAI returns empty title [TC-F08-03-01]', async () => {
        // Arrange — AI returns empty title fields
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: '',
                        metaDescription: '',
                    }),
                },
            }],
        })

        // Act
        const result = await generateAutoSEOMeta('product', 'My Product', 'My Store')

        // Assert — fallback is "itemName | siteName"
        expect(result.title).toContain('My Product')
    })

    it('includes context in product prompt when provided [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'Product Title',
                        metaDescription: 'Product description.',
                    }),
                },
            }],
        })

        // Act
        await generateAutoSEOMeta('product', 'Nasi Lemak', 'FoodShop', 'Traditional Malaysian coconut rice')

        // Assert — create was called (context was passed through)
        expect(mockCreate).toHaveBeenCalledOnce()
        const callArgs = mockCreate.mock.calls[0][0]
        const userContent = callArgs.messages[1].content
        expect(userContent).toContain('Traditional Malaysian coconut rice')
    })
})

// ─── TC-F08-03-01: SEO meta — OpenAI error path ─────────────────────────────

describe('generateAutoSEOMeta — OpenAI error path [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.OPENAI_API_KEY = 'test-key-123'
    })

    afterEach(() => {
        delete process.env.OPENAI_API_KEY
    })

    it('throws when OpenAI API call fails [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockRejectedValue(new Error('OpenAI rate limit exceeded'))

        // Act & Assert
        await expect(
            generateAutoSEOMeta('product', 'Item', 'Shop')
        ).rejects.toThrow('OpenAI meta generation failed')
    })

    it('throws when OpenAI returns empty content [TC-F08-03-01]', async () => {
        // Arrange — choices array with null content
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: null,
                },
            }],
        })

        // Act & Assert
        await expect(
            generateAutoSEOMeta('product', 'Item', 'Shop')
        ).rejects.toThrow('OpenAI meta generation failed')
    })

    it('includes original error message in thrown error [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockRejectedValue(new Error('Timeout exceeded'))

        // Act & Assert
        await expect(
            generateAutoSEOMeta('page', 'Contact', 'Biz')
        ).rejects.toThrow('Timeout exceeded')
    })

    it('uses page-type prompt when type is "page" [TC-F08-03-01]', async () => {
        // Arrange
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'About | MyBiz Malaysia',
                        metaDescription: 'Learn about MyBiz.',
                    }),
                },
            }],
        })

        // Act
        await generateAutoSEOMeta('page', 'About', 'MyBiz')

        // Assert — page prompt uses "Malaysia" keyword (not "Buy Online")
        const callArgs = mockCreate.mock.calls[0][0]
        const userContent = callArgs.messages[1].content
        expect(userContent).toContain('web page')
        expect(userContent).not.toContain('Buy Online Malaysia')
    })
})
