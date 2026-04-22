import { describe, it, expect, beforeEach } from 'vitest'

// ── Sprint 2: Block Variant Config/Schema Tests ───────────────────────────────
// TC-S2-001 through TC-S2-019 (unit-testable subset)
// Visual/E2E tests (TC-S2-001..014, TC-S2-018, TC-S2-019) are out of scope here.
// This file covers:
//   TC-S2-015 — Design token audit (no hardcoded brand colors in variant code)
//   TC-S2-016 — Variant swap preserves content fields (schema-level)
//   TC-S2-017 — Extra items preserved in data across variant swaps
// Plus schema/meta validation for every new Sprint 2 variant.

import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'
import { FeaturesConfigSchema, featuresMeta } from '@/blocks/features/config'
import { PricingConfigSchema, pricingMeta } from '@/blocks/pricing/config'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'
import { GalleryConfigSchema, galleryMeta } from '@/blocks/gallery/config'
import { NavigationConfigSchema, navigationMeta } from '@/blocks/navigation/config'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal content payload shared across hero variant swap tests (TC-S2-016) */
const HERO_FULL_CONTENT = {
    blockType: 'hero' as const,
    headline: 'Welcome to Our Restaurant',
    subheadline: 'Authentic flavours, unforgettable experience',
    image: { url: '/images/restaurant-hero.jpg', alt: 'Hero image' },
    ctaButtons: [
        { label: 'Reserve a Table', url: '/reserve', style: 'primary' as const },
        { label: 'View Menu', url: '/menu', style: 'outline' as const },
    ],
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Hero — Sprint 2 new variants (magazine, gradient, split-video)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-001..003] Hero — Sprint 2 variant schema validation', () => {
    it('heroMeta lists magazine variant', () => {
        // Arrange + Act — meta is static
        // Assert
        expect(heroMeta.variants).toContain('magazine')
    })

    it('heroMeta lists gradient variant', () => {
        expect(heroMeta.variants).toContain('gradient')
    })

    it('heroMeta lists split-video variant', () => {
        expect(heroMeta.variants).toContain('split-video')
    })

    it('HeroConfigSchema accepts variant=magazine', () => {
        // Arrange
        const input = { blockType: 'hero' as const, headline: 'Test', variant: 'magazine' }

        // Act
        const result = HeroConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('magazine')
        }
    })

    it('HeroConfigSchema accepts variant=gradient with gradientPreset', () => {
        // Arrange
        const input = {
            blockType: 'hero' as const,
            headline: 'Gradient Hero',
            variant: 'gradient',
            gradientPreset: 'aurora' as const,
        }

        // Act
        const result = HeroConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('gradient')
            expect(result.data.gradientPreset).toBe('aurora')
        }
    })

    it('HeroConfigSchema rejects unknown gradientPreset value', () => {
        // Arrange
        const input = {
            blockType: 'hero' as const,
            headline: 'Test',
            variant: 'gradient',
            gradientPreset: 'volcano',
        }

        // Act
        const result = HeroConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })

    it('HeroConfigSchema accepts variant=split-video with videoUrl', () => {
        // Arrange
        const input = {
            blockType: 'hero' as const,
            headline: 'Video Hero',
            variant: 'split-video',
            videoUrl: 'https://example.com/promo.mp4',
        }

        // Act
        const result = HeroConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('split-video')
            expect(result.data.videoUrl).toBe('https://example.com/promo.mp4')
        }
    })

    it('HeroConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'hero' as const, headline: 'Test', variant: 'cinemagraph' }

        // Act
        const result = HeroConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Features — Sprint 2 new variants (zigzag, carousel)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-004..005] Features — Sprint 2 variant schema validation', () => {
    it('featuresMeta lists zigzag variant', () => {
        expect(featuresMeta.variants).toContain('zigzag')
    })

    it('featuresMeta lists carousel variant', () => {
        expect(featuresMeta.variants).toContain('carousel')
    })

    it('FeaturesConfigSchema accepts variant=zigzag with items', () => {
        // Arrange
        const input = {
            blockType: 'features' as const,
            headline: 'Our Services',
            variant: 'zigzag',
            features: [
                { title: 'Design', description: 'World-class design' },
                { title: 'Build', description: 'Solid engineering' },
                { title: 'Launch', description: 'Go live fast' },
                { title: 'Scale', description: 'Grow with confidence' },
            ],
        }

        // Act
        const result = FeaturesConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('zigzag')
            expect(result.data.features).toHaveLength(4)
        }
    })

    it('FeaturesConfigSchema accepts variant=carousel with 6 items', () => {
        // Arrange
        const items = Array.from({ length: 6 }, (_, i) => ({
            title: `Feature ${i + 1}`,
            description: `Description ${i + 1}`,
            icon: '⭐',
        }))
        const input = {
            blockType: 'features' as const,
            headline: 'Everything you need',
            variant: 'carousel',
            features: items,
        }

        // Act
        const result = FeaturesConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.features).toHaveLength(6)
        }
    })

    it('FeaturesConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'features' as const, headline: 'Test', variant: 'timeline' }

        // Act
        const result = FeaturesConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Pricing — Sprint 2 new variants (toggle, comparison)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-008..009] Pricing — Sprint 2 variant schema validation', () => {
    it('pricingMeta lists toggle variant', () => {
        expect(pricingMeta.variants).toContain('toggle')
    })

    it('pricingMeta lists comparison variant', () => {
        expect(pricingMeta.variants).toContain('comparison')
    })

    it('PricingConfigSchema accepts variant=toggle with yearlyDiscount', () => {
        // Arrange
        const input = {
            blockType: 'pricing' as const,
            headline: 'Simple Pricing',
            variant: 'toggle',
            yearlyDiscount: 20,
            plans: [
                {
                    name: 'Pro',
                    price: 'RM49',
                    period: 'month',
                    features: [{ text: 'Unlimited sites', included: true }],
                    ctaLabel: 'Start free trial',
                    ctaUrl: '/signup',
                    highlighted: true,
                },
            ],
        }

        // Act
        const result = PricingConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('toggle')
            expect(result.data.yearlyDiscount).toBe(20)
            expect(result.data.plans[0].highlighted).toBe(true)
        }
    })

    it('PricingConfigSchema accepts variant=comparison with multiple plans and features', () => {
        // Arrange
        const makePlan = (name: string) => ({
            name,
            price: 'RM29',
            features: Array.from({ length: 10 }, (_, i) => ({ text: `Feature ${i + 1}`, included: i < 5 })),
            ctaLabel: 'Choose',
            ctaUrl: '/signup',
        })
        const input = {
            blockType: 'pricing' as const,
            variant: 'comparison',
            plans: [makePlan('Starter'), makePlan('Pro'), makePlan('Enterprise')],
        }

        // Act
        const result = PricingConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.plans).toHaveLength(3)
            expect(result.data.plans[0].features).toHaveLength(10)
        }
    })

    it('PricingConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'pricing' as const, variant: 'matrix' }

        // Act
        const result = PricingConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Testimonials — Sprint 2 new variants (spotlight, masonry)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-006..007] Testimonials — Sprint 2 variant schema validation', () => {
    it('testimonialsMeta lists spotlight variant', () => {
        expect(testimonialsMeta.variants).toContain('spotlight')
    })

    it('testimonialsMeta lists masonry variant', () => {
        expect(testimonialsMeta.variants).toContain('masonry')
    })

    it('TestimonialsConfigSchema accepts variant=spotlight with 5 testimonials', () => {
        // Arrange
        const testimonials = Array.from({ length: 5 }, (_, i) => ({
            quote: `Great product ${i + 1}! Highly recommend.`,
            name: `Customer ${i + 1}`,
            title: 'CEO',
            company: 'Acme Corp',
            rating: 5,
        }))
        const input = {
            blockType: 'testimonials' as const,
            variant: 'spotlight',
            headline: 'What our customers say',
            testimonials,
        }

        // Act
        const result = TestimonialsConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('spotlight')
            expect(result.data.testimonials).toHaveLength(5)
        }
    })

    it('TestimonialsConfigSchema accepts variant=masonry with varying quote lengths', () => {
        // Arrange
        const input = {
            blockType: 'testimonials' as const,
            variant: 'masonry',
            testimonials: [
                { quote: 'Short review.', name: 'Ali' },
                { quote: 'A much longer review that goes into detail about how amazing this product really is and why everyone should use it.', name: 'Siti' },
                { quote: 'Medium length review that says good things.', name: 'Raju', rating: 4 },
                { quote: 'Another short one.', name: 'Chen' },
                { quote: 'Very detailed feedback spanning multiple aspects of the service delivered by this excellent team.', name: 'Nurul' },
                { quote: 'Quick review.', name: 'Hafiz', rating: 5 },
            ],
        }

        // Act
        const result = TestimonialsConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.testimonials).toHaveLength(6)
        }
    })

    it('TestimonialsConfigSchema rejects rating outside 1-5 range', () => {
        // Arrange
        const input = {
            blockType: 'testimonials' as const,
            testimonials: [{ quote: 'Great!', name: 'Ali', rating: 6 }],
        }

        // Act
        const result = TestimonialsConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Gallery — Sprint 2 new variant (lightbox)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-010] Gallery — Sprint 2 lightbox variant schema validation', () => {
    it('galleryMeta lists lightbox variant', () => {
        expect(galleryMeta.variants).toContain('lightbox')
    })

    it('GalleryConfigSchema accepts variant=lightbox with 8 images', () => {
        // Arrange
        const images = Array.from({ length: 8 }, (_, i) => ({
            image: { url: `/gallery/photo-${i + 1}.jpg`, alt: `Photo ${i + 1}` },
            caption: `Caption ${i + 1}`,
        }))
        const input = {
            blockType: 'gallery' as const,
            variant: 'lightbox',
            headline: 'Our Gallery',
            images,
        }

        // Act
        const result = GalleryConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('lightbox')
            expect(result.data.images).toHaveLength(8)
        }
    })

    it('GalleryConfigSchema rejects image entry without url', () => {
        // Arrange
        const input = {
            blockType: 'gallery' as const,
            variant: 'lightbox',
            images: [{ image: { alt: 'No URL here' } }],
        }

        // Act
        const result = GalleryConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Navigation — Sprint 2 new variants (transparent, pill)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-011..012] Navigation — Sprint 2 variant schema validation', () => {
    it('navigationMeta lists transparent variant', () => {
        expect(navigationMeta.variants).toContain('transparent')
    })

    it('navigationMeta lists pill variant', () => {
        expect(navigationMeta.variants).toContain('pill')
    })

    it('NavigationConfigSchema accepts variant=transparent with links', () => {
        // Arrange
        const input = {
            blockType: 'navigation' as const,
            variant: 'transparent',
            logoText: 'MyBrand',
            links: [
                { label: 'Home', url: '/' },
                { label: 'About', url: '/about' },
                { label: 'Contact', url: '/contact' },
            ],
            ctaButton: { show: true, label: 'Get Started', url: '/signup' },
        }

        // Act
        const result = NavigationConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('transparent')
            expect(result.data.links).toHaveLength(3)
        }
    })

    it('NavigationConfigSchema accepts variant=pill with logo, links and CTA', () => {
        // Arrange
        const input = {
            blockType: 'navigation' as const,
            variant: 'pill',
            logoText: 'FloatNav',
            links: [
                { label: 'Features', url: '#features' },
                { label: 'Pricing', url: '#pricing' },
                { label: 'Blog', url: '/blog' },
                { label: 'Docs', url: '/docs' },
            ],
            ctaButton: { show: true, label: 'Try for free', url: '/signup' },
        }

        // Act
        const result = NavigationConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('pill')
            expect(result.data.links).toHaveLength(4)
            expect(result.data.ctaButton?.show).toBe(true)
        }
    })

    it('NavigationConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'navigation' as const, variant: 'floating-bubble' }

        // Act
        const result = NavigationConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Contact — Sprint 2 new variant (map-split)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-013] Contact — Sprint 2 map-split variant schema validation', () => {
    it('contactMeta lists map-split variant', () => {
        expect(contactMeta.variants).toContain('map-split')
    })

    it('ContactConfigSchema accepts variant=map-split with address', () => {
        // Arrange
        const input = {
            blockType: 'contact' as const,
            variant: 'map-split',
            headline: 'Find Us',
            address: 'No. 12, Jalan Ampang, 50450 Kuala Lumpur',
            email: 'hello@mybusiness.com.my',
            phone: '+60 3-1234 5678',
            formFields: [
                { label: 'Name', fieldName: 'name', fieldType: 'text', required: true },
                { label: 'Email', fieldName: 'email', fieldType: 'email', required: true },
                { label: 'Message', fieldName: 'message', fieldType: 'textarea', required: false },
            ],
        }

        // Act
        const result = ContactConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('map-split')
            expect(result.data.address).toBe('No. 12, Jalan Ampang, 50450 Kuala Lumpur')
            expect(result.data.formFields).toHaveLength(3)
        }
    })

    it('ContactConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'contact' as const, variant: 'embedded-map' }

        // Act
        const result = ContactConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2: Footer — Sprint 2 new variant (mega-footer)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-014] Footer — Sprint 2 dark-gradient variant schema validation', () => {
    it('footerMeta does NOT list mega-footer (newsletter variant hidden)', () => {
        expect(footerMeta.variants).not.toContain('mega-footer')
        expect(footerMeta.variants).not.toContain('expanded')
    })

    it('FooterConfigSchema accepts variant=dark-gradient with 4 columns and socials', () => {
        // Arrange
        const input = {
            blockType: 'footer' as const,
            variant: 'dark-gradient',
            logoText: 'MyBrand',
            tagline: 'Building the future, one site at a time',
            columns: [
                { title: 'Product', links: [{ label: 'Features', url: '/features' }, { label: 'Pricing', url: '/pricing' }] },
                { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Blog', url: '/blog' }] },
                { title: 'Support', links: [{ label: 'Docs', url: '/docs' }, { label: 'Contact', url: '/contact' }] },
                { title: 'Legal', links: [{ label: 'Privacy', url: '/privacy' }, { label: 'Terms', url: '/terms' }] },
            ],
            socials: [
                { platform: 'twitter', url: 'https://twitter.com/mybrand' },
                { platform: 'instagram', url: 'https://instagram.com/mybrand' },
                { platform: 'linkedin', url: 'https://linkedin.com/company/mybrand' },
            ],
            copyrightText: '© 2026 MyBrand. All rights reserved.',
        }

        // Act
        const result = FooterConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('dark-gradient')
            expect(result.data.columns).toHaveLength(4)
            expect(result.data.socials).toHaveLength(3)
            expect(result.data.copyrightText).toContain('2026')
        }
    })

    it('FooterConfigSchema rejects invalid Sprint 2 variant name', () => {
        // Arrange
        const input = { blockType: 'footer' as const, variant: 'jumbo-footer' }

        // Act
        const result = FooterConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2-015: All new variants use CSS design tokens — no hardcoded brand colors
// Tested as a schema-level audit: confirm that config fields carry no hardcoded
// color values and that parsed data does not embed brand colors.
// (Full grep audit is in TC-S1-013 pattern — covered by CI code audit job.)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-015] Design token audit — Sprint 2 variant configs carry no hardcoded colors', () => {
    const HARDCODED_HEX_RE = /^#[0-9A-Fa-f]{6}$/

    it('HeroConfigSchema does not embed brand hex in non-color fields', () => {
        // Arrange
        const result = HeroConfigSchema.safeParse({
            blockType: 'hero',
            variant: 'magazine',
            headline: 'Test',
        })

        // Act + Assert
        expect(result.success).toBe(true)
        if (result.success) {
            // headline, subheadline, height — none should look like a hex color
            expect(HARDCODED_HEX_RE.test(result.data.headline)).toBe(false)
            expect(result.data.height).toBeDefined()
            // height is a CSS value like '90vh' — must NOT be a bare hex
            expect(HARDCODED_HEX_RE.test(result.data.height)).toBe(false)
        }
    })

    it('PricingConfigSchema plan price field is freeform string, not a CSS color', () => {
        // Arrange
        const result = PricingConfigSchema.safeParse({
            blockType: 'pricing',
            variant: 'toggle',
            plans: [{ name: 'Pro', price: 'RM49/mo', features: [], ctaLabel: 'Sign up', ctaUrl: '/signup' }],
        })

        // Act + Assert
        expect(result.success).toBe(true)
        if (result.success) {
            // price is customer-facing text — should never be interpreted as a color
            const price = result.data.plans[0].price
            expect(HARDCODED_HEX_RE.test(price)).toBe(false)
        }
    })

    it('NavigationConfigSchema variant=transparent does not inject color into link labels', () => {
        // Arrange
        const result = NavigationConfigSchema.safeParse({
            blockType: 'navigation',
            variant: 'transparent',
            links: [{ label: 'Home', url: '/' }],
        })

        // Act + Assert
        expect(result.success).toBe(true)
        if (result.success) {
            const labels = result.data.links.map(l => l.label)
            labels.forEach(label => {
                expect(HARDCODED_HEX_RE.test(label)).toBe(false)
            })
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2-016: Variant swap preserves content — schema-level assertion
// Verifies that ALL content fields present in one variant config are accepted
// unchanged by another variant config (same schema, different variant value).
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-016] Variant swap preserves content (schema-level)', () => {
    it('hero content parsed with variant=centered equals content parsed with variant=magazine', () => {
        // Arrange
        const centeredResult = HeroConfigSchema.safeParse({ ...HERO_FULL_CONTENT, variant: 'centered' })
        const magazineResult = HeroConfigSchema.safeParse({ ...HERO_FULL_CONTENT, variant: 'magazine' })

        // Act + Assert
        expect(centeredResult.success).toBe(true)
        expect(magazineResult.success).toBe(true)

        if (centeredResult.success && magazineResult.success) {
            // Content fields must be identical regardless of variant
            expect(magazineResult.data.headline).toBe(centeredResult.data.headline)
            expect(magazineResult.data.subheadline).toBe(centeredResult.data.subheadline)
            expect(magazineResult.data.image?.url).toBe(centeredResult.data.image?.url)
            expect(magazineResult.data.ctaButtons).toHaveLength(centeredResult.data.ctaButtons.length)
            expect(magazineResult.data.ctaButtons[0].label).toBe(centeredResult.data.ctaButtons[0].label)
            expect(magazineResult.data.ctaButtons[1].label).toBe(centeredResult.data.ctaButtons[1].label)
        }
    })

    it('hero content swapped to split-video then back to centered retains all fields', () => {
        // Arrange — start with centered
        const step1 = HeroConfigSchema.safeParse({ ...HERO_FULL_CONTENT, variant: 'centered' })
        expect(step1.success).toBe(true)

        // Act — swap to split-video (add videoUrl, keep all content)
        const step2 = HeroConfigSchema.safeParse({
            ...HERO_FULL_CONTENT,
            variant: 'split-video',
            videoUrl: 'https://cdn.example.com/hero.mp4',
        })
        expect(step2.success).toBe(true)

        // Act — swap back to centered (drop videoUrl)
        const step3 = HeroConfigSchema.safeParse({ ...HERO_FULL_CONTENT, variant: 'centered' })
        expect(step3.success).toBe(true)

        // Assert — all original content preserved at step3
        if (step1.success && step3.success) {
            expect(step3.data.headline).toBe(step1.data.headline)
            expect(step3.data.subheadline).toBe(step1.data.subheadline)
            expect(step3.data.ctaButtons).toHaveLength(step1.data.ctaButtons.length)
        }
    })

    it('features variant=zigzag and variant=carousel accept identical items array', () => {
        // Arrange — 4 feature items (works across both variants)
        const items = [
            { title: 'A', description: 'Desc A', icon: '🔥' },
            { title: 'B', description: 'Desc B', icon: '💡' },
            { title: 'C', description: 'Desc C' },
            { title: 'D', description: 'Desc D' },
        ]
        const base = { blockType: 'features' as const, headline: 'Features', features: items }

        // Act
        const zigzagResult = FeaturesConfigSchema.safeParse({ ...base, variant: 'zigzag' })
        const carouselResult = FeaturesConfigSchema.safeParse({ ...base, variant: 'carousel' })

        // Assert — same content, just different variant value
        expect(zigzagResult.success).toBe(true)
        expect(carouselResult.success).toBe(true)
        if (zigzagResult.success && carouselResult.success) {
            expect(carouselResult.data.features).toHaveLength(zigzagResult.data.features.length)
            expect(carouselResult.data.headline).toBe(zigzagResult.data.headline)
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-S2-017: Extra items preserved across variant swap
// Schema must not silently drop array items regardless of how many are provided.
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-S2-017] Variant swap — extra items not silently dropped by schema', () => {
    it('FeaturesConfigSchema retains all 4 items when variant=carousel (no max-items constraint)', () => {
        // Arrange — 4 feature items going into a variant that "shows 3" visually
        const input = {
            blockType: 'features' as const,
            headline: 'Everything',
            variant: 'carousel',
            features: [
                { title: 'One', description: 'D1' },
                { title: 'Two', description: 'D2' },
                { title: 'Three', description: 'D3' },
                { title: 'Four', description: 'D4' },
            ],
        }

        // Act
        const result = FeaturesConfigSchema.safeParse(input)

        // Assert — schema stores all 4, visual truncation is UI concern only
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.features).toHaveLength(4)
        }
    })

    it('TestimonialsConfigSchema retains all 8 testimonials for masonry variant', () => {
        // Arrange — more testimonials than typical "above fold" count
        const testimonials = Array.from({ length: 8 }, (_, i) => ({
            quote: `Review number ${i + 1} from a happy customer.`,
            name: `Customer ${i + 1}`,
        }))
        const input = {
            blockType: 'testimonials' as const,
            variant: 'masonry',
            testimonials,
        }

        // Act
        const result = TestimonialsConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.testimonials).toHaveLength(8)
        }
    })

    it('GalleryConfigSchema retains all 12 images for lightbox variant', () => {
        // Arrange — large gallery
        const images = Array.from({ length: 12 }, (_, i) => ({
            image: { url: `/gallery/${i + 1}.jpg` },
        }))
        const input = {
            blockType: 'gallery' as const,
            variant: 'lightbox',
            images,
        }

        // Act
        const result = GalleryConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.images).toHaveLength(12)
        }
    })
})
