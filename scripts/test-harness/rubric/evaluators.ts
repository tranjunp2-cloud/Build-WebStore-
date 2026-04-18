/**
 * Rubric criterion evaluators — stateless pure functions.
 *
 * Each evaluator receives (blocks, theme) and returns pass/fail + optional reason.
 * Custom evaluators registered by id — rubric JSON references by name.
 */

import type { HarnessBlock } from '../types'

export interface EvalContext {
    /** Homepage blocks (primary scope). */
    blocks: HarnessBlock[]
    theme: Record<string, unknown>
    /** All pages' blocks flattened — for presence checks on cross-page blocks (contact, faq). */
    allBlocks?: HarnessBlock[]
    /** Fixture category — used by categoryDnaCompliance (v1.2+). */
    category?: string
    /** Fixture id — for debug + future cross-fixture checks. */
    fixtureId?: string
}

export interface EvalResult {
    pass: boolean
    partial?: boolean
    reason?: string
}

type Evaluator = (ctx: EvalContext) => EvalResult

/** Generic CTA phrases — templates relying only on these reduce conversion.
 *  "Get Started" NOT in list (common valid SaaS CTA). */
const GENERIC_CTA_LABELS = new Set([
    'click here',
    'learn more',
    'read more',
    'view more',
    'find out more',
    'more info',
    'submit',
])

/** Category DNA mapping (WEBSITE_TEMPLATE_STANDARDS §4.1).
 *  Mandatory blocks per category — fixture must include ≥1 from each required group. */
const CATEGORY_DNA_MAP: Record<string, { mandatory: string[][]; signature: string[] }> = {
    restaurant: { mandatory: [['menu-display', 'booking-widget'], ['gallery', 'gallery-masonry']], signature: ['menu-display', 'booking-widget', 'review-cards'] },
    fnb: { mandatory: [['menu-display', 'features'], ['gallery', 'gallery-masonry']], signature: ['menu-display', 'gallery', 'review-cards'] },
    ecommerce: { mandatory: [['product-quick-view', 'features'], ['pricing', 'pricing-table']], signature: ['product-quick-view', 'pricing'] },
    beauty: { mandatory: [['service-cards', 'features'], ['gallery', 'gallery-masonry', 'before-after']], signature: ['service-cards', 'booking-widget', 'before-after'] },
    tech: { mandatory: [['pricing', 'pricing-table'], ['features']], signature: ['pricing', 'features', 'feature-comparison', 'video-showcase'] },
    health: { mandatory: [['doctor-profile', 'service-cards', 'team'], ['faq']], signature: ['doctor-profile', 'booking-widget'] },
    education: { mandatory: [['class-schedule', 'features', 'service-cards'], ['faq']], signature: ['class-schedule', 'pricing'] },
    realestate: { mandatory: [['property-card', 'gallery'], ['stats', 'features']], signature: ['property-card', 'gallery'] },
    fitness: { mandatory: [['class-schedule', 'features'], ['pricing', 'team']], signature: ['class-schedule', 'team', 'pricing'] },
    creative: { mandatory: [['gallery', 'gallery-masonry', 'portfolio-grid'], ['testimonials']], signature: ['portfolio-grid', 'gallery-masonry', 'video-showcase'] },
    business: { mandatory: [['team', 'features'], ['testimonials']], signature: ['team', 'stats', 'features'] },
    blog: { mandatory: [['features', 'testimonials'], ['newsletter']], signature: ['newsletter', 'features'] },
    events: { mandatory: [['booking-widget', 'contact'], ['gallery']], signature: ['booking-widget', 'gallery'] },
    travel: { mandatory: [['gallery', 'gallery-masonry'], ['features', 'service-cards']], signature: ['gallery', 'features'] },
}

function hasBlockInGroup(blocks: HarnessBlock[], group: string[]): boolean {
    const types = new Set(blocks.map((b) => b.blockType))
    return group.some((t) => types.has(t))
}

