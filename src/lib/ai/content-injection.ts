/**
 * Content injection helper — builds block shapes from the curated content
 * library (src/lib/ai/content/*.ts) for gap-filling and item padding.
 *
 * Used by structure-enforcer.ts to:
 *   1. Inject missing mandatory blocks (e.g. beauty must have `team`)
 *   2. Pad item counts (e.g. testimonials: 2 → 4)
 *
 * NOT a replacement for AI — just fills gaps when AI underdelivers.
 *
 * Plan: 260414-1400-ai-gen-unsplash-pipeline phase-05
 */

import { getCategoryContent } from './content'
import type { BusinessSample, TestimonialSample, FAQSample } from './content'
import { ITEM_FIELD_BY_BLOCK } from './category-requirements'
import { hashString, seededShuffle, seededShufflePick } from './seeded-random'
import type { ThemeMood } from './theme-moods'
import { getCategoryCTA } from './theme-moods'

export interface InjectionContext {
    businessName?: string
    industry?: string
    seed?: number
    /**
     * Plan 260414-2249 phase-07: optional user-supplied business fields
     * merged over canned content. When provided, library blocks weave in
     * user data (name / description / products / contact) instead of the
     * canned strings. Backward-compatible: if absent, behaves as today.
     */
    userBiz?: Partial<BusinessSample>
    /**
     * Plan 260414-2249 phase-07: optional resolved theme mood. When
     * provided, hero + cta blocks emit mood-derived CTA labels via
     * `getCategoryCTA`. Backward-compatible — legacy "Get Started" /
     * "Contact Us" labels remain when mood is absent.
     */
    mood?: ThemeMood
}

// ── Plan 07 helpers — threading user data into canned library blocks ─────

/** Truncate a string on a word boundary so the tail is never mid-word. */
function truncateOnWord(str: string, maxChars: number): string {
    if (!str) return ''
    if (str.length <= maxChars) return str
    const sliced = str.slice(0, maxChars - 1)
    const lastSpace = sliced.lastIndexOf(' ')
    if (lastSpace > maxChars * 0.6) return sliced.slice(0, lastSpace).trimEnd() + '…'
    return sliced.trimEnd() + '…'
}

/** Cap a string at `maxWords`; keeps words intact. */
function capWords(str: string, maxWords: number): string {
    if (!str) return ''
    const words = str.split(/\s+/).filter(Boolean)
    if (words.length <= maxWords) return words.join(' ')
    return words.slice(0, maxWords).join(' ')
}

