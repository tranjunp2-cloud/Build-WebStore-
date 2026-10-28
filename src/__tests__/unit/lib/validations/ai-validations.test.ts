import { describe, it, expect } from 'vitest'
import {
    generateSiteSchema,
    rewriteTextSchema,
    applyTemplateSchema,
} from '@/lib/validations/ai'

// ─── TC-F01.04: Form field validation ─────────────────────────────────
// ─── TC-F01.05: Required fields enforcement ───────────────────────────
// ─── TC-F01.07: XSS/injection in text inputs ─────────────────────────

describe('generateSiteSchema [TC-F01.04, TC-F01.05]', () => {
    const validInput = {
        businessInfo: {
            businessName: 'My Cafe',
            industry: 'Food & Beverage',
            products: 'Coffee, pastries',
            shortDescription: 'A cozy cafe in KL',
        },
    }

    it('accepts valid full input', () => {
        const result = generateSiteSchema.safeParse(validInput)
        expect(result.success).toBe(true)
    })

    it('accepts with optional extraInstructions', () => {
        const result = generateSiteSchema.safeParse({
            ...validInput,
            extraInstructions: 'Use warm colors',
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid language enum values (en/ms/vi/auto)', () => {
        for (const lang of ['en', 'ms', 'vi', 'auto']) {
            const result = generateSiteSchema.safeParse({ ...validInput, language: lang })
            expect(result.success).toBe(true)
        }
    })

    it('rejects invalid language value', () => {
        const result = generateSiteSchema.safeParse({ ...validInput, language: 'fr' })
        expect(result.success).toBe(false)
    })

    it('rejects missing businessName [TC-F01.05]', () => {
        const input = {
            businessInfo: { ...validInput.businessInfo, businessName: '' },
        }
        const result = generateSiteSchema.safeParse(input)
        expect(result.success).toBe(false)
    })

    it('rejects missing industry [TC-F01.05]', () => {
        const input = {
            businessInfo: { ...validInput.businessInfo, industry: '' },
        }
        const result = generateSiteSchema.safeParse(input)
        expect(result.success).toBe(false)
    })

    it('rejects missing products [TC-F01.05]', () => {
        const input = {
            businessInfo: { ...validInput.businessInfo, products: '' },
        }
        const result = generateSiteSchema.safeParse(input)
        expect(result.success).toBe(false)
    })

    it('rejects missing shortDescription [TC-F01.05]', () => {
        const input = {
            businessInfo: { ...validInput.businessInfo, shortDescription: '' },
        }
        const result = generateSiteSchema.safeParse(input)
        expect(result.success).toBe(false)
    })

    it('rejects completely missing businessInfo', () => {
        const result = generateSiteSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

describe('rewriteTextSchema [TC-F01.04]', () => {
    it('accepts valid input with text and instruction', () => {
        const result = rewriteTextSchema.safeParse({
            text: 'Hello world',
            instruction: 'Make it formal',
        })
        expect(result.success).toBe(true)
    })

    it('accepts with optional context and language', () => {
        const result = rewriteTextSchema.safeParse({
            text: 'Hello',
            instruction: 'Translate',
            context: 'Website header',
            language: 'ms',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing text', () => {
        const result = rewriteTextSchema.safeParse({ instruction: 'Rewrite' })
        expect(result.success).toBe(false)
    })

    it('rejects missing instruction', () => {
        const result = rewriteTextSchema.safeParse({ text: 'Hello' })
        expect(result.success).toBe(false)
    })

    it('rejects empty text', () => {
        const result = rewriteTextSchema.safeParse({ text: '', instruction: 'Rewrite' })
        expect(result.success).toBe(false)
    })
})

describe('applyTemplateSchema [TC-F01.04]', () => {
    it('accepts valid templateId', () => {
        const result = applyTemplateSchema.safeParse({ templateId: 'cafe-modern' })
        expect(result.success).toBe(true)
    })

    it('accepts with optional siteId', () => {
        const result = applyTemplateSchema.safeParse({
            templateId: 'cafe-modern',
            siteId: 'site-123',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing templateId', () => {
        const result = applyTemplateSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects empty templateId', () => {
        const result = applyTemplateSchema.safeParse({ templateId: '' })
        expect(result.success).toBe(false)
    })
})