/** Compute WCAG relative luminance from hex color. */
function luminance(hex: string): number | null {
    const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
    if (!m) return null
    const rgb = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255)
    const lin = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

function contrastRatio(hex1: string, hex2: string): number | null {
    const l1 = luminance(hex1)
    const l2 = luminance(hex2)
    if (l1 === null || l2 === null) return null
    const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (light + 0.05) / (dark + 0.05)
}

/** Helper — collect all CTA button labels across hero/nav/cta blocks. */
function collectCtaLabels(blocks: HarnessBlock[]): string[] {
    const labels: string[] = []
    for (const b of blocks) {
        const data = b.data ?? {}
        const ctaButtons = (data.ctaButtons ?? data.buttons) as unknown
        if (Array.isArray(ctaButtons)) {
            for (const c of ctaButtons) {
                if (c && typeof c === 'object' && 'label' in c) {
                    const lbl = (c as { label?: unknown }).label
                    if (typeof lbl === 'string') labels.push(lbl)
                }
            }
        }
        for (const field of ['primaryCta', 'secondaryCta', 'ctaButton', 'cta']) {
            const obj = data[field] as { label?: unknown } | undefined
            if (obj && typeof obj === 'object' && typeof obj.label === 'string') {
                labels.push(obj.label)
            }
        }
    }
    return labels
}

