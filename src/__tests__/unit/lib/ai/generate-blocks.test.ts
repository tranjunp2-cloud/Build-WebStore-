import { describe, it, expect } from 'vitest'
import { generateBlocks } from '@/lib/ai/generate-blocks'

// ─── TC-F01.08: Site generation output structure ──────────────────────
// ─── TC-F01.10: Business type/intent detection ───────────────────────

describe('generateBlocks — output structure [TC-F01.08]', () => {
    const result = generateBlocks('Create a website for My Cafe, a coffee shop in KL', 12345)

    it('returns siteName extracted from prompt', () => {
        expect(result.siteName).toBe('My Cafe')
    })

    it('returns siteType as a valid business type', () => {
        expect(['business', 'ecommerce', 'restaurant', 'portfolio', 'blog']).toContain(result.siteType)
    })

    it('returns 6-10 blocks (dynamic pool)', () => {
        expect(result.blocks.length).toBeGreaterThanOrEqual(6)
        expect(result.blocks.length).toBeLessThanOrEqual(10)
    })

    it('always has navigation first and footer last', () => {
        expect(result.blocks[0]!.blockType).toBe('navigation')
        expect(result.blocks[result.blocks.length - 1]!.blockType).toBe('footer')
    })

    it('always has hero as second block', () => {
        expect(result.blocks[1]!.blockType).toBe('hero')
    })

    it('always has contact as second-to-last', () => {
        expect(result.blocks[result.blocks.length - 2]!.blockType).toBe('contact')
    })

    it('returns theme with required fields', () => {
        expect(result.theme).toHaveProperty('primaryColor')
        expect(result.theme).toHaveProperty('secondaryColor')
        expect(result.theme).toHaveProperty('fontHeading')
        expect(result.theme).toHaveProperty('fontBody')
        expect(result.theme).toHaveProperty('colorMode')
        expect(['light', 'dark']).toContain(result.theme.colorMode)
    })

    it('returns seo with title and description', () => {
        expect(result.seo.title).toContain('My Cafe')
        expect(typeof result.seo.description).toBe('string')
        expect(result.seo.description.length).toBeGreaterThan(0)
    })
})

describe('generateBlocks — business type detection [TC-F01.10]', () => {
    it('detects restaurant type from food keywords', () => {
        const result = generateBlocks('Create a website for a restaurant called Nasi House')
        expect(result.siteType).toBe('restaurant')
    })

    it('detects restaurant from cafe keyword', () => {
        const result = generateBlocks('Build a site for a coffee cafe')
        expect(result.siteType).toBe('restaurant')
    })

    it('detects ecommerce from shop/store keywords', () => {
        const result = generateBlocks('Create an online store for fashion boutique')
        expect(result.siteType).toBe('ecommerce')
    })

    it('detects portfolio from freelance/designer keywords', () => {
        const result = generateBlocks('Build a portfolio website for a freelance designer')
        expect(result.siteType).toBe('portfolio')
    })

    it('detects blog from blog keyword', () => {
        const result = generateBlocks('Create a blog about technology')
        expect(result.siteType).toBe('blog')
    })

    it('defaults to business for general prompts', () => {
        const result = generateBlocks('Create a website for a consulting company')
        expect(result.siteType).toBe('business')
    })
})

describe('generateBlocks — theme palette [TC-F01.08]', () => {
    it('restaurant gets one of 3 restaurant palettes', () => {
        const result = generateBlocks('Create a restaurant website', 12345)
        expect(['#D97706', '#DC2626', '#059669']).toContain(result.theme.primaryColor)
    })

    it('ecommerce gets one of 3 ecommerce palettes', () => {
        const result = generateBlocks('Build an online store', 12345)
        expect(['#0EA5E9', '#8B5CF6', '#10B981']).toContain(result.theme.primaryColor)
    })

    it('theme has valid colorMode', () => {
        const result = generateBlocks('Create a portfolio for a photographer', 12345)
        expect(['light', 'dark']).toContain(result.theme.colorMode)
    })

    it('business gets one of 3 business palettes', () => {
        const result = generateBlocks('Create a consulting company website', 12345)
        expect(['#3B82F6', '#0F766E', '#1E293B']).toContain(result.theme.primaryColor)
    })

    it('same seed produces same theme (reproducibility)', () => {
        const r1 = generateBlocks('Create a restaurant website', 42)
        const r2 = generateBlocks('Create a restaurant website', 42)
        expect(r1.theme).toEqual(r2.theme)
    })

    it('different seeds produce potentially different themes', () => {
        const results = new Set<string>()
        for (let seed = 0; seed < 100; seed++) {
            const r = generateBlocks('Create a restaurant website', seed * 9973)
            results.add(r.theme.primaryColor)
        }
        expect(results.size).toBeGreaterThan(1)
    })
})

describe('generateBlocks — name extraction', () => {
    it('extracts name from "called X" pattern', () => {
        // Regex captures until end of line/comma — "Super Shop for a retail store"
        const result = generateBlocks('Create a website called Super Shop, a retail store')
        expect(result.siteName).toBe('Super Shop')
    })

    it('extracts name from quoted text', () => {
        const result = generateBlocks('Create a website for "Delicious Bites" restaurant')
        expect(result.siteName).toBe('Delicious Bites')
    })

    it('extracts capitalized words as name', () => {
        const result = generateBlocks('MyCafe is a coffee shop in downtown KL')
        expect(result.siteName).toBe('MyCafe')
    })

    it('defaults to "My Website" when no name pattern found', () => {
        // All lowercase, no quotes, no "called" → regex finds "for X" pattern
        // Use prompt with no name patterns at all
        const result = generateBlocks('build something nice')
        expect(result.siteName).toBe('My Website')
    })
})

describe('generateBlocks — contact email normalization', () => {
    it('generates normalized email from business name', () => {
        const result = generateBlocks('Create a website called "My Cafe Shop"')
        const contactBlock = result.blocks.find(b => b.blockType === 'contact')
        expect(contactBlock?.email).toMatch(/^hello@[a-z0-9]+\.com$/)
    })
})

describe('generateBlocks — navigation block', () => {
    it('has logoText matching siteName', () => {
        const result = generateBlocks('Create a website for "TestBiz" agency')
        const nav = result.blocks.find(b => b.blockType === 'navigation')
        expect(nav?.logoText).toBe(result.siteName)
    })

    it('has links array with Home, About, Services, Contact', () => {
        const result = generateBlocks('Create a website for a company')
        const nav = result.blocks.find(b => b.blockType === 'navigation')
        const labels = (nav?.links as Array<{ label: string }>).map(l => l.label)
        expect(labels).toEqual(['Home', 'About', 'Services', 'Contact'])
    })
})

describe('generateBlocks — footer block', () => {
    it('has copyright with current year', () => {
        const result = generateBlocks('Create a website for a company')
        const footer = result.blocks.find(b => b.blockType === 'footer')
        const currentYear = new Date().getFullYear().toString()
        expect(footer?.copyrightText).toContain(currentYear)
    })

    it('has copyright with site name', () => {
        const result = generateBlocks('Create a website called "TestBrand"')
        const footer = result.blocks.find(b => b.blockType === 'footer')
        expect(footer?.copyrightText).toContain('TestBrand')
    })
})
