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
import { getBlockStrings } from './block-i18n'
import { pickLogosByCategory } from './content/client-logos-library'
import { ITEM_FIELD_BY_BLOCK } from './category-requirements'
import { hashString, seededShuffle, seededShufflePick } from './seeded-random'
import type { ThemeMood } from './theme-moods'
import { getCategoryCTA } from './theme-moods'
// Plan 2253 follow-up (260415-0900) — wire template composer builders into
// gap-fill path. These builders have ~280 hand-curated Malaysia-specific
// content entries (JAKIM halal, FPX payment, MBBS UM credentials, RM pricing)
// that the generic gap-fill pool was missing. Delegation with try-catch
// fallback to legacy hardcoded blocks.
import {
    buildFeatures as composerBuildFeatures,
    buildStats as composerBuildStats,
    buildPricing as composerBuildPricing,
    buildTeam as composerBuildTeam,
    buildServiceCards as composerBuildServiceCards,
    buildHero as composerBuildHero,
} from './template-composer'

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
    /** ISO 639-1 code for block-i18n string selection — any language franc can detect. */
    language?: string
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

/** Normalized testimonial for Zod schema shape. Picks language-specific quote when available. */
function mapTestimonial(t: TestimonialSample, language?: string): Block {
    const quote = (language === 'ms' && t.quote_ms) ? t.quote_ms
                : (language === 'vi' && t.quote_vi) ? t.quote_vi
                : t.quote
    return {
        quote,
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

    // Plan 2253 follow-up (260415-0900) — merged business sample for
    // delegation to template-composer builders. Library default (biz) +
    // user overrides from ctx.userBiz (name, tagline, products, contact).
    // Used by features/stats/pricing/team/service-cards delegation below.
    const mergedBiz: BusinessSample = {
        ...(biz ?? ({} as BusinessSample)),
        ...(userBiz ?? {}),
    }

    const i18n = getBlockStrings(ctx.language)

    switch (blockType) {
        case 'navigation':
            return {
                blockType: 'navigation',
                variant: 'pill',
                logoText: name,
                links: [
                    { label: i18n.navigation.home, url: '/' },
                    { label: i18n.navigation.about, url: '/about' },
                    { label: i18n.navigation.services, url: '/services' },
                    { label: i18n.navigation.contact, url: '/contact' },
                ],
                ctaButton: { show: true, label: i18n.navigation.getStarted, url: '/contact' },
            }

        case 'hero': {
            // Plan 260415 Phase 03 — delegate to composer buildHero when the
            // merged biz sample has a name + description/tagline/products. It
            // derives `name — top product` headlines + truncated descriptions
            // instead of canned "Welcome to ${name}" strings. Falls back to
            // the legacy user-thread path on any error.
            const canDelegate = !!(mergedBiz.name && (mergedBiz.description || mergedBiz.tagline || (mergedBiz.products && mergedBiz.products.length > 0)))
            if (canDelegate) {
                try {
                    const composed = composerBuildHero(mergedBiz, category, bizSeed, ctx.mood) as Block
                    // Ensure CTA buttons align with mood (composer emits generic labels).
                    const primaryLabel = resolveLibraryCTA(ctx.mood, category, 'primary')
                    const secondaryLabel = resolveLibraryCTA(ctx.mood, category, 'secondary')
                    return {
                        ...composed,
                        ctaButtons: [
                            { label: primaryLabel, url: '/contact', style: 'primary' },
                            { label: secondaryLabel, url: '/about', style: 'secondary' },
                        ],
                    }
                } catch (err) {
                    console.warn('[content-injection] composerBuildHero failed, falling back:', err)
                }
            }

            // Legacy fallback — Plan 07 user-thread path kept as defensive branch.
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
                headline: `${i18n.about.headlinePrefix} ${name}`,
                // Plan 07 — prefer user description, fall back to canned pool.
                body: userDescription
                    ?? biz?.description
                    ?? `${name} is dedicated to delivering exceptional experiences to every customer.`,
            }

        case 'testimonials':
            return {
                blockType: 'testimonials',
                variant: 'cards',
                headline: i18n.testimonials.headline,
                testimonials: testimonialSlice.slice(0, 4).map((t) => mapTestimonial(t, ctx.language)),
            }

        case 'faq':
            return {
                blockType: 'faq',
                variant: 'accordion',
                headline: i18n.faq.headline,
                faqs: faqSlice.slice(0, 5).map(mapFaq),
            }

        case 'cta':
            return {
                blockType: 'cta',
                variant: 'banner',
                headline: i18n.cta.headlineReady(name),
                // Plan 07 — user tagline > canned tagline > generic.
                subheadline:
                    userTagline
                    ?? (userDescription ? truncateOnWord(userDescription, 140) : undefined)
                    ?? biz?.tagline
                    ?? i18n.cta.subheadline,
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
                headline: i18n.contact.headline,
                subheadline: i18n.contact.subheadline,
                // Plan 07 — user-supplied contact fields win over canned pool.
                address: userAddress ?? biz?.address ?? '',
                phone: userPhone ?? biz?.phone ?? '',
                // null not '' — Payload email-type field validates format even without required:true,
                // so empty string causes ValidationError on publish.
                email: userEmail ?? biz?.email ?? null,
                submitLabel: i18n.contact.submitLabel,
                phoneLabel: i18n.contact.phoneLabel,
                addressLabel: i18n.contact.addressLabel,
                emailLabel: i18n.contact.emailLabel,
                formFields: [
                    { fieldName: 'name', label: i18n.contact.nameLabel, fieldType: 'text', required: true },
                    { fieldName: 'email', label: i18n.contact.emailLabel, fieldType: 'email', required: true },
                    { fieldName: 'message', label: i18n.contact.messageLabel, fieldType: 'textarea', required: true },
                ],
            }

        case 'footer':
            return {
                blockType: 'footer',
                variant: 'simple',
                logoText: name,
                // Plan 07 — user tagline/description wins over canned.
                tagline: userTagline ?? (userDescription ? truncateOnWord(userDescription, 90) : biz?.tagline ?? ''),
                copyrightText: `© ${new Date().getFullYear()} ${name}. ${i18n.footer.allRightsReserved}`,
                columns: [
                    { title: i18n.footer.explore, links: [{ label: i18n.navigation.home, url: '/' }, { label: i18n.navigation.about, url: '/about' }] },
                    { title: i18n.navigation.contact, links: [{ label: i18n.footer.aboutUs, url: '/contact' }] },
                ],
            }

        case 'features': {
            // Plan 2253 follow-up (260415-0900) — delegate to template-composer
            // buildFeatures which has hand-curated Malaysia-specific features per
            // 14 categories (JAKIM halal for restaurant, MBBS UM for health, etc).
            // Composer also handles user product injection via featuresFromProducts
            // so same-category businesses diverge. Fallback to legacy Phase 03
            // shuffle pool on error (defensive).
            try {
                return composerBuildFeatures(mergedBiz, category, ctx.language)
            } catch (err) {
                console.warn('[content-injection] composerBuildFeatures failed, falling back:', err)
            }

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
                const needed = Math.max(0, 4 - productCards.length)
                features = productCards.concat(shuffled.slice(4, 4 + needed))
            }
            return {
                blockType: 'features',
                variant: 'grid-3',
                headline: i18n.features.headlineWhyChoose(name),
                features,
            }
        }

        case 'stats': {
            // Plan 2253 follow-up (260415-0900) — delegate to template-composer
            // buildStats for category-curated stats (20+ Years / 15000+ Patients
            // Treated for health; 50000+ Customers for restaurant; etc).
            try {
                return composerBuildStats(category, ctx.language)
            } catch (err) {
                console.warn('[content-injection] composerBuildStats failed, falling back:', err)
            }

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
                headline: i18n.stats.headline,
                stats: shuffled.slice(0, 3),
            }
        }

        case 'team': {
            // Plan 2253 follow-up (260415-0900) — delegate to template-composer
            // buildTeam for category-curated team members (Dr. Tan Wei Ming MBBS
            // for health, Ahmad Razif CTO for tech, Dato' Rahman for business).
            // Note: Payload schema uses `image` field (not `avatar`) — composer
            // bios don't set image, media pipeline fills via BLOCK_IMAGE_SPEC.team.
            try {
                return composerBuildTeam(category, ctx.language)
            } catch (err) {
                console.warn('[content-injection] composerBuildTeam failed, falling back:', err)
            }

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
                headline: i18n.team.headline,
                members: shuffled.slice(0, 3),
            }
        }

        case 'service-cards': {
            // Plan 2253 follow-up (260415-0900) — delegate to template-composer
            // buildServiceCards for category-curated services ("Halal Catering"
            // for fnb; "Dental Implants" for health; etc). Composer also reads
            // biz.products so user-supplied services drive output when provided.
            try {
                return composerBuildServiceCards(mergedBiz, category, ctx.language)
            } catch (err) {
                console.warn('[content-injection] composerBuildServiceCards failed, falling back:', err)
            }

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
                headline: i18n.serviceCards.headline,
                services: shuffled.slice(0, 4),
            }
        }

        case 'gallery':
            return {
                blockType: 'gallery',
                variant: 'grid',
                headline: i18n.gallery.headline,
                // Empty images array — media-injector fills from Unsplash
                images: Array.from({ length: 6 }, () => ({})),
            }

        case 'newsletter':
            return {
                blockType: 'newsletter',
                variant: 'banner',
                headline: i18n.newsletter.headlineStayUpdated(name),
                subheadline:
                    userTagline
                    ?? (userDescription ? truncateOnWord(userDescription, 140) : undefined)
                    ?? i18n.newsletter.subheadlineFallback,
                buttonLabel: i18n.newsletter.subscribeLabel,
                placeholder: 'your@email.com',
            }

        case 'pricing': {
            // Plan 2253 follow-up (260415-0900) — delegate to template-composer
            // buildPricing for category-curated RM tiers ("Bridal Package RM 800"
            // for beauty, "Executive Checkup RM 1200" for health, etc). Composer
            // has 7 category-specific maps + RM default for other categories.
            try {
                return composerBuildPricing(category, ctx.language)
            } catch (err) {
                console.warn('[content-injection] composerBuildPricing failed, falling back:', err)
            }

            return {
                blockType: 'pricing',
                variant: 'cards',
                headline: i18n.pricing.headline,
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
        }

        case 'logo-cloud':
            return {
                blockType: 'logo-cloud',
                variant: 'row',
                headline: 'Trusted By',
                logos: (content.logos ?? pickLogosByCategory(category, 6, ctx.seed ?? 0))
                    .slice(0, 6)
                    .map((l) => ({ name: l.name, logo: { url: l.url ?? '', alt: l.name } })),
            }

        case 'client-logos':
            return {
                blockType: 'client-logos',
                variant: 'scroll',
                headline: 'Trusted By Industry Leaders',
                // Seed library lacks image urls (copyright); pass name as alt + empty url.
                // Render falls back to initials badge placeholder — see LogoImage in client-logos/index.tsx.
                logos: (content.logos ?? pickLogosByCategory(category, 6, ctx.seed ?? 0))
                    .slice(0, 6)
                    .map((l) => ({ url: l.url ?? '', alt: l.name })),
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
            const candidate = mapTestimonial(pool[i]!, ctx.language)
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
