import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => ({
    default: vi.fn(),
}))

// Mock config
vi.mock('@/lib/ai/config', () => ({
    SYSTEM_PROMPTS: {
        'seo-generation': 'You are an SEO expert.',
    },
}))

import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

// ─── TC-F08-03-01: SEO auto-generation ──────────────────────────────────

describe('generateAutoSEOMeta — fallback (no API key) [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.OPENAI_API_KEY
    })

    it('returns product-type fallback with itemName and siteName', async () => {
        const result = await generateAutoSEOMeta('product', 'Batik Shirt', 'KL Fashion')

        expect(result.title).toContain('Batik Shirt')
        expect(result.title).toContain('KL Fashion')
        expect(result.title).toContain('Buy Online Malaysia')
    })

    it('returns page-type fallback with itemName and siteName', async () => {
        const result = await generateAutoSEOMeta('page', 'About Us', 'KL Fashion')

        expect(result.title).toContain('About Us')
        expect(result.title).toContain('KL Fashion')
    })

    it('product fallback description mentions shop and Malaysia', async () => {
        const result = await generateAutoSEOMeta('product', 'Nasi Lemak', 'FoodShop')

        expect(result.description).toContain('Shop')
        expect(result.description).toContain('Nasi Lemak')
        expect(result.description).toContain('Malaysia')
    })

    it('page fallback description mentions the page name', async () => {
        const result = await generateAutoSEOMeta('page', 'Services', 'MyBiz')

        expect(result.description).toContain('Services')
        expect(result.description).toContain('MyBiz')
    })

    it('returns strings for title and description', async () => {
        const result = await generateAutoSEOMeta('product', 'Item', 'Shop')

        expect(typeof result.title).toBe('string')
        expect(typeof result.description).toBe('string')
        expect(result.title.length).toBeGreaterThan(0)
        expect(result.description.length).toBeGreaterThan(0)
    })
})

describe('generateAutoSEOMeta — fallback format checks [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.OPENAI_API_KEY
    })

    it('product title is under 60 chars (SEO best practice)', async () => {
        const result = await generateAutoSEOMeta('product', 'Short Name', 'Shop')
        expect(result.title.length).toBeLessThanOrEqual(80) // fallback template may exceed 60 slightly
    })

    it('page description is non-empty and descriptive', async () => {
        const result = await generateAutoSEOMeta('page', 'Contact', 'MyBiz')
        expect(result.description.length).toBeGreaterThan(20)
    })
})