/** Registry — rubric JSON references evaluators by these keys. */
export const CUSTOM_EVALUATORS: Record<string, Evaluator> = {
    distinctBlockTypes7: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        return { pass: types.size >= 7, reason: `${types.size} distinct block types` }
    },
    distinctBlockTypes8: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        return { pass: types.size >= 8, reason: `${types.size} distinct block types` }
    },
    heroHasHeadline: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const headline = hero?.data?.headline as string | undefined
        return { pass: Boolean(headline && headline.trim().length > 0), reason: headline ? `"${headline.slice(0, 40)}..."` : 'no hero' }
    },
    heroHasSubheadline: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const sub = (hero?.data?.subheadline ?? hero?.data?.subHeadline) as string | undefined
        return { pass: Boolean(sub && String(sub).trim().length > 0) }
    },
    heroHasCta: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const d = hero?.data ?? {}
        const ctaButtons = (d.ctaButtons ?? d.buttons) as unknown[] | undefined
        const singleCta = d.primaryCta ?? d.ctaButton ?? d.cta
        const hasArrayCta = Array.isArray(ctaButtons) && ctaButtons.length > 0
        return { pass: Boolean(hasArrayCta || singleCta), reason: hasArrayCta ? `${(ctaButtons as unknown[]).length} ctaButtons` : singleCta ? 'cta object' : 'none' }
    },
    heroHeadlineSubstantial: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const headline = (hero?.data?.headline as string | undefined) ?? ''
        return { pass: headline.trim().length >= 10, reason: `${headline.length} chars` }
    },
    singleHero: ({ blocks }) => {
        const count = blocks.filter((b) => b.blockType === 'hero').length
        return { pass: count === 1, reason: `${count} hero blocks` }
    },
    themeHasHeadingFont: ({ theme }) =>
        ({ pass: Boolean(theme?.fontHeading || theme?.headingFont || theme?.fontPairingId) }),
    themeHasBodyFont: ({ theme }) =>
        ({ pass: Boolean(theme?.fontBody || theme?.bodyFont || theme?.fontPairingId) }),
    themeHasSpacingPreset: ({ theme }) =>
        ({ pass: Boolean(theme?.spacingPreset) }),
    sectionHeadlinesCoverage70: ({ blocks }) => {
        // Count content blocks that have headline OR sectionLabel
        const SKIP = new Set(['navigation', 'footer', 'announcement-bar', 'breadcrumb'])
        const content = blocks.filter((b) => !SKIP.has(b.blockType))
        if (content.length === 0) return { pass: false, reason: 'no content blocks' }
        const withHeadline = content.filter((b) =>
            Boolean(b.data?.headline || b.data?.sectionLabel || b.data?.title),
        ).length
        const ratio = withHeadline / content.length
        return { pass: ratio >= 0.7, reason: `${withHeadline}/${content.length} (${Math.round(ratio * 100)}%)` }
    },
    testimonialHasAvatar: ({ blocks }) => {
        const block = blocks.find((b) => b.blockType === 'testimonials')
        const items = (block?.data?.testimonials ?? block?.data?.items ?? []) as Array<{ avatarUrl?: string; avatar?: string }>
        const withAvatar = items.filter((t) => t?.avatarUrl || t?.avatar).length
        return { pass: withAvatar >= 1, reason: `${withAvatar}/${items.length} with avatar` }
    },
    navHasCta: ({ blocks }) => {
        const nav = blocks.find((b) => b.blockType === 'navigation')
        return { pass: Boolean(nav?.data?.ctaButton) }
    },
    noLoremIpsum: ({ blocks }) => {
        const stringified = JSON.stringify(blocks).toLowerCase()
        return { pass: !stringified.includes('lorem ipsum') && !stringified.includes('lorem'), reason: 'scan all string fields' }
    },
    blockCount6To16: ({ blocks }) => {
        const n = blocks.length
        return { pass: n >= 6 && n <= 16, reason: `${n} blocks` }
    },
    blockCountMin7: ({ blocks }) => ({ pass: blocks.length >= 7, reason: `${blocks.length} blocks` }),
    blockCountMax16: ({ blocks }) => ({ pass: blocks.length <= 16, reason: `${blocks.length} blocks` }),
    noConsecutiveDuplicates: ({ blocks }) => {
        for (let i = 1; i < blocks.length; i++) {
            if (blocks[i]!.blockType === blocks[i - 1]!.blockType) {
                return { pass: false, reason: `${blocks[i]!.blockType} @ ${i - 1},${i}` }
            }
        }
        return { pass: true }
    },
    varietyHalfUnique: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        const pass = types.size >= Math.ceil(blocks.length / 2)
        return { pass, reason: `${types.size}/${blocks.length}` }
    },

    // ── v1.1 new evaluators ───────────────────────────────────────────────

    heroHeadlineLengthIdeal: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const headline = (hero?.data?.headline as string | undefined) ?? ''
        const len = headline.trim().length
        if (len >= 15 && len <= 80) return { pass: true, reason: `${len} chars (ideal)` }
        if ((len >= 10 && len < 15) || (len > 80 && len <= 120)) return { pass: false, partial: true, reason: `${len} chars (partial)` }
        return { pass: false, reason: `${len} chars (${len < 10 ? 'too short' : 'too long'})` }
    },
    heroSubheadlineLength: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const sub = ((hero?.data?.subheadline ?? hero?.data?.subHeadline) as string | undefined) ?? ''
        const len = sub.trim().length
        if (len >= 30 && len <= 200) return { pass: true, reason: `${len} chars (ideal)` }
        if ((len >= 20 && len < 30) || (len > 200 && len <= 300)) return { pass: false, partial: true, reason: `${len} chars` }
        return { pass: false, reason: `${len} chars` }
    },
    themeHeadingBodyDistinct: ({ theme }) => {
        // Strict: require explicit fontHeading + fontBody both defined AND distinct
        const h = theme?.fontHeading as string | undefined
        const b = theme?.fontBody as string | undefined
        if (!h || !b) return { pass: false, reason: `missing explicit fontHeading or fontBody (found pairingId=${theme?.fontPairingId ?? 'none'})` }
        const pass = h.trim().toLowerCase() !== b.trim().toLowerCase()
        return { pass, reason: pass ? `${h} / ${b}` : `same font (${h})` }
    },
    sectionHeadlinesCoverage85: ({ blocks }) => {
        const SKIP = new Set(['navigation', 'footer', 'announcement-bar', 'breadcrumb'])
        const content = blocks.filter((b) => !SKIP.has(b.blockType))
        if (content.length === 0) return { pass: false, reason: 'no content blocks' }
        const withHeadline = content.filter((b) => Boolean(b.data?.headline || b.data?.sectionLabel || b.data?.title)).length
        const ratio = withHeadline / content.length
        return { pass: ratio >= 0.85, reason: `${withHeadline}/${content.length} (${Math.round(ratio * 100)}%)` }
    },
    imageCoverage: ({ blocks }) => {
        const imgBlock = blocks.find((b) =>
            ['gallery', 'gallery-masonry', 'portfolio-grid'].includes(b.blockType),
        )
        if (imgBlock) return { pass: true, reason: `${imgBlock.blockType}` }
        const hero = blocks.find((b) => b.blockType === 'hero')
        const bg = (hero?.data?.backgroundImage ?? hero?.data?.image) as { url?: string } | string | undefined
        const url = typeof bg === 'string' ? bg : (bg?.url as string | undefined)
        if (url && !url.startsWith('data:image/svg') && url.length > 0) {
            return { pass: true, reason: 'hero bg image' }
        }
        return { pass: false, reason: 'no gallery/portfolio, hero bg missing or SVG placeholder' }
    },
    featuresHaveIcons: ({ blocks }) => {
        const features = blocks.find((b) => b.blockType === 'features')
        if (!features) return { pass: true, reason: 'no features block (skip)' }
        const variant = features.variant ?? ''
        // Only check icon-* variants
        if (!/icon/i.test(variant)) return { pass: true, reason: `variant=${variant} (skip)` }
        const items = (features.data?.features ?? features.data?.items) as Array<{ icon?: unknown }> | undefined
        if (!Array.isArray(items) || items.length === 0) return { pass: false, reason: 'no items' }
        const withIcon = items.filter((it) => it?.icon).length
        const ratio = withIcon / items.length
        return { pass: ratio >= 0.7, reason: `${withIcon}/${items.length} have icon` }
    },
    blockCountSweetSpot: ({ blocks }) => {
        const n = blocks.length
        if (n >= 9 && n <= 14) return { pass: true, reason: `${n} blocks (sweet spot)` }
        if ((n >= 7 && n <= 8) || (n >= 15 && n <= 16)) return { pass: false, partial: true, reason: `${n} blocks (near)` }
        return { pass: false, reason: `${n} blocks (off)` }
    },
    themeHasBorderRadius: ({ theme }) => ({ pass: Boolean(theme?.borderRadius), reason: String(theme?.borderRadius ?? 'missing') }),
    themeHasShadowPreset: ({ theme }) => ({ pass: Boolean(theme?.shadowPreset), reason: String(theme?.shadowPreset ?? 'missing') }),
    varietyUnique60: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        const ratio = blocks.length > 0 ? types.size / blocks.length : 0
        return { pass: ratio >= 0.6, reason: `${types.size}/${blocks.length} (${Math.round(ratio * 100)}%)` }
    },
    varietyUnique75: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        const ratio = blocks.length > 0 ? types.size / blocks.length : 0
        return { pass: ratio >= 0.75, reason: `${types.size}/${blocks.length} (${Math.round(ratio * 100)}%)` }
    },
    testimonialsHaveRatings: ({ blocks }) => {
        const block = blocks.find((b) => b.blockType === 'testimonials')
        if (!block) return { pass: false, reason: 'no testimonials block' }
        const items = (block.data?.testimonials ?? block.data?.items ?? []) as Array<{ rating?: unknown }>
        if (items.length === 0) return { pass: false, reason: 'no items' }
        const withRating = items.filter((t) => typeof t?.rating === 'number' && (t.rating as number) >= 1).length
        const ratio = withRating / items.length
        return { pass: ratio >= 0.5, reason: `${withRating}/${items.length} have rating` }
    },
    heroCtaPair: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const d = hero?.data ?? {}
        const arr = (d.ctaButtons ?? d.buttons) as unknown[] | undefined
        if (Array.isArray(arr) && arr.length >= 2) return { pass: true, reason: `${arr.length} CTAs` }
        if (d.primaryCta && d.secondaryCta) return { pass: true, reason: 'primary + secondary' }
        return { pass: false, reason: 'single or no CTA' }
    },
    ctaTextQualitySpecific: ({ blocks }) => {
        const labels = collectCtaLabels(blocks)
        if (labels.length === 0) return { pass: false, reason: 'no CTA labels' }
        const nonGeneric = labels.filter((l) => !GENERIC_CTA_LABELS.has(l.trim().toLowerCase()))
        return { pass: nonGeneric.length >= 1, reason: `${nonGeneric.length}/${labels.length} non-generic` }
    },
    contentDepth300: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const parts: string[] = []
        if (hero) {
            parts.push(String(hero.data?.headline ?? ''))
            parts.push(String(hero.data?.subheadline ?? hero.data?.subHeadline ?? ''))
        }
        for (const b of blocks) {
            if (b.data?.sectionLabel) parts.push(String(b.data.sectionLabel))
            if (b.data?.headline && b.blockType !== 'hero') parts.push(String(b.data.headline))
        }
        const total = parts.join(' ').trim().length
        return { pass: total >= 300, reason: `${total} chars` }
    },
    noLoremStrict: ({ blocks }) => {
        const raw = JSON.stringify(blocks).toLowerCase()
        // Word boundaries so "foLOREMn" etc. don't trigger
        const pattern = /\b(lorem|ipsum|dolor sit|consectetur adipiscing)\b/
        return { pass: !pattern.test(raw), reason: 'regex scan all string fields' }
    },
    navLinksBalanced: ({ blocks }) => {
        const nav = blocks.find((b) => b.blockType === 'navigation')
        const links = (nav?.data?.links ?? []) as unknown[]
        const n = Array.isArray(links) ? links.length : 0
        return { pass: n >= 3 && n <= 7, reason: `${n} nav links` }
    },
    footerMegaColumns: ({ blocks }) => {
        const footer = blocks.find((b) => b.blockType === 'footer')
        if (!footer) return { pass: false, reason: 'no footer' }
        if (footer.variant !== 'mega') return { pass: false, reason: `variant=${footer.variant} (not mega)` }
        const cols = (footer.data?.columns ?? footer.data?.linkColumns ?? footer.data?.sections) as unknown[] | undefined
        const n = Array.isArray(cols) ? cols.length : 0
        return { pass: n >= 4, reason: `${n} columns` }
    },

    // ── v1.2 new evaluators ───────────────────────────────────────────────

    heroHeadlineLengthStrict: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const headline = (hero?.data?.headline as string | undefined) ?? ''
        const len = headline.trim().length
        if (len >= 25 && len <= 70) return { pass: true, reason: `${len} chars (strict ideal)` }
        if ((len >= 15 && len < 25) || (len > 70 && len <= 90)) return { pass: false, partial: true, reason: `${len} chars (near)` }
        return { pass: false, reason: `${len} chars (off)` }
    },
    contentDepth500: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const parts: string[] = []
        if (hero) {
            parts.push(String(hero.data?.headline ?? ''))
            parts.push(String(hero.data?.subheadline ?? hero.data?.subHeadline ?? ''))
        }
        for (const b of blocks) {
            if (b.data?.sectionLabel) parts.push(String(b.data.sectionLabel))
            if (b.data?.headline && b.blockType !== 'hero') parts.push(String(b.data.headline))
            if (b.data?.subheadline && b.blockType !== 'hero') parts.push(String(b.data.subheadline))
        }
        const total = parts.join(' ').trim().length
        return { pass: total >= 500, reason: `${total} chars` }
    },
    varietyUnique85: ({ blocks }) => {
        const types = new Set(blocks.map((b) => b.blockType))
        const ratio = blocks.length > 0 ? types.size / blocks.length : 0
        return { pass: ratio >= 0.85, reason: `${types.size}/${blocks.length} (${Math.round(ratio * 100)}%)` }
    },
    noLoremBroad: ({ blocks }) => {
        const raw = JSON.stringify(blocks).toLowerCase()
        const pattern = /\b(lorem|ipsum|dolor sit|adipiscing|consectetur|eiusmod|tempor incididunt)\b/
        return { pass: !pattern.test(raw), reason: 'regex scan (broad)' }
    },
    ctaTextQualitySpecific2x: ({ blocks }) => {
        const labels = collectCtaLabels(blocks)
        if (labels.length === 0) return { pass: false, reason: 'no CTA labels' }
        const nonGeneric = labels.filter((l) => !GENERIC_CTA_LABELS.has(l.trim().toLowerCase()))
        return { pass: nonGeneric.length >= 2, reason: `${nonGeneric.length} non-generic (need ≥2)` }
    },
    altTextCoverage80: ({ blocks }) => {
        let total = 0
        let withAlt = 0
        for (const b of blocks) {
            // gallery/portfolio images
            const images = (b.data?.images ?? b.data?.items) as Array<{ image?: { alt?: unknown; url?: unknown }; alt?: unknown; url?: unknown }> | undefined
            if (Array.isArray(images)) {
                for (const img of images) {
                    // Only count real images (with url field), skip non-image array items
                    const hasUrl = Boolean(img?.image?.url || img?.url)
                    if (hasUrl) {
                        total++
                        const alt = img?.image?.alt ?? img?.alt
                        if (typeof alt === 'string' && alt.trim().length > 0) withAlt++
                    }
                }
            }
            // hero bg image alt
            const bg = b.data?.backgroundImage as { alt?: unknown; url?: unknown } | undefined
            if (bg?.url) {
                total++
                if (typeof bg.alt === 'string' && bg.alt.trim().length > 0) withAlt++
            }
        }
        if (total === 0) return { pass: true, reason: 'no images to check' }
        const ratio = withAlt / total
        return { pass: ratio >= 0.8, reason: `${withAlt}/${total} with alt (${Math.round(ratio * 100)}%)` }
    },
    headingOrderNoSkip: ({ blocks }) => {
        // Heuristic: hero=h1, section blocks with headline=h2, cards with title=h3
        // Verify no section has headline BEFORE hero (implies h2 before h1) & hero appears once
        const heroIdx = blocks.findIndex((b) => b.blockType === 'hero')
        if (heroIdx === -1) return { pass: false, reason: 'no hero (missing H1)' }
        // Check: no non-skip blocks with headline BEFORE hero (would imply H2 before H1)
        const SKIP = new Set(['navigation', 'announcement-bar', 'breadcrumb'])
        for (let i = 0; i < heroIdx; i++) {
            const b = blocks[i]!
            if (SKIP.has(b.blockType)) continue
            if (b.data?.headline || b.data?.title) return { pass: false, reason: `${b.blockType} at index ${i} has headline before hero` }
        }
        // Multiple heroes = multiple H1s = violates
        const heroCount = blocks.filter((b) => b.blockType === 'hero').length
        if (heroCount > 1) return { pass: false, reason: `${heroCount} heroes (multiple H1)` }
        return { pass: true, reason: 'hero H1 first, no skip' }
    },
    themeColorContrast: ({ theme }) => {
        // Primary color = UI element / button bg (large text / decorative). WCAG AA
        // threshold for UI components and large text = 3.0:1 (not 4.5 which is
        // body text). Body text usually uses theme.textColor (separate check TBD).
        const explicit = theme?.contrastRatio as number | undefined
        if (typeof explicit === 'number') {
            return { pass: explicit >= 3.0, reason: `explicit ratio ${explicit}` }
        }
        const primary = theme?.primaryColor as string | undefined
        const surface = (theme?.surfaceColor ?? theme?.backgroundColor ?? (theme?.colorMode === 'dark' ? '#0a0a0a' : '#ffffff')) as string
        if (!primary) return { pass: false, reason: 'no primaryColor' }
        const ratio = contrastRatio(primary, surface)
        if (ratio === null) return { pass: false, reason: `invalid hex (primary=${primary}, surface=${surface})` }
        if (ratio >= 4.5) return { pass: true, reason: `${ratio.toFixed(2)}:1 (AA normal text)` }
        if (ratio >= 3.0) return { pass: true, reason: `${ratio.toFixed(2)}:1 (AA UI/large text)` }
        return { pass: false, reason: `${ratio.toFixed(2)}:1 (<3.0, fails AA)` }
    },
    navAriaLabel: ({ blocks }) => {
        const nav = blocks.find((b) => b.blockType === 'navigation')
        if (!nav) return { pass: false, reason: 'no nav' }
        if (nav.data?.ariaLabel) return { pass: true, reason: 'has ariaLabel' }
        const links = nav.data?.links as Array<{ title?: unknown }> | undefined
        if (Array.isArray(links) && links.some((l) => typeof l?.title === 'string' && l.title.length > 0)) {
            return { pass: true, reason: 'links have title attrs' }
        }
        return { pass: false, reason: 'no ariaLabel + no link title' }
    },
    focusIndicatorDefined: ({ theme }) => {
        const keys = ['focusStyle', 'focusRing', 'focusOutlineColor', 'focusIndicator']
        for (const k of keys) {
            if (theme?.[k]) return { pass: true, reason: `theme.${k}=${theme[k]}` }
        }
        return { pass: false, reason: 'no focus indicator in theme' }
    },
    categoryDnaCompliance: ({ blocks, category, allBlocks }) => {
        if (!category) return { pass: false, reason: 'no category on fixture' }
        const dna = CATEGORY_DNA_MAP[category]
        if (!dna) return { pass: false, reason: `unknown category: ${category}` }
        // Use allBlocks (cross-page) — category blocks may be on sub-pages
        const searchPool = allBlocks ?? blocks
        const groupsPassed = dna.mandatory.filter((grp) => hasBlockInGroup(searchPool, grp)).length
        const total = dna.mandatory.length
        if (groupsPassed === total) return { pass: true, reason: `${groupsPassed}/${total} mandatory groups met` }
        if (groupsPassed >= Math.ceil(total / 2)) return { pass: false, partial: true, reason: `${groupsPassed}/${total} (partial)` }
        return { pass: false, reason: `${groupsPassed}/${total} groups` }
    },
    categorySignatureVariety: ({ blocks, category, allBlocks }) => {
        if (!category) return { pass: false, reason: 'no category' }
        const dna = CATEGORY_DNA_MAP[category]
        if (!dna) return { pass: false, reason: `unknown category: ${category}` }
        const searchPool = allBlocks ?? blocks
        const types = new Set(searchPool.map((b) => b.blockType))
        const present = dna.signature.filter((t) => types.has(t))
        if (present.length >= 2) return { pass: true, reason: `${present.length} signature blocks: ${present.join(', ')}` }
        if (present.length === 1) return { pass: false, partial: true, reason: `1 signature block: ${present[0]}` }
        return { pass: false, reason: `0 signature blocks (expected: ${dna.signature.join(', ')})` }
    },
    spacingRhythmTokenOnly: ({ blocks }) => {
        const TOKEN_SCALE = new Set([4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128])
        let total = 0
        let compliant = 0
        for (const b of blocks) {
            for (const field of ['padding', 'margin', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'gap']) {
                const v = b.data?.[field]
                if (typeof v === 'number') {
                    total++
                    if (TOKEN_SCALE.has(v)) compliant++
                } else if (typeof v === 'string') {
                    const m = v.match(/^(\d+)(px)?$/)
                    if (m) {
                        total++
                        if (TOKEN_SCALE.has(Number(m[1]))) compliant++
                    }
                }
            }
        }
        if (total === 0) return { pass: true, reason: 'no explicit spacing values (theme-driven)' }
        const ratio = compliant / total
        return { pass: ratio >= 0.9, reason: `${compliant}/${total} compliant (${Math.round(ratio * 100)}%)` }
    },
    heroCtaVariety: ({ blocks }) => {
        const hero = blocks.find((b) => b.blockType === 'hero')
        const arr = (hero?.data?.ctaButtons ?? hero?.data?.buttons) as Array<{ variant?: unknown; style?: unknown; type?: unknown }> | undefined
        if (!Array.isArray(arr) || arr.length < 2) return { pass: false, reason: 'need ≥2 CTAs' }
        const styles = arr.map((c) => (c?.variant ?? c?.style ?? c?.type ?? 'default') as string)
        const unique = new Set(styles)
        return { pass: unique.size >= 2, reason: `styles: ${styles.join(' | ')}` }
    },
    testimonialQuoteLength: ({ blocks }) => {
        const block = blocks.find((b) => b.blockType === 'testimonials')
        if (!block) return { pass: false, reason: 'no testimonials' }
        const items = (block.data?.testimonials ?? block.data?.items ?? []) as Array<{ quote?: unknown }>
        if (items.length === 0) return { pass: false, reason: 'no items' }
        const inRange = items.filter((t) => {
            const q = typeof t?.quote === 'string' ? t.quote : ''
            return q.length >= 80 && q.length <= 300
        }).length
        const ratio = inRange / items.length
        return { pass: ratio >= 0.8, reason: `${inRange}/${items.length} in 80-300 range` }
    },
    navLinksNotRepeat: ({ blocks }) => {
        const nav = blocks.find((b) => b.blockType === 'navigation')
        const links = nav?.data?.links as Array<{ label?: unknown }> | undefined
        if (!Array.isArray(links) || links.length === 0) return { pass: false, reason: 'no nav links' }
        const labels = links.map((l) => (typeof l?.label === 'string' ? l.label.trim().toLowerCase() : ''))
        const unique = new Set(labels)
        return { pass: unique.size === labels.length, reason: `${labels.length} total, ${unique.size} unique` }
    },
}

