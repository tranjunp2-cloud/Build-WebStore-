/**
 * Unit Tests: AI URL Extraction — prompt building, response parsing, Zod validation
 * TC-IDs from: docs/testcases/url-to-website.md
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { buildExtractionPrompt } from '@/lib/ai/url-extraction-prompt'
import { extractionResultSchema } from '@/lib/validations/ai'

// ── Prompt Building ──────────────────────────────────────────────────────

describe('buildExtractionPrompt', () => {
    it('returns system and user prompts', () => {
        const input = '--- META ---\nTitle: Test\n\n--- CONTENT ---\nSome content here'
        const { system, user } = buildExtractionPrompt(input)

        expect(system).toContain('business information')
        expect(system).toContain('businessName')
        expect(system).toContain('industry')
        expect(system.toLowerCase()).toContain('json')
        expect(user).toContain(input)
    })

    it('system prompt includes industry enum values', () => {
        const { system } = buildExtractionPrompt('test')

        expect(system).toContain('business')
        expect(system).toContain('ecommerce')
        expect(system).toContain('restaurant')
        expect(system).toContain('tech')
        expect(system).toContain('health')
    })

    it('system prompt includes suggestedTheme fields', () => {
        const { system } = buildExtractionPrompt('test')

        expect(system).toContain('primaryColor')
        expect(system).toContain('secondaryColor')
    })
})

// ── Zod Validation ───────────────────────────────────────────────────────

describe('extractionResultSchema', () => {
    // TC-EXT-01: Valid scraped content → returns BusinessInfo fields
    it('TC-EXT-01: parses valid extraction result', () => {
        const input = {
            businessName: 'Kedai Kopi ABC',
            industry: 'restaurant',
            shortDescription: 'Best coffee in KL',
            products: 'Kopi, Teh Tarik, Nasi Lemak',
            suggestedTheme: {
                primaryColor: '#8B4513',
                secondaryColor: '#D2691E',
                siteType: 'restaurant',
            },
            detectedLanguage: 'ms',
            confidence: 'high',
        }

        const result = extractionResultSchema.parse(input)

        expect(result.businessName).toBe('Kedai Kopi ABC')
        expect(result.industry).toBe('restaurant')
        expect(result.detectedLanguage).toBe('ms')
        expect(result.confidence).toBe('high')
        expect(result.suggestedTheme?.primaryColor).toBe('#8B4513')
    })

    // TC-EXT-02: Empty content → returns defaults with low confidence
    it('TC-EXT-02: defaults missing fields to empty strings', () => {
        const result = extractionResultSchema.parse({})

        expect(result.businessName).toBe('')
        expect(result.industry).toBe('')
        expect(result.shortDescription).toBe('')
        expect(result.products).toBe('')
        expect(result.detectedLanguage).toBe('en')
        expect(result.confidence).toBe('medium')
    })

    // TC-EXT-03: Malay content → detectedLanguage = 'ms'
    it('TC-EXT-03: accepts ms language', () => {
        const result = extractionResultSchema.parse({
            detectedLanguage: 'ms',
        })
        expect(result.detectedLanguage).toBe('ms')
    })

    // TC-EXT-04: English content → detectedLanguage = 'en'
    it('TC-EXT-04: accepts en language', () => {
        const result = extractionResultSchema.parse({
            detectedLanguage: 'en',
        })
        expect(result.detectedLanguage).toBe('en')
    })

    // TC-EXT-05: AI returns invalid JSON → Zod fallback to defaults
    it('TC-EXT-05: handles partial/malformed data with defaults', () => {
        const result = extractionResultSchema.parse({
            businessName: 'Test',
            // missing all other fields
        })

        expect(result.businessName).toBe('Test')
        expect(result.industry).toBe('')
        expect(result.shortDescription).toBe('')
        expect(result.products).toBe('')
        expect(result.confidence).toBe('medium')
    })

    it('rejects invalid language enum', () => {
        // Invalid language should fail Zod validation
        expect(() =>
            extractionResultSchema.parse({
                detectedLanguage: 'zh', // not in enum
            }),
        ).toThrow()
    })

    it('accepts optional suggestedTheme', () => {
        const result = extractionResultSchema.parse({
            businessName: 'Test',
            // no suggestedTheme
        })
        expect(result.suggestedTheme).toBeUndefined()
    })

    it('accepts suggestedTheme with partial fields', () => {
        const result = extractionResultSchema.parse({
            suggestedTheme: {
                primaryColor: '#FF0000',
                // no secondaryColor, no siteType
            },
        })
        expect(result.suggestedTheme?.primaryColor).toBe('#FF0000')
        expect(result.suggestedTheme?.secondaryColor).toBeUndefined()
    })
})

// ── Schema: generateSiteSchema with businessUrl ──────────────────────────

describe('generateSiteSchema with businessUrl', () => {
    it('accepts businessUrl and source fields', async () => {
        const { generateSiteSchema } = await import('@/lib/validations/ai')

        const result = generateSiteSchema.parse({
            businessInfo: {
                businessName: 'Test',
                industry: 'tech',
                products: 'SaaS tools',
                shortDescription: 'A tech company',
                businessUrl: 'https://example.com',
                source: 'url',
            },
        })

        expect(result.businessInfo.businessUrl).toBe('https://example.com')
        expect(result.businessInfo.source).toBe('url')
    })

    it('businessUrl and source are optional (backward compatible)', async () => {
        const { generateSiteSchema } = await import('@/lib/validations/ai')

        const result = generateSiteSchema.parse({
            businessInfo: {
                businessName: 'Test',
                industry: 'tech',
                products: 'SaaS tools',
                shortDescription: 'A tech company',
            },
        })

        expect(result.businessInfo.businessUrl).toBeUndefined()
        expect(result.businessInfo.source).toBeUndefined()
    })
})

// ── Schema: extractFromUrlSchema ─────────────────────────────────────────

describe('extractFromUrlSchema', () => {
    it('accepts valid URL', async () => {
        const { extractFromUrlSchema } = await import('@/lib/validations/ai')

        const result = extractFromUrlSchema.parse({ url: 'https://example.com' })
        expect(result.url).toBe('https://example.com')
    })

    it('rejects invalid URL', async () => {
        const { extractFromUrlSchema } = await import('@/lib/validations/ai')

        expect(() => extractFromUrlSchema.parse({ url: 'not-a-url' })).toThrow()
    })

    it('rejects URL > 2048 chars', async () => {
        const { extractFromUrlSchema } = await import('@/lib/validations/ai')

        const longUrl = 'https://example.com/' + 'a'.repeat(2040)
        expect(() => extractFromUrlSchema.parse({ url: longUrl })).toThrow()
    })
})