function capitalizeFirstLetter(s: string): string {
    if (!s) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Resolve mood CTA with defensive fallback to the legacy labels. */
function resolveLibraryCTA(
    mood: ThemeMood | undefined,
    category: string,
    role: 'primary' | 'secondary',
): string {
    if (mood) return getCategoryCTA(mood, category, role)
    return role === 'primary' ? 'Get Started' : 'Learn More'
}

/**
 * Weave user biz into a hero block. Builds headline from user name + first
 * product / first words of description, subheadline from user description.
 * When userBiz is empty, returns null so caller keeps the canned hero.
 */
function threadHeroBiz(
    userBiz: Partial<BusinessSample> | undefined,
    mood: ThemeMood | undefined,
    category: string,
): { headline: string; subheadline: string; ctaPrimary: string; ctaSecondary: string } | null {
    if (!userBiz) return null
    const name = (userBiz.name ?? '').trim()
    const description = (userBiz.description ?? '').trim()
    const topProduct = userBiz.products?.[0]?.trim() || undefined
    if (!name && !description && !topProduct) return null

    // Headline: "{name} — {tail}" where tail is a topProduct or the first 5 words of description.
    const descWords = description.split(/\s+/).filter(Boolean)
    const tail = topProduct
        ? capitalizeFirstLetter(topProduct)
        : descWords.length >= 3
            ? descWords.slice(0, 5).join(' ')
            : ''
    const anchor = name || 'Welcome'
    const headlineRaw = tail ? `${anchor} — ${tail}` : anchor
    // Consistency rule C3 — cap hero headline at 10 words.
    const headline = capWords(headlineRaw, 10)

    // Subheadline: first 140 chars of description on word boundary.
    const subheadline = description
        ? truncateOnWord(description, 140)
        : `Discover ${name || 'our services'} — quality you can count on.`

    return {
        headline,
        subheadline,
        ctaPrimary: resolveLibraryCTA(mood, category, 'primary'),
        ctaSecondary: resolveLibraryCTA(mood, category, 'secondary'),
    }
}

type Block = Record<string, unknown>

function substituteBusinessName(str: string, name?: string): string {
    if (!name) return str
    return str.replace(/\$\{businessName\}/g, name).replace(/\{businessName\}/g, name)
}

/**
 * Plan 2253 Phase 03 amendment v3 — originally used modulo which had the same
 * djb2 clustering bug as R3. Now delegates to shared `seededShufflePick`
 * (Fisher-Yates) so same-category businesses land on different BusinessSamples.
 */
function pickSeeded<T>(arr: readonly T[], seed: number): T | undefined {
    return seededShufflePick(arr, seed)
}

/**
 * Shuffle a pool of items by seed so different businesses in the same category
 * pull different subsets / orderings.
 *
 * Plan 2253 Phase 03 — fixes R5 (padItems reuse). Originally used modulo
 * rotation which re-introduced the R3 clustering bug (common business names
 * collide on `seed % pool.length`). Now uses Fisher-Yates seeded shuffle via
 * `seededShuffle` — same helper Phase 02 uses for theme preset distribution.
 *
 * Plan 2253 Phase 03 amendment (2026-04-15) after variety-delta measurement
 * showed testimonial collision regressed on 4/5 categories due to the modulo
 * variant of this helper.
 */
function rotateSlice<T>(pool: readonly T[], seed: number): T[] {
    if (pool.length === 0) return []
    return seededShuffle(pool, seed)
}

/** Normalized testimonial for Zod schema shape. */
function mapTestimonial(t: TestimonialSample): Block {
    return {
        quote: t.quote,
        name: t.name,
        title: t.title ?? 'Customer',
        company: t.company ?? '',
        rating: t.rating,
    }
}

function mapFaq(f: FAQSample): Block {
    return { question: f.question, answer: f.answer }
}

/**
 * Build a fully-formed block from the content library.
 * Returns null if no suitable content exists for (blockType, category).
 */
export function buildBlockFromLibrary(
    blockType: string,
    category: string,
    ctx: InjectionContext = {},
): Block | null {
    // Fallback to 'business' category content when category is unknown — ensures
    // gap-filler can still inject generic blocks for long-tail industries.
    const content = getCategoryContent(category) ?? getCategoryContent('business')
    if (!content) return null

    // Plan 2253 Phase 03 — fixes R4 (businesses[0] hardcode).
    // Rotate the BusinessSample pick by seed so different businesses in the same
    // category inject different canned copy + tagline + description when the AI
    // underfills and structure-enforcer has to gap-fill.
    const bizSeed = ctx.seed ?? 0
    const biz: BusinessSample | undefined =
        pickSeeded(content.businesses, bizSeed) ?? content.businesses[0]
    // Plan 07 — user-supplied fields override canned samples.
    const userBiz = ctx.userBiz
    const name = userBiz?.name ?? ctx.businessName ?? biz?.name ?? 'Our Business'
    const userDescription = userBiz?.description?.trim() || undefined
    const userTagline = userBiz?.tagline?.trim() || undefined
    const userProducts = (userBiz?.products ?? []).filter((p) => p && p.trim().length > 0)
    const userPhone = userBiz?.phone?.trim() || undefined
    const userEmail = userBiz?.email?.trim() || undefined
    const userAddress = userBiz?.address?.trim() || undefined

    // Seed-rotated content pool slices for testimonials / faqs / features so
    // within-category businesses pull different subsets of the library.
    const testimonialSlice = rotateSlice(content.testimonials, bizSeed)
    const faqSlice = rotateSlice(content.faqItems, bizSeed ^ hashString('faq'))

    switch (blockType) {
        case 'navigation':
            return {
                blockType: 'navigation',
                variant: 'pill',
                logoText: name,
                links: [
                    { label: 'Home', url: '/' },
                    { label: 'About', url: '/about' },
                    { label: 'Services', url: '/services' },
                    { label: 'Contact', url: '/contact' },
                ],
                ctaButton: { show: true, label: 'Get Started', url: '/contact' },
            }

        case 'hero': {
            // Plan 07 — prefer user-threaded hero when any user field is present.
            const userHero = threadHeroBiz(userBiz, ctx.mood, category)
            const headline = userHero?.headline
                ?? substituteBusinessName(biz?.heroHeadline ?? `Welcome to ${name}`, name)
            const subheadline = userHero?.subheadline
                ?? substituteBusinessName(
                    biz?.heroSubheadline ?? biz?.description ?? 'Quality service for every customer.',
                    name,
                )
            const primaryLabel = userHero?.ctaPrimary ?? resolveLibraryCTA(ctx.mood, category, 'primary')
            const secondaryLabel = userHero?.ctaSecondary ?? resolveLibraryCTA(ctx.mood, category, 'secondary')
            return {
                blockType: 'hero',
                variant: 'gradient',
                headline,
                subheadline,
                ctaButtons: [
                    { label: primaryLabel, url: '/contact', style: 'primary' },
                    { label: secondaryLabel, url: '/about', style: 'secondary' },
                ],
            }
        }

        case 'about':
            return {
                blockType: 'about',
                variant: 'simple',
                headline: `About ${name}`,
                // Plan 07 — prefer user description, fall back to canned pool.
                body: userDescription
                    ?? biz?.description
                    ?? `${name} is dedicated to delivering exceptional experiences to every customer.`,
            }

        case 'testimonials':
            return {
                blockType: 'testimonials',
                variant: 'cards',
                headline: 'What Our Customers Say',
                testimonials: testimonialSlice.slice(0, 4).map(mapTestimonial),
            }

        case 'faq':
            return {
                blockType: 'faq',
                variant: 'accordion',
                headline: 'Frequently Asked Questions',
                items: faqSlice.slice(0, 5).map(mapFaq),
            }

        case 'cta':
            return {
                blockType: 'cta',
                variant: 'banner',
                headline: `Ready to experience ${name}?`,
                // Plan 07 — user tagline > canned tagline > generic.
                subheadline:
                    userTagline
                    ?? (userDescription ? truncateOnWord(userDescription, 140) : undefined)
                    ?? biz?.tagline
                    ?? 'Get in touch today and let us exceed your expectations.',
                ctaButton: {
                    label: resolveLibraryCTA(ctx.mood, category, 'primary'),
                    url: '/contact',
                    style: 'primary',
                },
            }

        case 'contact':
            return {
                blockType: 'contact',
                variant: 'form',
                headline: 'Get in Touch',
                subheadline: 'We would love to hear from you. Send us a message.',
                // Plan 07 — user-supplied contact fields win over canned pool.
                address: userAddress ?? biz?.address ?? '',
                phone: userPhone ?? biz?.phone ?? '',
                email: userEmail ?? biz?.email ?? '',
                formFields: [
                    { fieldName: 'name', label: 'Name', fieldType: 'text', required: true },
                    { fieldName: 'email', label: 'Email', fieldType: 'email', required: true },
                    { fieldName: 'message', label: 'Message', fieldType: 'textarea', required: true },
                ],
            }

        case 'footer':
            return {
                blockType: 'footer',
                variant: 'simple',
                logoText: name,
                // Plan 07 — user tagline/description wins over canned.
                tagline: userTagline ?? (userDescription ? truncateOnWord(userDescription, 90) : biz?.tagline ?? ''),
                copyrightText: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
                columns: [
                    { title: 'Explore', links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }] },
                    { title: 'Contact', links: [{ label: 'Contact Us', url: '/contact' }] },
                ],
            }

        case 'features': {
            // Plan 2253 Phase 03 amendment v3 — shuffle + slice from 8-item pool
            // by compound seed so same-category businesses inject different
            // first 4 features, killing the "Quality Service / Fast Response..."
            // collision observed in post-fix-v2 measurement.
            const pool = [
                { icon: '⭐', title: 'Quality Service', description: 'Exceptional quality in every interaction.' },
                { icon: '🚀', title: 'Fast Response', description: 'Quick turnaround on all requests.' },
                { icon: '💎', title: 'Premium Experience', description: 'Carefully crafted for discerning customers.' },
                { icon: '🛡️', title: 'Trusted & Reliable', description: 'Years of consistent service excellence.' },
                { icon: '🎯', title: 'Results-Focused', description: 'Measurable outcomes you can count on.' },
                { icon: '🤝', title: 'Personal Attention', description: 'Every client matters to us.' },
                { icon: '✨', title: 'Craftsmanship', description: 'Details that make a lasting impression.' },
                { icon: '📈', title: 'Proven Track Record', description: 'Trusted by hundreds of satisfied clients.' },
            ]
            const shuffled = seededShuffle(pool, bizSeed ^ hashString('features'))

            // Plan 07 — when the user supplied ≥2 products, replace the first
            // cards with product-derived titles so same-category businesses
            // emit different features on the enforcer-padded path.
            let features = shuffled.slice(0, 4)
            if (userProducts.length >= 2) {
                const productCards = userProducts.slice(0, 4).map((product, idx) => {
                    const base = shuffled[idx] ?? shuffled[0]!
                    const capitalized = capitalizeFirstLetter(product)
                    return {
                        icon: base.icon,
                        title: `${capitalized}`,
                        description: `Our signature ${product} — a favourite with every ${name} guest.`,
                    }
                })
                // Pad to 4 cards from the shuffled canned pool when user has < 4 products.
                const needed = Math.max(0, 4 - productCards.length)
                features = productCards.concat(shuffled.slice(4, 4 + needed))
            }

            return {
                blockType: 'features',
                variant: 'grid-3',
                // Plan 07 — headline references biz name so same-category variants diverge.
                headline: `Why Choose ${name}`,
                features,
            }
        }

        case 'stats': {
            const pool = [
                { value: '500+', label: 'Happy Customers' },
                { value: '10+', label: 'Years Experience' },
                { value: '4.9★', label: 'Average Rating' },
                { value: '98%', label: 'Satisfaction Rate' },
                { value: '24/7', label: 'Support Available' },
                { value: '1M+', label: 'Projects Delivered' },
            ]
            const shuffled = seededShuffle(pool, bizSeed ^ hashString('stats'))
            return {
                blockType: 'stats',
                variant: 'row',
                headline: 'Our Impact',
                stats: shuffled.slice(0, 3),
            }
        }

        case 'team': {
            // Note: Payload schema uses `image` field (not `avatar`) for member photos.
            // Media pipeline fills this via BLOCK_IMAGE_SPEC.team.
            const pool = [
                { name: 'Team Lead', role: 'Founder', bio: 'Passionate about delivering great experiences.' },
                { name: 'Senior Specialist', role: 'Expert', bio: 'Years of experience in the field.' },
                { name: 'Customer Success', role: 'Support Lead', bio: 'Dedicated to your satisfaction.' },
                { name: 'Creative Director', role: 'Design Lead', bio: 'Obsessed with craft and detail.' },
                { name: 'Operations Manager', role: 'Ops Lead', bio: 'Keeps every project on track.' },
                { name: 'Client Partner', role: 'Account Lead', bio: 'Your trusted point of contact.' },
            ]
            const shuffled = seededShuffle(pool, bizSeed ^ hashString('team'))
            return {
                blockType: 'team',
                variant: 'grid',
                headline: 'Meet Our Team',
                members: shuffled.slice(0, 3),
            }
        }

        case 'service-cards': {
            const pool = [
                { icon: '⭐', title: 'Premium Service', description: 'Our flagship offering.' },
                { icon: '🚀', title: 'Fast Delivery', description: 'Quick turnaround on every job.' },
                { icon: '💎', title: 'Custom Solutions', description: 'Tailored to your needs.' },
                { icon: '🛡️', title: 'Ongoing Support', description: 'We stand behind our work.' },
                { icon: '🎨', title: 'Expert Consultation', description: 'Guidance from seasoned professionals.' },
                { icon: '🔧', title: 'Flexible Options', description: 'Packages that fit every need.' },
                { icon: '✅', title: 'Guaranteed Results', description: 'Quality you can measure.' },
                { icon: '📞', title: 'Dedicated Account Manager', description: 'One point of contact, always.' },
            ]
            const shuffled = seededShuffle(pool, bizSeed ^ hashString('service-cards'))
            return {
                blockType: 'service-cards',
                variant: 'grid',
                headline: 'Our Services',
                services: shuffled.slice(0, 4),
            }
        }

        case 'gallery':
            return {
                blockType: 'gallery',
                variant: 'grid',
                headline: 'Our Work',
                // Empty images array — media-injector fills from Unsplash
                images: Array.from({ length: 6 }, () => ({})),
            }

        case 'newsletter':
            return {
                blockType: 'newsletter',
                variant: 'banner',
                headline: `Stay Updated with ${name}`,
                subheadline:
                    userTagline
                    ?? (userDescription ? truncateOnWord(userDescription, 140) : undefined)
                    ?? 'Subscribe for exclusive news and offers.',
                buttonLabel: 'Subscribe',
                placeholder: 'your@email.com',
            }

        case 'pricing':
            return {
                blockType: 'pricing',
                variant: 'cards',
                headline: 'Simple Pricing',
                plans: [
                    {
                        name: 'Starter',
                        price: 'RM 99',
                        features: [
                            { text: 'Core features', included: true },
                            { text: 'Email support', included: true },
                        ],
                        ctaLabel: 'Get Started',
                        ctaUrl: '/contact',
                    },
                    {
                        name: 'Pro',
                        price: 'RM 299',
                        features: [
                            { text: 'All Starter features', included: true },
                            { text: 'Priority support', included: true },
                            { text: 'Advanced tools', included: true },
                        ],
                        ctaLabel: 'Choose Pro',
                        ctaUrl: '/contact',
                    },
                    {
                        name: 'Enterprise',
                        price: 'Custom',
                        features: [
                            { text: 'All Pro features', included: true },
                            { text: 'Dedicated manager', included: true },
                            { text: 'SLA guarantee', included: true },
                        ],
                        ctaLabel: 'Contact Sales',
                        ctaUrl: '/contact',
                    },
                ],
            }

        case 'logo-cloud':
            return {
                blockType: 'logo-cloud',
                variant: 'row',
                headline: 'Trusted By',
                logos: Array.from({ length: 6 }, (_, i) => ({ name: `Partner ${i + 1}` })),
            }

        default: {
            // Try industry blocks for category-specific signatures
            const sig = content.industryBlocks.find((b) => b.blockType === blockType)
            if (sig) return { ...sig } as Block
            return null
        }
    }
}

