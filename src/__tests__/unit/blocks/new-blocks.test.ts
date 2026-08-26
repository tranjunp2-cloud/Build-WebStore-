import { describe, it, expect } from 'vitest'
import { blockRegistry } from '@/blocks/registry'
import type { BlockMeta } from '@/blocks/types'

// ── v1.1 New Block Configs ──────────────────────────────────────────────────
import { PricingTableConfigSchema, pricingTableMeta } from '@/blocks/pricing-table/config'
import { GalleryMasonryConfigSchema, galleryMasonryMeta } from '@/blocks/gallery-masonry/config'
import { WhatsappButtonConfigSchema, whatsappButtonMeta } from '@/blocks/whatsapp-button/config'
import { GoogleMapsConfigSchema, googleMapsMeta } from '@/blocks/google-maps/config'
import { SocialProofConfigSchema, socialProofMeta } from '@/blocks/social-proof/config'
import { CountdownTimerConfigSchema, countdownTimerMeta } from '@/blocks/countdown-timer/config'
import { BeforeAfterConfigSchema, beforeAfterMeta } from '@/blocks/before-after/config'
import {
    FeatureComparisonConfigSchema,
    featureComparisonMeta,
    normalizeComparisonValues,
} from '@/blocks/feature-comparison/config'
import { DownloadCTAConfigSchema, downloadCTAMeta } from '@/blocks/download-cta/config'
import { VideoBackgroundConfigSchema, videoBackgroundMeta } from '@/blocks/video-background/config'
import { BreadcrumbConfigSchema, breadcrumbMeta } from '@/blocks/breadcrumb/config'
import { DividerConfigSchema, dividerMeta } from '@/blocks/divider/config'
import { AnnouncementBarConfigSchema, announcementBarMeta } from '@/blocks/announcement-bar/config'
import { ClientLogosConfigSchema, clientLogosMeta } from '@/blocks/client-logos/config'
import { AccordionConfigSchema, accordionMeta } from '@/blocks/accordion/config'
import { StepProcessConfigSchema, stepProcessMeta } from '@/blocks/step-process/config'
import { PortfolioGridConfigSchema, portfolioGridMeta } from '@/blocks/portfolio-grid/config'
import { MenuFoodConfigSchema, menuFoodMeta } from '@/blocks/menu-food/config'
import {
    ServiceCardsConfigSchema,
    serviceCardsGridClass,
    serviceCardsMeta,
} from '@/blocks/service-cards/config'
import { CarouselConfigSchema, carouselMeta } from '@/blocks/carousel/config'

// ─── TC-F04-NEW: New Block system configuration ────────────────────────────
// Tests for all 20 v1.1 block configs: schema validation, defaults, meta

const NEW_BLOCK_TYPES = [
    'pricing-table', 'gallery-masonry', 'whatsapp-button', 'google-maps', 'social-proof',
    'countdown-timer', 'before-after', 'feature-comparison', 'download-cta', 'video-background',
    'breadcrumb', 'divider', 'announcement-bar', 'client-logos', 'accordion',
    'step-process', 'portfolio-grid', 'menu-food', 'service-cards', 'carousel',
] as const

/** Helper: verify BlockMeta has all required fields */
function assertValidMeta(meta: BlockMeta) {
    expect(meta.type).toBeDefined()
    expect(typeof meta.type).toBe('string')
    expect(meta.name).toBeDefined()
    expect(typeof meta.name).toBe('string')
    expect(meta.description).toBeDefined()
    expect(meta.description.length).toBeGreaterThan(5)
    expect(meta.icon).toBeDefined()
    expect(meta.variants).toBeDefined()
    expect(meta.variants.length).toBeGreaterThan(0)
    expect(meta.defaultVariant).toBeDefined()
    expect(meta.variants).toContain(meta.defaultVariant)
    expect(meta.editableFields).toBeDefined()
    expect(meta.editableFields.length).toBeGreaterThan(0)
    expect(meta.quickActions).toBeDefined()
    expect(meta.quickActions.length).toBeGreaterThan(0)
}

