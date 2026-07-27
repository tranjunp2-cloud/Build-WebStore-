import { describe, it, expect } from 'vitest'

// ─── Import all block config schemas ──────────────────────────────────
import { AboutConfigSchema, aboutMeta } from '@/blocks/about/config'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { CTAConfigSchema, ctaMeta } from '@/blocks/cta/config'
import { FAQConfigSchema, faqMeta } from '@/blocks/faq/config'
import { FeaturesConfigSchema, featuresMeta } from '@/blocks/features/config'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'
import { GalleryConfigSchema, galleryMeta } from '@/blocks/gallery/config'
import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'
import { LogoCloudConfigSchema, logoCloudMeta } from '@/blocks/logo-cloud/config'
import { NavigationConfigSchema, navigationMeta } from '@/blocks/navigation/config'
import { NewsletterConfigSchema, newsletterMeta } from '@/blocks/newsletter/config'
import { PricingConfigSchema, pricingMeta } from '@/blocks/pricing/config'
import { StatsConfigSchema, statsMeta } from '@/blocks/stats/config'
import { TeamConfigSchema, teamMeta } from '@/blocks/team/config'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'
import { VideoConfigSchema, videoMeta } from '@/blocks/video/config'
import { BlogListConfigSchema, blogListMeta } from '@/blocks/blog-list/config'
import { CustomHtmlConfigSchema, customHtmlMeta } from '@/blocks/custom-html/config'
import { ProductsFeaturedConfigSchema, productsFeaturedMeta } from '@/blocks/products-featured/config'
import { ProductsGridConfigSchema, productsGridMeta } from '@/blocks/products-grid/config'

// ─── TC-F04: Block system validation schemas ──────────────────────────
// ─── TC-F01.08: Block registry for AI generation ─────────────────────

// Helper: test a schema with valid blockType and optional extras
function testSchema(name: string, schema: any, blockType: string, meta: any, extras: Record<string, any> = {}) {
    describe(`${name} [TC-F04]`, () => {
        it('validates with minimal required fields', () => {
            const result = schema.safeParse({ blockType, ...extras })
            expect(result.success).toBe(true)
        })

        it('rejects wrong blockType', () => {
            const result = schema.safeParse({ blockType: 'wrong', ...extras })
            expect(result.success).toBe(false)
        })

        it('meta has correct type', () => {
            expect(meta.type).toBe(blockType)
        })

        it('meta has name and description', () => {
            expect(meta.name.length).toBeGreaterThan(0)
            expect(meta.description.length).toBeGreaterThan(0)
        })

        it('meta has at least 1 variant', () => {
            expect(meta.variants.length).toBeGreaterThan(0)
        })

        it('meta has editableFields', () => {
            expect(Array.isArray(meta.editableFields)).toBe(true)
        })
    })
}

// ─── About ────────────────────────────────────────────────────────────
testSchema('AboutConfigSchema', AboutConfigSchema, 'about', aboutMeta, {
    headline: 'Our Story',
})

describe('AboutConfigSchema — variants', () => {
    it('accepts valid variant image-right', () => {
        const r = AboutConfigSchema.safeParse({ blockType: 'about', headline: 'X', variant: 'simple' })
        expect(r.success).toBe(true)
    })
    it('rejects invalid variant', () => {
        const r = AboutConfigSchema.safeParse({ blockType: 'about', headline: 'X', variant: 'invalid' })
        expect(r.success).toBe(false)
    })
})

// ─── Contact ──────────────────────────────────────────────────────────
testSchema('ContactConfigSchema', ContactConfigSchema, 'contact', contactMeta)

describe('ContactConfigSchema — formFields', () => {
    it('validates form fields with required structure', () => {
        const r = ContactConfigSchema.safeParse({
            blockType: 'contact',
            formFields: [
                { label: 'Name', fieldName: 'name' },
                { label: 'Email', fieldName: 'email', fieldType: 'email', required: true },
            ],
        })
        expect(r.success).toBe(true)
    })
})

