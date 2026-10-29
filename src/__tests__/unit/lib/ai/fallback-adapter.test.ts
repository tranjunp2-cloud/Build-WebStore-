/**
 * TC-F01-FA-01 — Fallback adapter end-to-end
 * Source: plans/260412-2156-ai-gen-website-audit/phase-06-step-4-shape-adapter.md
 */

import { describe, expect, it } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { ComposerCategory } from '@/lib/ai/composer-category-resolver'

const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

describe('composeFallbackResult — 14 categories', () => {
    const canonical: Array<[string, ComposerCategory]> = [
        ['Fine dining restaurant with seasonal menu', 'restaurant'],
        ['Online store selling handmade boutique jewelry', 'ecommerce'],
        ['Luxury spa salon with skincare treatments', 'beauty'],
        ['AI photo editing SaaS platform for creators', 'tech'],
        ['I want a site for my dental clinic in District 1', 'health'],
        ['English tuition academy for kindergarten students', 'education'],
        ['Real estate listings for condos in the city', 'realestate'],
        ['Yoga studio membership signup', 'fitness'],
        ['Portfolio site for a freelance illustrator', 'creative'],
        ['Consulting agency for corporate services', 'business'],
        ['Vietnamese coffee cafe brand online', 'fnb'],
        ['Wedding photography and event planning', 'events'],
        ['Travel tour operator with hotel packages', 'travel'],
        ['Personal blog newsletter for writers', 'blog'],
    ]

    for (const [prompt, category] of canonical) {
        it(`category=${category} produces valid GenerationResult`, () => {
            const result = composeFallbackResult(prompt, 42, 'en')

            expect(result.siteName).toBeTruthy()
            expect(result.blocks.length).toBeGreaterThan(0)
            expect(result.theme.primaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
            expect(result.theme.secondaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
            expect(ALLOWED_HEADING_FONTS).toContain(result.theme.fontHeading)
            expect(ALLOWED_BODY_FONTS).toContain(result.theme.fontBody)
            expect(['light', 'dark']).toContain(result.theme.colorMode)
            expect(result.seo.title.length).toBeGreaterThan(0)
            expect(result.seo.description.length).toBeLessThanOrEqual(161)
            expect(result.language).toBe('en')
        })
    }
})

describe('composeFallbackResult — behaviors', () => {
    it('extractedName overrides siteName and propagates to blocks', () => {
        const result = composeFallbackResult('dental clinic', 1, 'en', 'Smile Studio')
        expect(result.siteName).toBe('Smile Studio')
        // At least one block should reference the overridden name (hero/contact/footer).
        const blocksJson = JSON.stringify(result.blocks)
        expect(blocksJson).toContain('Smile Studio')
    })

    it('same prompt + same seed → identical result (deterministic)', () => {
        const a = composeFallbackResult('modern dental clinic', 42, 'en')
        const b = composeFallbackResult('modern dental clinic', 42, 'en')
        expect(a.siteName).toBe(b.siteName)
        expect(a.blocks.length).toBe(b.blocks.length)
        expect(a.theme).toEqual(b.theme)
    })

    it('different seed → potentially different preset (but valid)', () => {
        const a = composeFallbackResult('restaurant', 0, 'en')
        const b = composeFallbackResult('restaurant', 2, 'en')
        expect(a.blocks.length).toBeGreaterThan(0)
        expect(b.blocks.length).toBeGreaterThan(0)
    })

    it('language=vi propagates', () => {
        const result = composeFallbackResult('quán cafe indie', 1, 'vi')
        expect(result.language).toBe('vi')
    })

    it('Malay F&B template converts legacy menu blueprint without duplicating business copy', () => {
        const result = composeFallbackResult('kafe tempatan', 0, 'ms', {
            businessName: 'Kopi Shah Alam',
            industry: 'fnb',
            products: 'Kopi artisan, Nasi lemak, Roti bakar',
            shortDescription: 'Kafe tempatan dengan sarapan tradisional.',
        })
        const menu = result.pages
            ?.flatMap((page) => page.blocks)
            .find((block) => block.blockType === 'menu-food') as Record<string, unknown> | undefined
        const categories = menu?.categories as Array<{ name: string; items: Array<Record<string, unknown>> }> | undefined

        expect(menu?.headline).toBe('Menu Kami')
        expect(categories?.[0]?.name).toBe('Pilihan Kami')
        expect(categories?.[0]?.items.map((item) => item.name)).toEqual([
            'Kopi artisan',
            'Nasi lemak',
            'Roti bakar',
        ])
        expect(categories?.[0]?.items.every((item) => item.tag == null)).toBe(true)
        expect(JSON.stringify(menu)).not.toContain('Kafe tempatan dengan sarapan tradisional.')

		const footer = result.pages
			?.flatMap((page) => page.blocks)
			.find((block) => block.blockType === 'footer') as Record<string, unknown> | undefined
		const footerColumns = footer?.columns as Array<{ title: string; links: Array<{ label: string }> }> | undefined
		expect(footer?.logoText).toBe('Kopi Shah Alam')
		expect(footer?.copyrightText).toBe(`© ${new Date().getFullYear()} Kopi Shah Alam. Hak cipta terpelihara.`)
		expect(footerColumns?.[0]?.title).toBe('Terokai')
		expect(footerColumns?.[0]?.links.map((link) => link.label)).toContain('Utama')
    })

    it('Malay template keeps semantic item copy instead of repeating structural labels or business description', () => {
        const shortDescription = 'Studio kecantikan wanita di Petaling Jaya yang menawarkan rawatan profesional dalam suasana selesa dan peribadi.'
        const services = ['Rawatan jerawat', 'Urutan aromaterapi', 'Pakej pengantin']
        const result = composeFallbackResult('studio kecantikan', 0, 'ms', {
            businessName: 'Luna Beauty Studio',
            industry: 'beauty',
            products: services.join(', '),
            shortDescription,
        })
        const blocks = result.pages?.flatMap((page) => page.blocks) ?? []
        const findBlock = (blockType: string) => blocks.find((block) => block.blockType === blockType) as Record<string, unknown> | undefined

        const features = findBlock('features')?.features as Array<{ title: string; description: string }>
        expect(features.map((item) => item.title)).toEqual(services)
        // #2103 A1: no canned feature copy — only where to find the product
        expect(features.every((item) => item.description === 'Boleh didapati di Luna Beauty Studio.')).toBe(true)

        const testimonials = findBlock('testimonials')?.testimonials as Array<{ quote: string; name: string }>
        expect(new Set(testimonials.map((item) => item.quote)).size).toBe(testimonials.length)
        expect(testimonials.every((item) => item.quote !== shortDescription)).toBe(true)
        expect(testimonials.every((item) => !services.includes(item.name))).toBe(true)

        const faq = findBlock('faq')?.items as Array<{ question: string; answer: string }>
        expect(faq).toEqual([]) // no facts to answer from → no invented Q&A
        expect(new Set(faq.map((item) => item.question)).size).toBe(faq.length)
        expect(faq.every((item) => item.question !== 'Soalan Lazim')).toBe(true)
        expect(faq.every((item) => item.answer !== shortDescription)).toBe(true)

        const team = findBlock('team')?.members as Array<{ name: string; role: string; bio: string }>
        expect(team.every((member) => !services.includes(member.name))).toBe(true)
        expect(team.every((member) => !services.includes(member.role))).toBe(true)
        expect(team).toEqual([{ name: 'Pasukan Luna Beauty Studio', role: 'Pengasas' }])
    })

    it('pages array mirrors templateSeed pages', () => {
        const result = composeFallbackResult('restaurant', 0, 'en')
        expect(result.pages).toBeDefined()
        expect(result.pages!.length).toBeGreaterThan(0)
        expect(result.pages![0]!.isHomepage).toBe(true)
    })

    it('restaurant fallback emits at least one restaurant-appropriate block', () => {
        const ACCEPTABLE = new Set(['hero', 'features', 'testimonials', 'faq', 'cta', 'stats', 'team', 'pricing', 'menu-food'])
        const blockTypes = new Set<string>()
        for (let seed = 0; seed < 4; seed++) {
            const result = composeFallbackResult('restaurant', seed, 'en')
            for (const block of result.blocks) {
                blockTypes.add(block.blockType as string)
            }
        }
        const hasAny = [...ACCEPTABLE].some((t) => blockTypes.has(t))
        expect(hasAny).toBe(true)
    })

    it('zero-keyword prompt → business category fallback works', () => {
        const result = composeFallbackResult('something generic', 0, 'en')
        expect(result.siteType).toBe('business')
        expect(result.blocks.length).toBeGreaterThan(0)
    })

    it('drops unsupported blocks from fallback output (fc0020d regression fix)', () => {
        // Health seed 7 previously emitted booking-widget; must not leak through.
        // review-cards drops on all gen paths (media pipeline required).
        // Note: before-after, booking-widget re-enabled via plan 260422-1900-block-aivisible-audit-fix.
        // Note: gallery + portfolio-grid re-enabled via plan 260414-1400 Unsplash pipeline.
        // Note: menu-display re-hidden via GH-1024 — use menu-food for restaurants.
        const UNSUPPORTED = new Set([
            'review-cards',
        ])

        const scenarios: Array<[string, number]> = [
            ['dental clinic', 7],
            ['crossfit gym', 11],
            ['wedding photographer portfolio', 5],
            ['italian restaurant', 42],
        ]

        for (const [prompt, seed] of scenarios) {
            const result = composeFallbackResult(prompt, seed, 'en')
            for (const block of result.blocks) {
                expect(UNSUPPORTED.has(block.blockType as string)).toBe(false)
            }
            for (const page of result.pages ?? []) {
                for (const block of page.blocks) {
                    expect(UNSUPPORTED.has(block.blockType as string)).toBe(false)
                }
            }
        }
    })
})
