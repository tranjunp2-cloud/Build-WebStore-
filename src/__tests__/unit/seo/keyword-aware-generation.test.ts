/**
 * Unit Tests — Keyword-Aware SEO Generation (AC-15)
 * Coverage Map (QA Doc Traceability):
 *   TC-F05.13-01 → Keywords included in prompt when provided
 *   TC-F05.13-02 → Keywords omitted from prompt when empty/undefined
 *   TC-F05.13-03 → Fallback works without OpenAI API key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock OpenAI ─────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('openai', () => ({
    default: vi.fn(() => ({
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

describe('generateAutoSEOMeta — keyword integration [TC-F05.13-01..03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F05.13-01] includes keywords in prompt when provided', async () => {
        // Arrange
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'Best Shoes | ShoeStore Malaysia',
                        metaDescription: 'Buy the best shoes online at ShoeStore Malaysia.',
                    }),
                },
            }],
        })

        // Act
        await generateAutoSEOMeta('product', 'Running Shoes', 'ShoeStore', 'Great running shoes', ['best shoes', 'running shoes malaysia'])

        // Assert — verify the prompt sent to OpenAI contains keyword instructions
        const callArgs = mockCreate.mock.calls[0][0]
        const userMessage = callArgs.messages.find((m: any) => m.role === 'user')?.content
        expect(userMessage).toContain('Target Keywords: best shoes, running shoes malaysia')
        expect(userMessage).toContain('Keyword density must not exceed 2%')
    })

    it('[TC-F05.13-02] omits keyword line when no keywords provided', async () => {
        // Arrange
        process.env.OPENAI_API_KEY = 'test-key'
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        metaTitle: 'About Us | MyBiz Malaysia',
                        metaDescription: 'Learn about MyBiz.',
                    }),
                },
            }],
        })

        // Act
        await generateAutoSEOMeta('page', 'About Us', 'MyBiz', 'Our company info')

        // Assert
        const callArgs = mockCreate.mock.calls[0][0]
        const userMessage = callArgs.messages.find((m: any) => m.role === 'user')?.content
        expect(userMessage).not.toContain('Target Keywords:')
    })

    it('[TC-F05.13-03] returns fallback meta when no API key', async () => {
        // Arrange
        delete process.env.OPENAI_API_KEY

        // Act
        const result = await generateAutoSEOMeta('page', 'Contact', 'MyBiz')

        // Assert — fallback format
        expect(result.title).toContain('Contact')
        expect(result.title).toContain('MyBiz')
        expect(result.description).toBeTruthy()
    })
})