/** Generic check types handled inline (no custom code). */
export function evaluatePresence(blocks: HarnessBlock[], blockType: string, allBlocks?: HarnessBlock[]): EvalResult {
    const targets = blockType.split(',').map((s) => s.trim())
    // Search homepage first, then fallback to all-pages if provided (e.g. contact often lives on /contact sub-page)
    const foundHome = blocks.some((b) => targets.includes(b.blockType))
    if (foundHome) return { pass: true, reason: 'present (home)' }
    if (allBlocks) {
        const foundAny = allBlocks.some((b) => targets.includes(b.blockType))
        if (foundAny) return { pass: true, reason: 'present (sub-page)' }
    }
    return { pass: false, reason: `missing (any of ${targets.join('/')})` }
}

export function evaluateCount(blocks: HarnessBlock[], blockType: string, field: string, min: number): EvalResult {
    const targets = blockType.split(',').map((s) => s.trim())
    const block = blocks.find((b) => targets.includes(b.blockType))
    if (!block) return { pass: false, reason: `no ${blockType} block` }
    const arr = block.data?.[field]
    const n = Array.isArray(arr) ? arr.length : 0
    const partial = n > 0 && n < min
    return {
        pass: n >= min,
        partial,
        reason: `${n} items (min ${min})`,
    }
}

export function evaluateEnum(blocks: HarnessBlock[], blockType: string, field: string, allowed: string[]): EvalResult {
    const block = blocks.find((b) => b.blockType === blockType)
    if (!block) return { pass: false, reason: `no ${blockType} block` }
    const value = field === 'variant' ? block.variant : (block.data?.[field] as string | undefined)
    const pass = Boolean(value && allowed.includes(value))
    return { pass, reason: `variant="${value}" ${pass ? '✓' : `not in [${allowed.join(', ')}]`}` }
}
