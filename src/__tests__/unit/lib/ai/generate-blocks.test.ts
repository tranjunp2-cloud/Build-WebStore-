import { describe, it, expect } from 'vitest'
import { generateBlocks } from '@/lib/ai/generate-blocks'

// ─── TC-F01.08: Site generation output structure ──────────────────────
// ─── TC-F01.10: Business type/intent detection ───────────────────────

describe('generateBlocks — output structure [TC-F01.08]', () => {
    const result = generateBlocks('Create a website for My Cafe, a coffee shop in KL')

    it('returns siteName extracted from prompt', () => {
        expect(result.siteName).toBe('My Cafe')
    })

    it('returns siteType as a valid business type', () => {
        expect(['business', 'ecommerce', 'restaurant', 'portfolio', 'blog']).toContain(result.siteType)
    })

    it('returns exactly 7 blocks', () => {
        expect(result.blocks).toHaveLength(7)
    })

    it('has correct block types in order: navigation, hero, about, features, testimonials, contact, footer', () => {
        const blockTypes = result.blocks.map(b => b.blockType)
        expect(blockTypes).toEqual([
            'navigation', 'hero', 'about', 'features',
            'testimonials', 'contact', 'footer',
        ])
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
    it('restaurant gets warm palette (amber/brown)', () => {
        const result = generateBlocks('Create a restaurant website')
        expect(result.theme.primaryColor).toBe('#D97706')
    })

    it('ecommerce gets cool palette (sky/indigo)', () => {
        const result = generateBlocks('Build an online store')
        expect(result.theme.primaryColor).toBe('#0EA5E9')
    })

    it('portfolio uses dark mode', () => {
        const result = generateBlocks('Create a portfolio for a photographer')
        expect(result.theme.colorMode).toBe('dark')
    })

    it('business gets blue palette', () => {
        const result = generateBlocks('Create a consulting company website')
        expect(result.theme.primaryColor).toBe('#3B82F6')
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
