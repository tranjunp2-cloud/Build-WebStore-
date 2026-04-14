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
import { hashString, seededShuffle } from './seeded-random'

export interface InjectionContext {
    businessName?: string
    industry?: string
    seed?: number
}

type Block = Record<string, unknown>

function substituteBusinessName(str: string, name?: string): string {
    if (!name) return str
    return str.replace(/\$\{businessName\}/g, name).replace(/\{businessName\}/g, name)
}

function pickSeeded<T>(arr: readonly T[], seed: number): T | undefined {
    if (arr.length === 0) return undefined
    const idx = Math.abs(Math.floor(seed)) % arr.length
    return arr[idx]
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
    const name = ctx.businessName ?? biz?.name ?? 'Our Business'

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

        case 'hero':
            return {
                blockType: 'hero',
                variant: 'gradient',
                headline: substituteBusinessName(biz?.heroHeadline ?? `Welcome to ${name}`, name),
                subheadline: substituteBusinessName(
                    biz?.heroSubheadline ?? biz?.description ?? 'Quality service for every customer.',
                    name,
                ),
                ctaButtons: [
                    { label: 'Get Started', url: '/contact', style: 'primary' },
                    { label: 'About Us', url: '/about', style: 'secondary' },
                ],
            }

        case 'about':
            return {
                blockType: 'about',
                variant: 'simple',
                headline: `About ${name}`,
                body: biz?.description ?? `${name} is dedicated to delivering exceptional experiences to every customer.`,
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
                subheadline: biz?.tagline ?? 'Get in touch today and let us exceed your expectations.',
                ctaButton: { label: 'Contact Us', url: '/contact', style: 'primary' },
            }

        case 'contact':
            return {
                blockType: 'contact',
                variant: 'form',
                headline: 'Get in Touch',
                subheadline: 'We would love to hear from you. Send us a message.',
                address: biz?.address ?? '',
                phone: biz?.phone ?? '',
                email: biz?.email ?? '',
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
                tagline: biz?.tagline ?? '',
                copyrightText: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
                columns: [
                    { title: 'Explore', links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }] },
                    { title: 'Contact', links: [{ label: 'Contact Us', url: '/contact' }] },
                ],
            }

        case 'features':
            return {
                blockType: 'features',
                variant: 'grid-3',
                headline: 'Why Choose Us',
                features: [
                    { icon: '⭐', title: 'Quality Service', description: 'Exceptional quality in every interaction.' },
                    { icon: '🚀', title: 'Fast Response', description: 'Quick turnaround on all requests.' },
                    { icon: '💎', title: 'Premium Experience', description: 'Carefully crafted for discerning customers.' },
                    { icon: '🛡️', title: 'Trusted & Reliable', description: 'Years of consistent service excellence.' },
                ],
            }

        case 'stats':
            return {
                blockType: 'stats',
                variant: 'row',
                headline: 'Our Impact',
                stats: [
                    { value: '500+', label: 'Happy Customers' },
                    { value: '10+', label: 'Years Experience' },
                    { value: '4.9★', label: 'Average Rating' },
                ],
            }

        case 'team':
            return {
                blockType: 'team',
                variant: 'grid',
                headline: 'Meet Our Team',
                members: [
                    // Note: Payload schema uses `image` field (not `avatar`) for member photos.
                    // Media pipeline fills this via BLOCK_IMAGE_SPEC.team.
                    { name: 'Team Lead', role: 'Founder', bio: 'Passionate about delivering great experiences.' },
                    { name: 'Senior Specialist', role: 'Expert', bio: 'Years of experience in the field.' },
                    { name: 'Customer Success', role: 'Support Lead', bio: 'Dedicated to your satisfaction.' },
                ],
            }

        case 'service-cards':
            return {
                blockType: 'service-cards',
                variant: 'grid',
                headline: 'Our Services',
                services: [
                    { icon: '⭐', title: 'Premium Service', description: 'Our flagship offering.' },
                    { icon: '🚀', title: 'Fast Delivery', description: 'Quick turnaround on every job.' },
                    { icon: '💎', title: 'Custom Solutions', description: 'Tailored to your needs.' },
                    { icon: '🛡️', title: 'Ongoing Support', description: 'We stand behind our work.' },
                ],
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
                subheadline: 'Subscribe for exclusive news and offers.',
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