describe('New Block Configs [TC-F04-NEW]', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. PRICING TABLE
    // ═══════════════════════════════════════════════════════════════════════
    describe('pricing-table', () => {
        it('TC-F04-NEW-01: schema validates valid pricing table with plans', () => {
            // Arrange
            const input = {
                blockType: 'pricing-table',
                headline: 'Our Plans',
                plans: [{
                    name: 'Pro', price: '$29', features: ['Feature A', 'Feature B'],
                    cta: { label: 'Get Pro', url: '/signup' },
                }],
            }
            // Act
            const result = PricingTableConfigSchema.safeParse(input)
            // Assert
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.plans).toHaveLength(1)
                expect(result.data.plans[0].name).toBe('Pro')
            }
        })

        it('TC-F04-NEW-02: schema defaults variant=columns, billingToggle=monthly, plans=[]', () => {
            const result = PricingTableConfigSchema.safeParse({ blockType: 'pricing-table' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('columns')
                expect(result.data.billingToggle).toBe('monthly')
                expect(result.data.plans).toEqual([])
            }
        })

        it('TC-F04-NEW-03: plan defaults currency=$, popular=false', () => {
            const result = PricingTableConfigSchema.safeParse({
                blockType: 'pricing-table',
                plans: [{ name: 'Basic', price: '9', features: [], cta: { label: 'Buy', url: '#' } }],
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.plans[0].currency).toBe('$')
                expect(result.data.plans[0].popular).toBe(false)
            }
        })

        it('TC-F04-NEW-04: meta has required fields', () => {
            assertValidMeta(pricingTableMeta)
            expect(pricingTableMeta.type).toBe('pricing-table')
            expect(pricingTableMeta.variants).toContain('columns')
            expect(pricingTableMeta.variants).toContain('horizontal')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 2. GALLERY MASONRY
    // ═══════════════════════════════════════════════════════════════════════
    describe('gallery-masonry', () => {
        it('TC-F04-NEW-05: schema validates with images array', () => {
            const result = GalleryMasonryConfigSchema.safeParse({
                blockType: 'gallery-masonry',
                images: [{ url: '/img1.jpg', alt: 'Photo 1' }, { url: '/img2.jpg' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.images).toHaveLength(2)
        })

        it('TC-F04-NEW-06: schema defaults variant=masonry, images=[]', () => {
            const result = GalleryMasonryConfigSchema.safeParse({ blockType: 'gallery-masonry' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('masonry')
                expect(result.data.images).toEqual([])
            }
        })

        it('TC-F04-NEW-07: meta has required fields', () => {
            assertValidMeta(galleryMasonryMeta)
            expect(galleryMasonryMeta.type).toBe('gallery-masonry')
            expect(galleryMasonryMeta.variants).toContain('grid-3')
            expect(galleryMasonryMeta.variants).toContain('grid-4')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 3. WHATSAPP BUTTON
    // ═══════════════════════════════════════════════════════════════════════
    describe('whatsapp-button', () => {
        it('TC-F04-NEW-08: schema validates with phone number', () => {
            const result = WhatsappButtonConfigSchema.safeParse({
                blockType: 'whatsapp-button',
                phoneNumber: '+60123456789',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-09: schema defaults label, position, variant', () => {
            const result = WhatsappButtonConfigSchema.safeParse({
                blockType: 'whatsapp-button',
                phoneNumber: '+1234567890',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('floating')
                expect(result.data.label).toBe('Chat with us')
                expect(result.data.position).toBe('bottom-right')
            }
        })

        it('TC-F04-NEW-10: schema rejects missing phoneNumber', () => {
            const result = WhatsappButtonConfigSchema.safeParse({ blockType: 'whatsapp-button' })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-11: meta has required fields', () => {
            assertValidMeta(whatsappButtonMeta)
            expect(whatsappButtonMeta.type).toBe('whatsapp-button')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 4. GOOGLE MAPS
    // ═══════════════════════════════════════════════════════════════════════
    describe('google-maps', () => {
        it('TC-F04-NEW-12: schema validates with embedUrl', () => {
            const result = GoogleMapsConfigSchema.safeParse({
                blockType: 'google-maps',
                embedUrl: 'https://maps.google.com/embed?q=test',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-13: schema defaults height=400, variant=full-width', () => {
            const result = GoogleMapsConfigSchema.safeParse({
                blockType: 'google-maps',
                embedUrl: 'https://maps.google.com/embed',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.height).toBe(400)
                expect(result.data.variant).toBe('full-width')
            }
        })

        it('TC-F04-NEW-14: schema accepts missing embedUrl — defaults to empty string (GH-820 fix)', () => {
            // embedUrl is optional — template-composer cannot auto-generate a real embed URL.
            // Payload creates the page with embedUrl='' so owner can fill in later via builder.
            const result = GoogleMapsConfigSchema.safeParse({ blockType: 'google-maps' })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.embedUrl).toBe('')
        })

        it('TC-F04-NEW-15: meta has required fields', () => {
            assertValidMeta(googleMapsMeta)
            expect(googleMapsMeta.type).toBe('google-maps')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 5. SOCIAL PROOF
    // ═══════════════════════════════════════════════════════════════════════
    describe('social-proof', () => {
        it('TC-F04-NEW-16: schema validates with reviews', () => {
            const result = SocialProofConfigSchema.safeParse({
                blockType: 'social-proof',
                reviews: [{ author: 'Alice', content: 'Great product!', rating: 5 }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.reviews).toHaveLength(1)
        })

        it('TC-F04-NEW-17: schema defaults variant=cards, reviews=[], rating=5', () => {
            const result = SocialProofConfigSchema.safeParse({ blockType: 'social-proof' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('cards')
                expect(result.data.reviews).toEqual([])
            }
        })

        it('TC-F04-NEW-18: rating clamped 1-5, rejects out of range', () => {
            const tooHigh = SocialProofConfigSchema.safeParse({
                blockType: 'social-proof',
                reviews: [{ author: 'Bob', content: 'Test', rating: 6 }],
            })
            expect(tooHigh.success).toBe(false)

            const tooLow = SocialProofConfigSchema.safeParse({
                blockType: 'social-proof',
                reviews: [{ author: 'Bob', content: 'Test', rating: 0 }],
            })
            expect(tooLow.success).toBe(false)
        })

        it('TC-F04-NEW-19: meta has required fields', () => {
            assertValidMeta(socialProofMeta)
            expect(socialProofMeta.type).toBe('social-proof')
            expect(socialProofMeta.variants).toContain('grid')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 6. COUNTDOWN TIMER
    // ═══════════════════════════════════════════════════════════════════════
    describe('countdown-timer', () => {
        it('TC-F04-NEW-20: schema validates with headline and targetDate', () => {
            const result = CountdownTimerConfigSchema.safeParse({
                blockType: 'countdown-timer',
                headline: 'Sale ends in',
                targetDate: '2026-12-31T23:59:59Z',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-21: schema defaults showDays/Hours/Minutes/Seconds to true', () => {
            const result = CountdownTimerConfigSchema.safeParse({
                blockType: 'countdown-timer',
                headline: 'Coming soon',
                targetDate: '2026-06-01',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.showDays).toBe(true)
                expect(result.data.showHours).toBe(true)
                expect(result.data.showMinutes).toBe(true)
                expect(result.data.showSeconds).toBe(true)
                expect(result.data.variant).toBe('banner')
            }
        })

        it('TC-F04-NEW-22: schema rejects missing headline', () => {
            const result = CountdownTimerConfigSchema.safeParse({
                blockType: 'countdown-timer',
                targetDate: '2026-12-31',
            })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-23: meta has required fields', () => {
            assertValidMeta(countdownTimerMeta)
            expect(countdownTimerMeta.type).toBe('countdown-timer')
            expect(countdownTimerMeta.variants).toContain('card')
            expect(countdownTimerMeta.variants).toContain('minimal')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 7. BEFORE / AFTER
    // ═══════════════════════════════════════════════════════════════════════
    describe('before-after', () => {
        it('TC-F04-NEW-24: schema validates with before and after images', () => {
            const result = BeforeAfterConfigSchema.safeParse({
                blockType: 'before-after',
                beforeImage: { url: '/before.jpg' },
                afterImage: { url: '/after.jpg' },
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-25: schema defaults variant=slider', () => {
            const result = BeforeAfterConfigSchema.safeParse({
                blockType: 'before-after',
                beforeImage: { url: '/b.jpg' },
                afterImage: { url: '/a.jpg' },
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.variant).toBe('slider')
        })

        it('TC-F04-NEW-26: schema rejects missing beforeImage or afterImage', () => {
            const noBefore = BeforeAfterConfigSchema.safeParse({
                blockType: 'before-after',
                afterImage: { url: '/a.jpg' },
            })
            expect(noBefore.success).toBe(false)

            const noAfter = BeforeAfterConfigSchema.safeParse({
                blockType: 'before-after',
                beforeImage: { url: '/b.jpg' },
            })
            expect(noAfter.success).toBe(false)
        })

        it('TC-F04-NEW-27: meta has required fields', () => {
            assertValidMeta(beforeAfterMeta)
            expect(beforeAfterMeta.type).toBe('before-after')
            expect(beforeAfterMeta.variants).toContain('side-by-side')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 8. FEATURE COMPARISON
    // ═══════════════════════════════════════════════════════════════════════
    describe('feature-comparison', () => {
        it('TC-F04-NEW-28: schema validates with products and features', () => {
            const result = FeatureComparisonConfigSchema.safeParse({
                blockType: 'feature-comparison',
                products: [{ name: 'Basic' }, { name: 'Pro' }],
                features: [{ name: 'Storage', values: [true, true] }, { name: 'AI', values: [false, true] }],
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.products).toHaveLength(2)
                expect(result.data.features).toHaveLength(2)
            }
        })

        it('TC-F04-NEW-29: schema defaults variant=table', () => {
            const result = FeatureComparisonConfigSchema.safeParse({
                blockType: 'feature-comparison',
                products: [{ name: 'A' }],
                features: [{ name: 'F1', values: [true] }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.variant).toBe('table')
        })

        it('TC-F04-NEW-30: schema rejects missing products', () => {
            const result = FeatureComparisonConfigSchema.safeParse({
                blockType: 'feature-comparison',
                features: [{ name: 'F1', values: [true] }],
            })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-31: meta has required fields', () => {
            assertValidMeta(featureComparisonMeta)
            expect(featureComparisonMeta.type).toBe('feature-comparison')
        })

        it('normalizes legacy null and labelled comparison values', () => {
            expect(normalizeComparisonValues(null, 3)).toEqual([false, false, false])
            expect(normalizeComparisonValues(['Yes', 'No', 'Add-on'], 3)).toEqual([true, false, false])
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 9. DOWNLOAD CTA
    // ═══════════════════════════════════════════════════════════════════════
    describe('download-cta', () => {
        it('TC-F04-NEW-32: schema validates with headline and fileUrl', () => {
            const result = DownloadCTAConfigSchema.safeParse({
                blockType: 'download-cta',
                headline: 'Free eBook',
                fileUrl: '/files/ebook.pdf',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-33: schema defaults buttonLabel=Download, requireEmail=false', () => {
            const result = DownloadCTAConfigSchema.safeParse({
                blockType: 'download-cta',
                headline: 'Guide',
                fileUrl: '/guide.pdf',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.buttonLabel).toBe('Download')
                expect(result.data.requireEmail).toBe(false)
                expect(result.data.variant).toBe('card')
            }
        })

        it('TC-F04-NEW-34: schema rejects missing fileUrl', () => {
            const result = DownloadCTAConfigSchema.safeParse({
                blockType: 'download-cta',
                headline: 'Download',
            })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-35: meta has required fields', () => {
            assertValidMeta(downloadCTAMeta)
            expect(downloadCTAMeta.type).toBe('download-cta')
            expect(downloadCTAMeta.variants).toContain('banner')
            expect(downloadCTAMeta.variants).toContain('minimal')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 10. VIDEO BACKGROUND
    // ═══════════════════════════════════════════════════════════════════════
    describe('video-background', () => {
        it('TC-F04-NEW-36: schema validates with videoUrl', () => {
            const result = VideoBackgroundConfigSchema.safeParse({
                blockType: 'video-background',
                videoUrl: 'https://cdn.example.com/video.mp4',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-37: schema defaults variant=full, overlayOpacity=50', () => {
            const result = VideoBackgroundConfigSchema.safeParse({
                blockType: 'video-background',
                videoUrl: '/video.mp4',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('full')
                expect(result.data.overlayOpacity).toBe(50)
            }
        })

        it('TC-F04-NEW-38: overlayOpacity rejects out of 0-100 range', () => {
            const tooHigh = VideoBackgroundConfigSchema.safeParse({
                blockType: 'video-background',
                videoUrl: '/v.mp4',
                overlayOpacity: 101,
            })
            expect(tooHigh.success).toBe(false)

            const tooLow = VideoBackgroundConfigSchema.safeParse({
                blockType: 'video-background',
                videoUrl: '/v.mp4',
                overlayOpacity: -1,
            })
            expect(tooLow.success).toBe(false)
        })

        it('TC-F04-NEW-39: schema accepts optional CTA object', () => {
            const result = VideoBackgroundConfigSchema.safeParse({
                blockType: 'video-background',
                videoUrl: '/v.mp4',
                cta: { label: 'Watch', url: '/watch' },
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.cta).toEqual({ label: 'Watch', url: '/watch' })
        })

        it('TC-F04-NEW-40: meta has required fields', () => {
            assertValidMeta(videoBackgroundMeta)
            expect(videoBackgroundMeta.type).toBe('video-background')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 11. BREADCRUMB
    // ═══════════════════════════════════════════════════════════════════════
    describe('breadcrumb', () => {
        it('TC-F04-NEW-41: schema validates with items', () => {
            const result = BreadcrumbConfigSchema.safeParse({
                blockType: 'breadcrumb',
                items: [{ label: 'Home', url: '/' }, { label: 'Products', url: '/products' }, { label: 'Detail' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.items).toHaveLength(3)
        })

        it('TC-F04-NEW-42: schema defaults variant=simple, items=[]', () => {
            const result = BreadcrumbConfigSchema.safeParse({ blockType: 'breadcrumb' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('simple')
                expect(result.data.items).toEqual([])
            }
        })

        it('TC-F04-NEW-43: meta has required fields', () => {
            assertValidMeta(breadcrumbMeta)
            expect(breadcrumbMeta.type).toBe('breadcrumb')
            expect(breadcrumbMeta.variants).toContain('with-icon')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 12. DIVIDER
    // ═══════════════════════════════════════════════════════════════════════
    describe('divider', () => {
        it('TC-F04-NEW-44: schema validates minimal divider', () => {
            const result = DividerConfigSchema.safeParse({ blockType: 'divider' })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-45: schema defaults variant=line, height=40', () => {
            const result = DividerConfigSchema.safeParse({ blockType: 'divider' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('line')
                expect(result.data.height).toBe(40)
            }
        })

        it('TC-F04-NEW-46: schema accepts all variant types', () => {
            for (const v of ['line', 'dots', 'wave', 'spacer'] as const) {
                const result = DividerConfigSchema.safeParse({ blockType: 'divider', variant: v })
                expect(result.success).toBe(true)
            }
        })

        it('TC-F04-NEW-47: meta has required fields', () => {
            assertValidMeta(dividerMeta)
            expect(dividerMeta.type).toBe('divider')
            expect(dividerMeta.variants).toHaveLength(4)
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 13. ANNOUNCEMENT BAR
    // ═══════════════════════════════════════════════════════════════════════
    describe('announcement-bar', () => {
        it('TC-F04-NEW-48: schema validates with message', () => {
            const result = AnnouncementBarConfigSchema.safeParse({
                blockType: 'announcement-bar',
                message: '20% off all plans this week!',
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-49: schema defaults dismissible=true, variant=gradient', () => {
            const result = AnnouncementBarConfigSchema.safeParse({
                blockType: 'announcement-bar',
                message: 'Hello',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.dismissible).toBe(true)
                expect(result.data.variant).toBe('gradient')
            }
        })

        it('TC-F04-NEW-50: schema rejects missing message', () => {
            const result = AnnouncementBarConfigSchema.safeParse({ blockType: 'announcement-bar' })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-51: meta has required fields', () => {
            assertValidMeta(announcementBarMeta)
            expect(announcementBarMeta.type).toBe('announcement-bar')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 14. CLIENT LOGOS
    // ═══════════════════════════════════════════════════════════════════════
    describe('client-logos', () => {
        it('TC-F04-NEW-52: schema validates with logos array', () => {
            const result = ClientLogosConfigSchema.safeParse({
                blockType: 'client-logos',
                logos: [{ url: '/logo1.png', alt: 'Acme Corp' }, { url: '/logo2.png', alt: 'Globex' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.logos).toHaveLength(2)
        })

        it('TC-F04-NEW-53: schema defaults variant=scroll, logos=[]', () => {
            const result = ClientLogosConfigSchema.safeParse({ blockType: 'client-logos' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('scroll')
                expect(result.data.logos).toEqual([])
            }
        })

        it('TC-F04-NEW-54: logo requires alt text', () => {
            const result = ClientLogosConfigSchema.safeParse({
                blockType: 'client-logos',
                logos: [{ url: '/logo.png' }], // missing alt
            })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-55: meta has required fields', () => {
            assertValidMeta(clientLogosMeta)
            expect(clientLogosMeta.type).toBe('client-logos')
            expect(clientLogosMeta.variants).toContain('fade')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 15. ACCORDION
    // ═══════════════════════════════════════════════════════════════════════
    describe('accordion', () => {
        it('TC-F04-NEW-56: schema validates with items', () => {
            const result = AccordionConfigSchema.safeParse({
                blockType: 'accordion',
                items: [{ title: 'Q1', content: 'Answer 1' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.items).toHaveLength(1)
        })

        it('TC-F04-NEW-57: schema defaults variant=bordered, items=[]', () => {
            const result = AccordionConfigSchema.safeParse({ blockType: 'accordion' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('bordered')
                expect(result.data.items).toEqual([])
            }
        })

        it('TC-F04-NEW-58: meta has required fields', () => {
            assertValidMeta(accordionMeta)
            expect(accordionMeta.type).toBe('accordion')
            expect(accordionMeta.variants).toContain('separated')
            expect(accordionMeta.variants).toContain('flush')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 16. STEP PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    describe('step-process', () => {
        it('TC-F04-NEW-59: schema validates with headline and steps', () => {
            const result = StepProcessConfigSchema.safeParse({
                blockType: 'step-process',
                headline: 'How It Works',
                steps: [{ title: 'Step 1', description: 'Do this first' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.steps).toHaveLength(1)
        })

        it('TC-F04-NEW-60: schema defaults variant=vertical, steps=[]', () => {
            const result = StepProcessConfigSchema.safeParse({
                blockType: 'step-process',
                headline: 'Process',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('vertical')
                expect(result.data.steps).toEqual([])
            }
        })

        it('TC-F04-NEW-61: schema rejects missing headline', () => {
            const result = StepProcessConfigSchema.safeParse({
                blockType: 'step-process',
                steps: [{ title: 'S1', description: 'D1' }],
            })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-62: meta has required fields', () => {
            assertValidMeta(stepProcessMeta)
            expect(stepProcessMeta.type).toBe('step-process')
            expect(stepProcessMeta.variants).toContain('horizontal')
            expect(stepProcessMeta.variants).toContain('alternating')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 17. PORTFOLIO GRID
    // ═══════════════════════════════════════════════════════════════════════
    describe('portfolio-grid', () => {
        it('TC-F04-NEW-63: schema validates with projects', () => {
            const result = PortfolioGridConfigSchema.safeParse({
                blockType: 'portfolio-grid',
                headline: 'Our Work',
                projects: [{
                    title: 'Project A', description: 'A cool project',
                    imageUrl: '/proj-a.jpg', category: 'Web',
                }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.projects).toHaveLength(1)
        })

        it('TC-F04-NEW-64: schema defaults variant=grid, projects=[]', () => {
            const result = PortfolioGridConfigSchema.safeParse({
                blockType: 'portfolio-grid',
                headline: 'Portfolio',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('grid')
                expect(result.data.projects).toEqual([])
            }
        })

        it('TC-F04-NEW-65: schema rejects missing headline', () => {
            const result = PortfolioGridConfigSchema.safeParse({ blockType: 'portfolio-grid' })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-66: meta has required fields', () => {
            assertValidMeta(portfolioGridMeta)
            expect(portfolioGridMeta.type).toBe('portfolio-grid')
            expect(portfolioGridMeta.variants).toContain('showcase')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 18. MENU FOOD
    // ═══════════════════════════════════════════════════════════════════════
    describe('menu-food', () => {
        it('TC-F04-NEW-67: schema validates with categories and items', () => {
            const result = MenuFoodConfigSchema.safeParse({
                blockType: 'menu-food',
                headline: 'Our Menu',
                categories: [{
                    name: 'Appetizers',
                    items: [{ name: 'Spring Rolls', price: '12', currency: 'RM' }],
                }],
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.categories).toHaveLength(1)
                expect(result.data.categories[0].items).toHaveLength(1)
            }
        })

        it('TC-F04-NEW-68: schema defaults variant=classic, categories=[], item currency=RM', () => {
            const result = MenuFoodConfigSchema.safeParse({
                blockType: 'menu-food',
                headline: 'Menu',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('classic')
                expect(result.data.categories).toEqual([])
            }
        })

        it('TC-F04-NEW-69: menu item defaults currency to RM', () => {
            const result = MenuFoodConfigSchema.safeParse({
                blockType: 'menu-food',
                headline: 'Menu',
                categories: [{
                    name: 'Mains',
                    items: [{ name: 'Nasi Lemak', price: '15' }],
                }],
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.categories[0].items[0].currency).toBe('RM')
            }
        })

        it('TC-F04-NEW-70: schema rejects missing headline', () => {
            const result = MenuFoodConfigSchema.safeParse({ blockType: 'menu-food' })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-71: meta has required fields', () => {
            assertValidMeta(menuFoodMeta)
            expect(menuFoodMeta.type).toBe('menu-food')
            expect(menuFoodMeta.variants).toContain('cards')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 19. SERVICE CARDS
    // ═══════════════════════════════════════════════════════════════════════
    describe('service-cards', () => {
        it('TC-F04-NEW-72: schema validates with services', () => {
            const result = ServiceCardsConfigSchema.safeParse({
                blockType: 'service-cards',
                headline: 'Our Services',
                services: [{
                    title: 'Web Dev', description: 'Full-stack development',
                    icon: 'code', cta: { label: 'Learn more', url: '/web-dev' },
                }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.services).toHaveLength(1)
        })

        it('TC-F04-NEW-73: schema defaults variant=grid, services=[]', () => {
            const result = ServiceCardsConfigSchema.safeParse({
                blockType: 'service-cards',
                headline: 'Services',
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('grid')
                expect(result.data.services).toEqual([])
            }
        })

        it('TC-F04-NEW-74: schema rejects missing headline', () => {
            const result = ServiceCardsConfigSchema.safeParse({ blockType: 'service-cards' })
            expect(result.success).toBe(false)
        })

        it('TC-F04-NEW-75: service cta is optional', () => {
            const result = ServiceCardsConfigSchema.safeParse({
                blockType: 'service-cards',
                headline: 'Services',
                services: [{ title: 'Consulting', description: 'Expert advice', icon: 'chat' }],
            })
            expect(result.success).toBe(true)
        })

        it('TC-F04-NEW-76: meta has required fields', () => {
            assertValidMeta(serviceCardsMeta)
            expect(serviceCardsMeta.type).toBe('service-cards')
            expect(serviceCardsMeta.variants).toContain('list')
            expect(serviceCardsMeta.variants).toContain('featured')
        })

        it('TC-GENPERF-W4-03: two services use a balanced two-column desktop grid', () => {
            // Arrange
            const itemCount = 2

            // Act
            const className = serviceCardsGridClass(itemCount)

            // Assert
            expect(className).toContain('lg:grid-cols-2')
            expect(className).not.toContain('lg:grid-cols-3')
        })

        it('TC-GENPERF-W4-03: three or more services use the standard three-column grid', () => {
            // Arrange
            const itemCount = 3

            // Act
            const className = serviceCardsGridClass(itemCount)

            // Assert
            expect(className).toContain('lg:grid-cols-3')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 20. CAROUSEL
    // ═══════════════════════════════════════════════════════════════════════
    describe('carousel', () => {
        it('TC-F04-NEW-77: schema validates with items', () => {
            const result = CarouselConfigSchema.safeParse({
                blockType: 'carousel',
                items: [{ imageUrl: '/slide1.jpg', title: 'Slide 1' }],
            })
            expect(result.success).toBe(true)
            if (result.success) expect(result.data.items).toHaveLength(1)
        })

        it('TC-F04-NEW-78: schema defaults variant=images, autoplay=true, interval=5000, items=[]', () => {
            const result = CarouselConfigSchema.safeParse({ blockType: 'carousel' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.variant).toBe('images')
                expect(result.data.autoplay).toBe(true)
                expect(result.data.interval).toBe(5000)
                expect(result.data.items).toEqual([])
            }
        })

        it('TC-F04-NEW-79: schema accepts all variant types', () => {
            for (const v of ['images', 'cards', 'testimonials'] as const) {
                const result = CarouselConfigSchema.safeParse({ blockType: 'carousel', variant: v })
                expect(result.success).toBe(true)
            }
        })

        it('TC-F04-NEW-80: meta has required fields', () => {
            assertValidMeta(carouselMeta)
            expect(carouselMeta.type).toBe('carousel')
            expect(carouselMeta.variants).toContain('testimonials')
        })
    })

    // ═══════════════════════════════════════════════════════════════════════
    // ALL BLOCKS: BaseBlockSchema defaults (isVisible)
    // ═══════════════════════════════════════════════════════════════════════
    describe('BaseBlockSchema defaults for new blocks [TC-F04-NEW]', () => {
        const schemasWithMinimalInput: Array<{ name: string; schema: typeof PricingTableConfigSchema; input: Record<string, unknown> }> = [
            { name: 'pricing-table', schema: PricingTableConfigSchema, input: { blockType: 'pricing-table' } },
            { name: 'gallery-masonry', schema: GalleryMasonryConfigSchema, input: { blockType: 'gallery-masonry' } },
            { name: 'whatsapp-button', schema: WhatsappButtonConfigSchema, input: { blockType: 'whatsapp-button', phoneNumber: '+123' } },
            { name: 'google-maps', schema: GoogleMapsConfigSchema, input: { blockType: 'google-maps', embedUrl: 'https://maps.google.com' } },
            { name: 'social-proof', schema: SocialProofConfigSchema, input: { blockType: 'social-proof' } },
            { name: 'countdown-timer', schema: CountdownTimerConfigSchema, input: { blockType: 'countdown-timer', headline: 'Soon', targetDate: '2026-12-31' } },
            { name: 'before-after', schema: BeforeAfterConfigSchema, input: { blockType: 'before-after', beforeImage: { url: '/b.jpg' }, afterImage: { url: '/a.jpg' } } },
            { name: 'feature-comparison', schema: FeatureComparisonConfigSchema, input: { blockType: 'feature-comparison', products: [{ name: 'A' }], features: [{ name: 'F', values: [true] }] } },
            { name: 'download-cta', schema: DownloadCTAConfigSchema, input: { blockType: 'download-cta', headline: 'DL', fileUrl: '/f.pdf' } },
            { name: 'video-background', schema: VideoBackgroundConfigSchema, input: { blockType: 'video-background', videoUrl: '/v.mp4' } },
            { name: 'breadcrumb', schema: BreadcrumbConfigSchema, input: { blockType: 'breadcrumb' } },
            { name: 'divider', schema: DividerConfigSchema, input: { blockType: 'divider' } },
            { name: 'announcement-bar', schema: AnnouncementBarConfigSchema, input: { blockType: 'announcement-bar', message: 'Hi' } },
            { name: 'client-logos', schema: ClientLogosConfigSchema, input: { blockType: 'client-logos' } },
            { name: 'accordion', schema: AccordionConfigSchema, input: { blockType: 'accordion' } },
            { name: 'step-process', schema: StepProcessConfigSchema, input: { blockType: 'step-process', headline: 'Steps' } },
            { name: 'portfolio-grid', schema: PortfolioGridConfigSchema, input: { blockType: 'portfolio-grid', headline: 'Work' } },
            { name: 'menu-food', schema: MenuFoodConfigSchema, input: { blockType: 'menu-food', headline: 'Menu' } },
            { name: 'service-cards', schema: ServiceCardsConfigSchema, input: { blockType: 'service-cards', headline: 'Services' } },
            { name: 'carousel', schema: CarouselConfigSchema, input: { blockType: 'carousel' } },
        ]

        it.each(schemasWithMinimalInput)(
            'TC-F04-NEW-BASE: $name defaults isVisible to true',
            ({ schema, input }) => {
                const result = schema.safeParse(input)
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.isVisible).toBe(true)
                }
            },
        )
    })

    // ═══════════════════════════════════════════════════════════════════════
    // REGISTRY INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════
    describe('Registry integration [TC-F04-NEW-REG]', () => {
        it.each(NEW_BLOCK_TYPES)(
            'TC-F04-NEW-REG: %s is registered in blockRegistry',
            (type) => {
                expect(blockRegistry.has(type)).toBe(true)
            },
        )

        it.each(NEW_BLOCK_TYPES)(
            'TC-F04-NEW-REG-META: %s has meta with type, name, variants',
            (type) => {
                const meta = blockRegistry.getBlockMeta(type)
                expect(meta).not.toBeNull()
                if (meta) {
                    expect(meta.type).toBe(type)
                    expect(meta.name).toBeDefined()
                    expect(meta.variants.length).toBeGreaterThan(0)
                }
            },
        )

        it.each(NEW_BLOCK_TYPES)(
            'TC-F04-NEW-REG-SCHEMA: %s has a validation schema',
            (type) => {
                const schema = blockRegistry.getSchema(type)
                expect(schema).not.toBeNull()
            },
        )

        it('TC-F04-NEW-REG-COUNT: all 20 new blocks are registered', () => {
            const missingBlocks = NEW_BLOCK_TYPES.filter(type => !blockRegistry.has(type))
            expect(missingBlocks).toEqual([])
        })
    })
})
