import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock payload
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: vi.fn().mockResolvedValue({ docs: [] }),
        create: vi.fn().mockResolvedValue({ id: 'job-1' }),
        update: vi.fn().mockResolvedValue({}),
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: vi.fn().mockResolvedValue({ title: 'SEO Title', description: 'SEO Desc' }),
}))

import { queueSEOAutoGeneration } from '@/lib/ai/seo-queue'

// ─── TC-F08-03-01: SEO auto-generation queue ─────────────────────────────

describe('queueSEOAutoGeneration [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('is a function', () => {
        expect(typeof queueSEOAutoGeneration).toBe('function')
    })

    it('does not throw when called with valid args', async () => {
        await expect(
            queueSEOAutoGeneration('products', '123', 'site-1', 'Product Name', 'Description')
        ).resolves.not.toThrow()
    })

    it('handles missing description gracefully', async () => {
        await expect(
            queueSEOAutoGeneration('products', '123', 'site-1', 'Product Name')
        ).resolves.not.toThrow()
    })
})
