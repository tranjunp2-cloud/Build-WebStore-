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

    it('returns 6-12 blocks (dynamic pool + industry blocks)', () => {
        // Restaurant gets industry blocks (menu-food + review-cards) prepended before generic middle blocks.
        // booking-widget temporarily hidden (feat/fix-broken-block-variants).
        // Range: nav + hero + 0-2 industry + 3-4 middle + contact + footer = 6-11
        expect(result.blocks.length).toBeGreaterThanOrEqual(6)
        expect(result.blocks.length).toBeLessThanOrEqual(12)
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

describe('generateBlocks — contact details', () => {
    // TC-AIAUD-162: the last-resort path knows only a name; it must not invent a phone, email or address
    it('TC-AIAUD-162: leaves phone, email and address empty instead of inventing them', () => {
        const result = generateBlocks('Create a website called "My Cafe Shop"')
        const contactBlock = result.blocks.find(b => b.blockType === 'contact')
        expect(contactBlock?.email ?? null).toBeNull()
        expect(contactBlock?.phone).toBe('')
        expect(contactBlock?.address).toBe('')
        expect(JSON.stringify(result)).not.toMatch(/12-345 6789|hello@mycafeshop/)
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

// ─── Regression: Payload field name mismatches that caused empty blocks ──
// Bug history: 2026-04-14
// User reported huge empty space in generated restaurant site (page 179).
// Root cause: faq builder used `items` field, but Payload schema requires
// `faqs` → silently dropped on save → empty section rendered.
// Same class of bug for `gallery` (upload field, can't accept URLs) and
// `about.body` (textarea, was passed as Lexical richtext object).

describe('generateBlocks — Payload field name compliance', () => {
    it('faq block uses `faqs` field (not `items`) to match Payload schema', () => {
        // Force faq into the pool by generating many seeds — pool shuffles.
        let foundFaq: Record<string, unknown> | undefined
        for (let seed = 0; seed < 50 && !foundFaq; seed++) {
            const result = generateBlocks('Create a website for a company', seed * 31)
            const faq = result.blocks.find(b => b.blockType === 'faq') as Record<string, unknown> | undefined
            if (faq) foundFaq = faq
        }
        expect(foundFaq).toBeDefined()
        expect(foundFaq).toHaveProperty('faqs')
        expect(Array.isArray(foundFaq!.faqs)).toBe(true)
        // #2103 A1: the legacy safety net invents no Q&A — the array exists but is empty
        expect(foundFaq!.faqs).toEqual([])
        // Should NOT have legacy `items` field
        expect(foundFaq).not.toHaveProperty('items')
    })

    it('about block body is plain string (not Lexical richtext object)', () => {
        let foundAbout: Record<string, unknown> | undefined
        for (let seed = 0; seed < 50 && !foundAbout; seed++) {
            const result = generateBlocks('Create a website for a company', seed * 47)
            const about = result.blocks.find(b => b.blockType === 'about') as Record<string, unknown> | undefined
            if (about) foundAbout = about
        }
        expect(foundAbout).toBeDefined()
        expect(typeof foundAbout!.body).toBe('string')
        expect((foundAbout!.body as string).length).toBeGreaterThan(0)
    })

    it('gallery block is excluded from middle pool (requires media uploads)', () => {
        // Gallery requires upload field IDs that the fallback cannot generate.
        // Verify gallery never appears in 100 generations.
        for (let seed = 0; seed < 100; seed++) {
            const result = generateBlocks('Create a website for a company', seed * 17)
            const gallery = result.blocks.find(b => b.blockType === 'gallery')
            expect(gallery, `seed ${seed} should not produce gallery`).toBeUndefined()
        }
    })
})

// ─── Industry-aware fallback: category-specific blocks ──────────────────
describe('generateBlocks — industry-aware block selection', () => {
    // feat/fix-broken-block-variants: booking-widget temporarily hidden — test updated to match
    it('restaurant fallback includes menu-food', () => {
        const result = generateBlocks('Create a website for "Ben Ben" restaurant', 12345)
        const blockTypes = result.blocks.map(b => b.blockType)
        expect(blockTypes).toContain('menu-food')
        expect(blockTypes).not.toContain('booking-widget') // temporarily hidden
        expect(blockTypes).not.toContain('menu-display') // GH-1024 — hidden
    })

    it('restaurant menu-food carries no invented dishes or prices (#2103 A1/A2)', () => {
        const result = generateBlocks('Create a website for a restaurant', 12345)
        const menu = result.blocks.find(b => b.blockType === 'menu-food') as Record<string, unknown> | undefined
        expect(menu).toBeDefined()
        expect(menu!.categories).toEqual([])
    })

    it('restaurant review-cards has no invented reviewers, ratings or review count (#2103 A1)', () => {
        const result = generateBlocks('Create a website for a restaurant', 12345)
        const reviews = result.blocks.find(b => b.blockType === 'review-cards') as Record<string, unknown> | undefined
        expect(reviews).toBeDefined()
        expect(reviews!.reviews).toEqual([])
        expect(reviews!.showAverage).toBe(false)
        expect(reviews!.totalReviewCount).toBeUndefined()
    })

    it('ecommerce fallback includes products-grid + review-cards', () => {
        const result = generateBlocks('Create a website for an online store', 12345)
        const blockTypes = result.blocks.map(b => b.blockType)
        expect(blockTypes).toContain('products-grid')
        expect(blockTypes).toContain('review-cards')
    })

    it('business fallback works without industry blocks', () => {
        const result = generateBlocks('Create a consulting company website', 12345)
        // Should still have nav, hero, contact, footer + middle blocks
        expect(result.blocks.length).toBeGreaterThanOrEqual(6)
        const blockTypes = result.blocks.map(b => b.blockType)
        expect(blockTypes).toContain('navigation')
        expect(blockTypes).toContain('hero')
        expect(blockTypes).toContain('contact')
        expect(blockTypes).toContain('footer')
    })
})
