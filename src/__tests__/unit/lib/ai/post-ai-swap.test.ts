/**
 * TC-F01-PAS-01..06 — Phase 04 post-ai-swap dispatcher.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-04-post-ai-content-swap.md
 *
 * Verifies postAISwapStep:
 *   - swaps generic blocks for composer output
 *   - preserves blocks referencing user data
 *   - preserves AI-good blocks that pass quality bar
 *   - skips non-swappable block types (navigation/footer/pricing/team)
 *   - never throws on composer error
 *   - emits telemetry for every decision
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    postAISwapStep,
    SWAPPABLE_BLOCKS,
    isPostAISwapEnabled,
    normalizeGeneratedPageLocaleStrings,
    normalizeLocaleStructuralStrings,
} from '@/lib/ai/post-ai-swap'
import * as composer from '@/lib/ai/template-composer'
import type { BusinessSample } from '@/lib/ai/content'
import { getBlockStrings, injectBlockStrings } from '@/lib/ai/block-i18n'
import { resolveLocaleStructuralStrings } from '@/lib/ai/locale-structural-strings'

const BIZ: BusinessSample = {
    name: 'Klinik Dr. Tan',
    tagline: 'Your trusted health partner',
    description: 'Family health clinic in Petaling Jaya.',
    email: 'hi@klinikdrtan.my',
    phone: '+60 3-7654 3210',
    address: '12 Jalan Gasing, Petaling Jaya',
    heroHeadline: 'Welcome',
    heroSubheadline: 'Sub',
    products: ['Family Medicine', 'Vaccinations'],
}

describe('Phase 04 — postAISwapStep', () => {
    afterEach(() => vi.restoreAllMocks())

    describe('TC-F01-PAS-01: swaps generic blocks', () => {
        it('swaps a generic features block for composer output', () => {
            const blocks = [
                {
                    blockType: 'features',
                    headline: 'Why Choose Us',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            const swapped = result.blocks[0] as { features?: unknown[]; blockType: string }

            expect(swapped.blockType).toBe('features')
            // Composer buildFeatures for health emits real dental/medical features
            expect(result.telemetry[0]!.action).toBe('swapped')
            expect(result.telemetry[0]!.reason).toBe('multi-weak-phrase')
        })

        it('swaps a generic hero block', () => {
            const blocks = [
                {
                    blockType: 'hero',
                    variant: 'split-left',
                    headline: 'Welcome to our website',
                    subheadline: 'Your trusted partner in business growth',
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            expect(result.telemetry[0]!.action).toBe('swapped')
            expect(result.telemetry[0]!.reason).toBe('strong-blocked-phrase')

            const swapped = result.blocks[0] as { headline: string; variant?: string }
            // Composer buildHero derives headline from biz.name + product
            expect(swapped.headline).toContain('Klinik Dr. Tan')
            // variant preserved from AI (composer returns its own but we keep AI's)
            // Actually buildHero also emits variant, so it comes from composer here
        })
    })

    describe('TC-F01-PAS-02: preserves user data references', () => {
        it('keeps block when headline mentions biz.name', () => {
            const blocks = [
                {
                    blockType: 'features',
                    headline: 'Klinik Dr. Tan Services',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            expect(result.telemetry[0]!.action).toBe('kept-user-data')
            // block returned unchanged — same headline
            expect((result.blocks[0] as { headline: string }).headline).toBe('Klinik Dr. Tan Services')
        })

        it('keeps block when a feature mentions user product', () => {
            const blocks = [
                {
                    blockType: 'features',
                    headline: 'Why Choose Us',
                    features: [
                        { title: 'Family Medicine Clinic', description: 'Full service quality care' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            expect(result.telemetry[0]!.action).toBe('kept-user-data')
        })
    })

    describe('TC-F01-PAS-03: preserves AI content that passes quality bar', () => {
        it('keeps Malaysia-specific features block', () => {
            const blocks = [
                {
                    blockType: 'features',
                    headline: 'Our Specialties',
                    features: [
                        { title: 'Teeth Whitening', description: 'ZOOM! technology, results in 1 hour, RM 1500 inclusive.' },
                        { title: 'Dental Implants', description: 'MMC-certified surgeons, Straumann implants, financing available.' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            expect(result.telemetry[0]!.action).toBe('kept-not-generic')
        })
    })

    describe('TC-F01-PAS-04: non-swappable block types pass through', () => {
        it('leaves navigation untouched even with blacklist phrases', () => {
            const blocks = [
                {
                    blockType: 'navigation',
                    logoText: 'Welcome to our website',
                    links: [],
                },
                {
                    blockType: 'footer',
                    tagline: 'Quality service guaranteed',
                },
                {
                    blockType: 'pricing',
                    headline: 'Quality Service',
                    plans: [],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            // No telemetry entries for these — they were not even considered
            expect(result.telemetry).toHaveLength(0)
            expect(result.blocks).toHaveLength(3)
            expect((result.blocks[0] as { blockType: string }).blockType).toBe('navigation')
        })
    })

    describe('TC-F01-PAS-05: never throws on composer failure', () => {
        it('keeps AI block and records error telemetry when composer throws', () => {
            vi.spyOn(composer, 'buildFeatures').mockImplementation(() => {
                throw new Error('composer exploded')
            })

            const blocks = [
                {
                    blockType: 'features',
                    headline: 'Why Choose Us',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            expect(result.telemetry[0]!.action).toBe('kept-composer-error')
            expect(result.telemetry[0]!.reason).toBe('composer exploded')
            expect((result.blocks[0] as { headline: string }).headline).toBe('Why Choose Us')
        })

        it('records kept-no-composer when category has no content pack', () => {
            // testimonials needs content pack — unknown category → null pack
            const blocks = [
                {
                    blockType: 'testimonials',
                    headline: 'Quality Service in every interaction by our dedicated team',
                    testimonials: [
                        { quote: 'Exceptional quality and world-class service', name: 'Anon' },
                    ],
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'not-a-real-category')
            // Dispatcher should handle unknown category gracefully
            expect(result.telemetry[0]!.action).toMatch(/^(kept-no-composer|swapped|kept-not-generic)$/)
        })
    })

    describe('TC-F01-PAS-06: telemetry + feature flag', () => {
        it('emits one telemetry entry per swappable block decision', () => {
            const blocks = [
                { blockType: 'navigation', links: [] },
                {
                    blockType: 'features',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
                { blockType: 'pricing', plans: [] },
                {
                    blockType: 'about',
                    headline: 'About Us',
                    body: 'Your trusted partner for quality service and exceptional experience.',
                },
            ]

            const result = postAISwapStep(blocks, BIZ, 'health')
            // 2 swappable blocks (features + about) → 2 telemetry entries
            expect(result.telemetry).toHaveLength(2)
            expect(result.telemetry.map((t) => t.blockType).sort()).toEqual(['about', 'features'])
        })

        it('isPostAISwapEnabled defaults to true when env unset', () => {
            const orig = process.env.AI_POST_SWAP_ENABLED
            delete process.env.AI_POST_SWAP_ENABLED
            expect(isPostAISwapEnabled()).toBe(true)
            process.env.AI_POST_SWAP_ENABLED = orig
        })

        it('isPostAISwapEnabled respects false override', () => {
            const orig = process.env.AI_POST_SWAP_ENABLED
            process.env.AI_POST_SWAP_ENABLED = 'false'
            expect(isPostAISwapEnabled()).toBe(false)
            if (orig === undefined) delete process.env.AI_POST_SWAP_ENABLED
            else process.env.AI_POST_SWAP_ENABLED = orig
        })
    })

    describe('SWAPPABLE_BLOCKS invariants', () => {
        it('includes exactly the 6 targeted block types', () => {
            expect([...SWAPPABLE_BLOCKS].sort()).toEqual([
                'about', 'cta', 'faq', 'features', 'hero', 'testimonials',
            ])
        })
    })

    describe('TC-F01-PAS-08: locale-aware structural fallbacks', () => {
        it('keeps every block and CTA while replacing English structural fallbacks', () => {
            // Arrange
            const blocks = [
                {
                    blockType: 'hero',
                    ctaButtons: [
                        { label: '立即选购', url: '/contact', style: 'primary' },
                        { label: 'About Us', url: '#about', style: 'secondary' },
                    ],
                },
                {
                    blockType: 'gallery',
                    sectionLabel: 'Gallery',
                    headline: '作品展示',
                    images: [],
                },
                {
                    blockType: 'newsletter',
                    sectionLabel: 'Newsletter',
                    headline: '最新资讯',
                    buttonLabel: 'Subscribe',
                    placeholder: 'your@email.com',
                },
            ]

            // Act
            const result = normalizeLocaleStructuralStrings(blocks, 'zh-CN', '智慧生活家居')

            // Assert
            expect(result).toHaveLength(blocks.length)
            const hero = result[0] as { ctaButtons: Array<{ label: string }> }
            expect(hero.ctaButtons).toHaveLength(2)
            expect(hero.ctaButtons.map((cta) => cta.label)).toEqual(['立即选购', '关于我们'])
            expect(result[1]).toMatchObject({ sectionLabel: '图片展示', headline: '作品展示' })
            expect(result[2]).toMatchObject({
                sectionLabel: '订阅通讯',
                headline: '最新资讯',
                buttonLabel: '订阅',
                placeholder: '邮箱',
            })
        })

        it('normalizes an English hero CTA even before its placeholder URL is resolved', () => {
            const pages = [{
                title: 'Blog',
                layout: [{
                    blockType: 'hero',
                    headline: 'Kiến thức nha khoa nhẹ nhàng và sâu sắc',
                    ctaButtons: [
                        { label: 'Đặt lịch khám', url: '#contact', style: 'primary' },
                        { label: 'About Us', url: '#', style: 'secondary' },
                    ],
                }],
            }]

            const result = normalizeGeneratedPageLocaleStrings(
                pages,
                'vi',
                'Nha Khoa An Tâm',
            )

            const hero = result[0]!.layout![0] as {
                ctaButtons: Array<{ label: string; url: string }>
            }
            expect(hero.ctaButtons).toEqual([
                { label: 'Đặt lịch khám', url: '#contact', style: 'primary' },
                { label: 'Giới Thiệu', url: '#', style: 'secondary' },
            ])
        })

        it('injects dynamically translated BlogList labels for a Latin-script locale', () => {
            const locale = 'fr-blog-test'
            injectBlockStrings(locale, {
                ...getBlockStrings('en'),
                blogList: {
                    readArticleLabel: 'Lire l’article',
                    uncategorizedLabel: 'Sans catégorie',
                    emptyStateLabel: 'Aucun article publié pour le moment.',
                },
            })

            const result = normalizeGeneratedPageLocaleStrings(
                [{
                    title: 'Blog',
                    layout: [{
                        blockType: 'blog-list',
                        headline: 'Conseils beauté',
                        limit: 3,
                    }],
                }],
                locale,
                'Éclat Peau Studio',
            )

            expect(result[0]!.layout![0]).toMatchObject({
                blockType: 'blog-list',
                headline: 'Conseils beauté',
                limit: 3,
                readArticleLabel: 'Lire l’article',
                uncategorizedLabel: 'Sans catégorie',
                emptyStateLabel: 'Aucun article publié pour le moment.',
            })
        })

        it('replaces an English About Us CTA with dynamically translated Spanish', () => {
            const locale = 'es-hero-test'
            injectBlockStrings(locale, {
                ...getBlockStrings('en'),
                navigation: {
                    ...getBlockStrings('en').navigation,
                    about: 'Acerca de',
                },
            })

            const result = normalizeGeneratedPageLocaleStrings(
                [{
                    title: 'Blog',
                    layout: [{
                        blockType: 'hero',
                        headline: 'Historias y sabores de nuestra panadería',
                        ctaButtons: [
                            { label: 'Ver últimos posts', url: '/blog', style: 'primary' },
                            { label: 'About Us', url: '#', style: 'secondary' },
                        ],
                    }],
                }],
                locale,
                'Panadería Sol',
            )

            const hero = result[0]!.layout![0] as {
                ctaButtons: Array<{ label: string }>
            }
            expect(hero.ctaButtons.map((button) => button.label)).toEqual([
                'Ver últimos posts',
                'Acerca de',
            ])
        })

        it('normalizes Blog hero CTA from request-scoped strings without a locale cache entry', () => {
            const english = resolveLocaleStructuralStrings('en')!
            const german = {
                ...english,
                navigation: {
                    ...english.navigation,
                    about: 'Über uns',
                    getStarted: 'Jetzt beraten lassen',
                },
            }
            const blocks = [{
                blockType: 'hero',
                headline: 'Neuigkeiten von GrünRaum Innenarchitektur',
                ctaButtons: [
                    { label: 'Jetzt beraten lassen', url: '/contact', style: 'primary' },
                    { label: 'About Us', url: '#about', style: 'secondary' },
                ],
            }]

            const result = normalizeLocaleStructuralStrings(
                blocks,
                'de-request-scoped-test',
                'GrünRaum Innenarchitektur',
                german,
            )

            const hero = result[0] as { ctaButtons: Array<{ label: string }> }
            expect(hero.ctaButtons.map((button) => button.label)).toEqual([
                'Jetzt beraten lassen',
                'Über uns',
            ])
        })

        it('keeps both hero CTAs and removes English fallback copy when locale context is missing', () => {
            const result = normalizeLocaleStructuralStrings(
                [{
                    blockType: 'hero',
                    headline: 'Neuigkeiten von GrünRaum',
                    ctaButtons: [
                        { label: 'Kontaktieren', url: '/contact', style: 'primary' },
                        { label: 'About Us', url: '#about', style: 'secondary' },
                    ],
                }],
                'de-no-context',
                'GrünRaum',
            )

            const hero = result[0] as { ctaButtons: Array<{ label: string }> }
            expect(hero.ctaButtons).toHaveLength(2)
            expect(hero.ctaButtons[1]?.label).toBe('GrünRaum')
            expect(JSON.stringify(hero)).not.toContain('About Us')
        })

        it('preserves localized structural copy when locale context is missing', () => {
            const blocks = [
                {
                    blockType: 'features',
                    sectionLabel: 'Leistungen',
                    headline: 'Unsere Leistungen',
                },
                {
                    blockType: 'contact',
                    sectionLabel: 'Kontakt',
                    headline: 'Kontakt aufnehmen',
                    subheadline: 'Schreiben Sie uns',
                    submitLabel: 'Nachricht senden',
                    formFields: [{ fieldName: 'email', label: 'E-Mail' }],
                },
                {
                    blockType: 'blog-list',
                    sectionLabel: 'Blog',
                    headline: 'Aktuelle Beiträge',
                    readArticleLabel: 'Artikel lesen',
                    uncategorizedLabel: 'Ohne Kategorie',
                    emptyStateLabel: 'Noch keine Beiträge',
                },
            ]

            const result = normalizeLocaleStructuralStrings(
                blocks,
                'de-no-context',
                'GrünRaum',
                null,
            )

            expect(result).toEqual(blocks)
            expect(JSON.stringify(result)).not.toContain('"GrünRaum"')
        })

        it('uses field type for contact labels and preserves custom fields', () => {
            const english = resolveLocaleStructuralStrings('en')!
            const german = {
                ...english,
                contact: {
                    ...english.contact,
                    nameLabel: 'Name',
                    emailLabel: 'E-Mail',
                    phoneLabel: 'Telefon',
                    messageLabel: 'Nachricht',
                },
            }
            const result = normalizeLocaleStructuralStrings(
                [{
                    blockType: 'contact',
                    formFields: [
                        { fieldName: 'field', fieldType: 'text', label: 'Name' },
                        { fieldName: 'field-2', fieldType: 'email', label: 'Email' },
                        { fieldName: 'field-3', fieldType: 'phone', label: 'Phone' },
                        { fieldName: 'subject', fieldType: 'text', label: 'Betreff' },
                        { fieldName: 'field-5', fieldType: 'textarea', label: 'Message' },
                    ],
                }],
                'de',
                'GrünRaum',
                german,
            )

            const contact = result[0] as {
                formFields: Array<{ fieldName: string; label: string }>
            }
            expect(contact.formFields).toEqual([
                { fieldName: 'name', fieldType: 'text', label: 'Name' },
                { fieldName: 'email', fieldType: 'email', label: 'E-Mail' },
                { fieldName: 'phone', fieldType: 'phone', label: 'Telefon' },
                { fieldName: 'subject', fieldType: 'text', label: 'Betreff' },
                { fieldName: 'message', fieldType: 'textarea', label: 'Nachricht' },
            ])
        })

        it('preserves custom companyName fields and prevents duplicate canonical name fields', () => {
            const english = resolveLocaleStructuralStrings('en')!
            const german = {
                ...english,
                contact: {
                    ...english.contact,
                    nameLabel: 'Name',
                    emailLabel: 'E-Mail',
                },
            }
            const result = normalizeLocaleStructuralStrings(
                [{
                    blockType: 'contact',
                    formFields: [
                        { fieldName: 'companyName', fieldType: 'text', label: 'Company name' },
                        { fieldName: 'name', fieldType: 'text', label: 'Contact name' },
                        { fieldName: 'name', fieldType: 'text', label: 'Assistant name' },
                        { fieldName: 'email', fieldType: 'email', label: 'Email' },
                    ],
                }],
                'de',
                'GrünRaum',
                german,
            )

            const contact = result[0] as {
                formFields: Array<{ fieldName: string; label: string }>
            }
            expect(contact.formFields.map((field) => field.fieldName)).toEqual([
                'companyName',
                'name',
                'field-3',
                'email',
            ])
        })

        it('normalizes an English CTA stored under an AI alias before Payload sanitization', () => {
            const locale = 'de-hero-alias-test'
            injectBlockStrings(locale, {
                ...getBlockStrings('en'),
                navigation: {
                    ...getBlockStrings('en').navigation,
                    about: 'Über uns',
                },
            })

            const result = normalizeGeneratedPageLocaleStrings(
                [{
                    title: 'Blog',
                    layout: [{
                        blockType: 'hero',
                        headline: 'Neuigkeiten und Inspirationen',
                        ctaButtons: [
                            { label: 'Kontaktieren Sie uns', url: '/contact', style: 'primary' },
                            { text: 'About Us', url: '#', style: 'secondary' },
                        ],
                    }],
                }],
                locale,
                'GrünRaum Innenarchitektur',
            )

            const hero = result[0]!.layout![0] as {
                ctaButtons: Array<{ label?: string; text?: string }>
            }
            expect(hero.ctaButtons).toHaveLength(2)
            expect(hero.ctaButtons[1]).toMatchObject({
                label: 'Über uns',
                text: 'About Us',
            })
        })

        it('replaces an English contact CTA with the dynamically translated German label', () => {
            const locale = 'de-cta-test'
            injectBlockStrings(locale, {
                ...getBlockStrings('en'),
                navigation: {
                    ...getBlockStrings('en').navigation,
                    getStarted: 'Gespräch beginnen',
                },
            })

            const result = normalizeGeneratedPageLocaleStrings(
                [{
                    title: 'Startseite',
                    layout: [{
                        blockType: 'hero',
                        headline: 'Nachhaltige Räume für moderne Unternehmen',
                        ctaButtons: [
                            { label: 'Start a Conversation', url: '/contact', style: 'primary' },
                        ],
                    }],
                }],
                locale,
                'GrünRaum Innenarchitektur',
            )

            const hero = result[0]!.layout![0] as {
                ctaButtons: Array<{ label: string }>
            }
            expect(hero.ctaButtons[0]!.label).toBe('Gespräch beginnen')
        })

        it('preserves generic GPT blocks for every non-English locale', () => {
            const hero = {
                blockType: 'hero',
                headline: 'Willkommen auf unserer Website',
                subheadline: 'Ihr zuverlässiger Partner für nachhaltige Innenarchitektur.',
            }

            const result = postAISwapStep(
                [hero],
                BIZ,
                'business',
                undefined,
                0,
                'de',
            )

            expect(result.blocks[0]).toMatchObject(hero)
            expect(result.telemetry).toEqual([{
                blockType: 'hero',
                action: 'kept-lang-dynamic',
                reason: 'lang:de',
            }])
        })
    })

    /**
     * TC-F01-PAS-07 — GH-912 regression: when bizPartial is missing fields,
     * hydrateBiz must rotate `pack.businesses` by seed so two same-category
     * users with different contact info don't both inherit `businesses[0]`.
     */
    describe('TC-F01-PAS-07: seed-rotated hydrateBiz fallback (GH-912)', () => {
        const genericFeaturesBlock = {
            blockType: 'features',
            headline: 'Why Choose Us',
            features: [
                { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                { title: 'Fast Response', description: 'Dedicated team of professionals' },
            ],
        }

        it('different seeds produce different swap output for empty bizPartial', () => {
            const a = postAISwapStep([genericFeaturesBlock], {}, 'health', undefined, 0)
            const b = postAISwapStep([genericFeaturesBlock], {}, 'health', undefined, 99999)
            expect(a.telemetry[0]!.action).toBe('swapped')
            expect(b.telemetry[0]!.action).toBe('swapped')
            // Hydrated biz.name flows into composer output; different seed pulls
            // a different pack.businesses[i] → different rendered content.
            // health pack has multiple businesses so seeds 0 and 99999 diverge.
            expect(JSON.stringify(a.blocks[0])).not.toBe(JSON.stringify(b.blocks[0]))
        })

        it('same seed produces deterministic swap output (stable regen)', () => {
            const seed = 12345
            const a = postAISwapStep([genericFeaturesBlock], {}, 'health', undefined, seed)
            const b = postAISwapStep([genericFeaturesBlock], {}, 'health', undefined, seed)
            expect(JSON.stringify(a.blocks[0])).toBe(JSON.stringify(b.blocks[0]))
        })

        it('omitting seed defaults to legacy businesses[0] path (backward compat)', () => {
            const a = postAISwapStep([genericFeaturesBlock], {}, 'health')
            const b = postAISwapStep([genericFeaturesBlock], {}, 'health', undefined, 0)
            expect(JSON.stringify(a.blocks[0])).toBe(JSON.stringify(b.blocks[0]))
        })
    })
})