// ─── CTA ──────────────────────────────────────────────────────────────
testSchema('CTAConfigSchema', CTAConfigSchema, 'cta', ctaMeta, {
    headline: 'Get Started', ctaLabel: 'Sign Up', ctaUrl: '/signup',
})

// ─── FAQ ──────────────────────────────────────────────────────────────
testSchema('FAQConfigSchema', FAQConfigSchema, 'faq', faqMeta)

describe('FAQConfigSchema — items', () => {
    it('validates FAQ items with question/answer', () => {
        const r = FAQConfigSchema.safeParse({
            blockType: 'faq',
            items: [{ question: 'What?', answer: 'This.' }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Features ─────────────────────────────────────────────────────────
testSchema('FeaturesConfigSchema', FeaturesConfigSchema, 'features', featuresMeta, {
    headline: 'Features',
})

describe('FeaturesConfigSchema — features array', () => {
    it('validates features with icon/title/description', () => {
        const r = FeaturesConfigSchema.safeParse({
            blockType: 'features',
            headline: 'Services',
            features: [{ icon: '🚀', title: 'Fast', description: 'Very fast' }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Footer ───────────────────────────────────────────────────────────
testSchema('FooterConfigSchema', FooterConfigSchema, 'footer', footerMeta)

describe('FooterConfigSchema — columns', () => {
    it('validates footer columns with links', () => {
        const r = FooterConfigSchema.safeParse({
            blockType: 'footer',
            columns: [{ title: 'Links', links: [{ label: 'Home', url: '/' }] }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Gallery ──────────────────────────────────────────────────────────
testSchema('GalleryConfigSchema', GalleryConfigSchema, 'gallery', galleryMeta)

// ─── Hero (already tested in block-configs.test.ts, add variant coverage)
testSchema('HeroConfigSchema', HeroConfigSchema, 'hero', heroMeta, {
    headline: 'Welcome',
})

// ─── Logo Cloud ───────────────────────────────────────────────────────
testSchema('LogoCloudConfigSchema', LogoCloudConfigSchema, 'logo-cloud', logoCloudMeta)

// ─── Navigation ───────────────────────────────────────────────────────
testSchema('NavigationConfigSchema', NavigationConfigSchema, 'navigation', navigationMeta)

describe('NavigationConfigSchema — links + CTA', () => {
    it('validates nav with links and CTA button', () => {
        const r = NavigationConfigSchema.safeParse({
            blockType: 'navigation',
            logoText: 'MySite',
            links: [{ label: 'Home', url: '/' }],
            ctaButton: { show: true, label: 'Contact', url: '/contact' },
        })
        expect(r.success).toBe(true)
    })
})

// ─── Newsletter ───────────────────────────────────────────────────────
testSchema('NewsletterConfigSchema', NewsletterConfigSchema, 'newsletter', newsletterMeta)

describe('NewsletterConfigSchema — defaults', () => {
    it('defaults buttonLabel to Subscribe', () => {
        const r = NewsletterConfigSchema.safeParse({ blockType: 'newsletter' })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.buttonLabel).toBe('Subscribe')
    })
})

// ─── Pricing ──────────────────────────────────────────────────────────
testSchema('PricingConfigSchema', PricingConfigSchema, 'pricing', pricingMeta)

describe('PricingConfigSchema — plans', () => {
    it('validates pricing plan structure', () => {
        const r = PricingConfigSchema.safeParse({
            blockType: 'pricing',
            plans: [{
                name: 'Pro',
                price: 'RM 99/mo',
                features: ['Feature 1'],
                highlighted: true,
                ctaLabel: 'Get Pro',
                ctaUrl: '/signup',
            }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Stats ────────────────────────────────────────────────────────────
testSchema('StatsConfigSchema', StatsConfigSchema, 'stats', statsMeta)

describe('StatsConfigSchema — stats items', () => {
    it('validates stats with value/label', () => {
        const r = StatsConfigSchema.safeParse({
            blockType: 'stats',
            stats: [{ value: '500+', label: 'Customers' }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Team ─────────────────────────────────────────────────────────────
testSchema('TeamConfigSchema', TeamConfigSchema, 'team', teamMeta)

describe('TeamConfigSchema — members', () => {
    it('validates team member structure', () => {
        const r = TeamConfigSchema.safeParse({
            blockType: 'team',
            members: [{ name: 'John', role: 'CEO' }],
        })
        expect(r.success).toBe(true)
    })
})

// ─── Testimonials ─────────────────────────────────────────────────────
testSchema('TestimonialsConfigSchema', TestimonialsConfigSchema, 'testimonials', testimonialsMeta)

describe('TestimonialsConfigSchema — testimonials', () => {
    it('validates testimonial with quote/name', () => {
        const r = TestimonialsConfigSchema.safeParse({
            blockType: 'testimonials',
            testimonials: [{ quote: 'Great!', name: 'Sarah', rating: 5 }],
        })
        expect(r.success).toBe(true)
    })
    it('clamps rating 1-5', () => {
        const r = TestimonialsConfigSchema.safeParse({
            blockType: 'testimonials',
            testimonials: [{ quote: 'X', name: 'Y', rating: 10 }],
        })
        expect(r.success).toBe(false)
    })
})

// ─── Video ────────────────────────────────────────────────────────────
testSchema('VideoConfigSchema', VideoConfigSchema, 'video', videoMeta, {
    videoUrl: 'https://youtube.com/watch?v=123',
})

// ─── Blog List ────────────────────────────────────────────────────────
testSchema('BlogListConfigSchema', BlogListConfigSchema, 'blog-list', blogListMeta)

describe('BlogListConfigSchema — limit', () => {
    it('defaults limit to 3', () => {
        const r = BlogListConfigSchema.safeParse({ blockType: 'blog-list' })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.limit).toBe(3)
    })
    it('rejects limit > 20', () => {
        const r = BlogListConfigSchema.safeParse({ blockType: 'blog-list', limit: 25 })
        expect(r.success).toBe(false)
    })
    it('preserves localized display labels', () => {
        const r = BlogListConfigSchema.safeParse({
            blockType: 'blog-list',
            readArticleLabel: 'Lire l’article',
            uncategorizedLabel: 'Sans catégorie',
            emptyStateLabel: 'Aucun article publié pour le moment.',
        })
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.data.readArticleLabel).toBe('Lire l’article')
            expect(r.data.uncategorizedLabel).toBe('Sans catégorie')
            expect(r.data.emptyStateLabel).toBe('Aucun article publié pour le moment.')
        }
    })
})

// ─── Custom HTML ──────────────────────────────────────────────────────
testSchema('CustomHtmlConfigSchema', CustomHtmlConfigSchema, 'custom-html', customHtmlMeta, {
    html: '<div>Custom content</div>',
})

describe('CustomHtmlConfigSchema — html required', () => {
    it('rejects empty html', () => {
        const r = CustomHtmlConfigSchema.safeParse({ blockType: 'custom-html', html: '' })
        expect(r.success).toBe(false)
    })
})

// ─── Products Featured ────────────────────────────────────────────────
testSchema('ProductsFeaturedConfigSchema', ProductsFeaturedConfigSchema, 'products-featured', productsFeaturedMeta)

// ─── Products Grid ────────────────────────────────────────────────────
testSchema('ProductsGridConfigSchema', ProductsGridConfigSchema, 'products-grid', productsGridMeta)

describe('ProductsGridConfigSchema — limit', () => {
    it('defaults limit to 6', () => {
        const r = ProductsGridConfigSchema.safeParse({ blockType: 'products-grid' })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.limit).toBe(6)
    })
})
