import { describe, it, expect, vi } from 'vitest'

// Mock blockRegistry before import
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [
            {
                type: 'hero',
                name: 'Hero Section',
                description: 'A hero banner with headline',
                variants: ['centered', 'split'],
                editableFields: ['headline', 'subheadline', 'ctaButtons'],
            },
            {
                type: 'navigation',
                name: 'Navigation Bar',
                description: 'Site navigation',
                variants: ['simple', 'mega'],
                editableFields: ['links', 'logoText'],
            },
        ],
    },
}))

import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/system-prompt'

// ─── TC-F01.08: AI system prompt generation ───────────────────────────
// ─── TC-F01.10: Language detection rules ──────────────────────────────

describe('buildSystemPrompt [TC-F01.08]', () => {
    it('returns a non-empty string', () => {
        const prompt = buildSystemPrompt()
        expect(typeof prompt).toBe('string')
        expect(prompt.length).toBeGreaterThan(100)
    })

    it('contains available block types from registry', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('hero')
        expect(prompt).toContain('navigation')
        expect(prompt).toContain('Hero Section')
    })

    it('contains block variants', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('centered')
        expect(prompt).toContain('split')
    })

    it('contains block count from registry', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('2 total')
    })

    it('contains language detection rules [TC-F01.10]', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('Bahasa Melayu')
        expect(prompt).toContain('Vietnamese')
        expect(prompt).toContain('English')
    })

    it('contains JSON output format specification', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('siteName')
        expect(prompt).toContain('blockType')
        expect(prompt).toContain('theme')
    })

    it('contains content quality rules', () => {
        const prompt = buildSystemPrompt()
        expect(prompt).toContain('Content Quality')
        expect(prompt).toContain('ACTUAL business name')
    })

    it('TC-GENPERF-W4-03: requires complete and unique service-card collections', () => {
        // Arrange, Act
        const prompt = buildSystemPrompt()

        // Assert
        expect(prompt).toContain('EXACTLY 4 items for variant "featured"')
        expect(prompt).toContain('EXACTLY 3 items for variants "grid" and "list"')
        expect(prompt).toContain('Never repeat the same service-card payload on multiple pages')
    })
})

describe('buildUserPrompt [TC-F01.08]', () => {
    const businessInfo = {
        businessName: 'Nasi Kandar Bestari',
        industry: 'Restaurant',
        products: 'Nasi kandar, roti canai, teh tarik',
        shortDescription: 'Famous nasi kandar stall in Penang',
    }

    it('includes businessName', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).toContain('Nasi Kandar Bestari')
    })

    it('includes industry', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).toContain('Restaurant')
    })

    it('includes products', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).toContain('Nasi kandar, roti canai, teh tarik')
    })

    it('includes shortDescription', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).toContain('Famous nasi kandar stall in Penang')
    })

    it('includes extraInstructions when provided', () => {
        const prompt = buildUserPrompt(businessInfo, 'Use red and gold colors')
        expect(prompt).toContain('Use red and gold colors')
    })

    it('does not include extra instructions line when not provided', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).not.toContain('Additional instructions')
    })

    it('auto-detect language by default', () => {
        const prompt = buildUserPrompt(businessInfo)
        expect(prompt).toContain('Auto-detect')
    })

    it('specifies English when language=en', () => {
        const prompt = buildUserPrompt(businessInfo, undefined, 'en')
        expect(prompt).toContain('English')
    })

    it('specifies Malay when language=ms', () => {
        const prompt = buildUserPrompt(businessInfo, undefined, 'ms')
        expect(prompt).toContain('Malay')
        expect(prompt).toContain('Bahasa Melayu')
    })

    it('specifies Vietnamese when language=vi', () => {
        const prompt = buildUserPrompt(businessInfo, undefined, 'vi')
        expect(prompt).toContain('Vietnamese')
    })
})