/**
 * Pad an existing item array up to `minCount` by pulling from content library.
 * Returns the padded array. Handles testimonials, faq, team, features duplication.
 *
 * Plan 2253 Phase 03 — fixes R5 (padItems pool reuse). Accepts ctx so the pool
 * start offset rotates per-business; same-category gens no longer converge on
 * the same first 4 testimonials.
 */
export function padItems(
    blockType: string,
    existing: readonly unknown[],
    minCount: number,
    category: string,
    ctx: InjectionContext = {},
): unknown[] {
    if (existing.length >= minCount) return [...existing]

    const content = getCategoryContent(category)
    const result: unknown[] = [...existing]
    const baseSeed = ctx.seed ?? 0

    if (blockType === 'testimonials' && content) {
        const pool = rotateSlice(content.testimonials, baseSeed)
        let i = 0
        while (result.length < minCount && i < pool.length) {
            const candidate = mapTestimonial(pool[i]!)
            const isDupe = result.some(
                (r) =>
                    typeof r === 'object' && r !== null && (r as Block).name === candidate.name,
            )
            if (!isDupe) result.push(candidate)
            i++
        }
    } else if (blockType === 'faq' && content) {
        const pool = rotateSlice(content.faqItems, baseSeed ^ hashString('faq'))
        let i = 0
        while (result.length < minCount && i < pool.length) {
            const candidate = mapFaq(pool[i]!)
            const isDupe = result.some(
                (r) =>
                    typeof r === 'object' && r !== null && (r as Block).question === candidate.question,
            )
            if (!isDupe) result.push(candidate)
            i++
        }
    } else {
        // Generic padding — inject from library block, dedup by `title` field
        // (features, service-cards have title). Avoids "Quality Service" appearing twice.
        const libBlock = buildBlockFromLibrary(blockType, category, ctx)
        if (libBlock) {
            const field = ITEM_FIELD_BY_BLOCK[blockType]
            if (field && Array.isArray(libBlock[field])) {
                const libItems = libBlock[field] as unknown[]
                const existingTitles = new Set(
                    result
                        .filter((r): r is Block => typeof r === 'object' && r !== null)
                        .map((r) => String((r as Block).title ?? (r as Block).name ?? '').toLowerCase())
                        .filter(Boolean),
                )
                for (const item of libItems) {
                    if (result.length >= minCount) break
                    const itemTitle = String(
                        (item as Block).title ?? (item as Block).name ?? '',
                    ).toLowerCase()
                    if (itemTitle && existingTitles.has(itemTitle)) continue
                    result.push(item)
                    if (itemTitle) existingTitles.add(itemTitle)
                }
            }
        }
    }

    return result.slice(0, Math.max(minCount, existing.length))
}
