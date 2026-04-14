/**
 * Content validation rules — Plan B Phase 04.
 *
 * Shared module consumed by both pipelines:
 *   - AI path: `openai-generator.ts` → `sanitizeBlockData()`
 *   - Template path: `template-composer.ts` → `composeFromBlueprint()`
 *
 * Rules enforce CRO best practices:
 *   - Hero headlines 3-10 words (6-word headlines convert best)
 *   - CTA labels action-oriented, never "Submit" / "Click Here"
 *   - No generic filler copy ("Welcome to our website")
 *   - Minimum content per variant (reuses openai-generator's VARIANT_MIN_CONTENT)
 *   - AIDA section ordering (features before stats, testimonials before pricing)
 *   - Multi-language support (en/vi/ms) for CTA blocked lists
 *
 * All validation is NON-BLOCKING:
 *   - Dev/staging: verbose console.warn per violation
 *   - Prod: silent auto-fix, never throw — AI pipeline never breaks
 *
 * Reference: plans/260412-2300-design-quality-rules/phase-04-content-validation.md
 */

// ── Language Support ────────────────────────────────────────────────────────

export type ContentLang = 'en' | 'vi' | 'ms'

/** Normalize pipeline language to supported content-rule language. */
export function normalizeLang(lang: string | undefined): ContentLang {
    if (lang === 'vi' || lang === 'ms' || lang === 'en') return lang
    return 'en'
}

// ── Content Limits ──────────────────────────────────────────────────────────

export const CONTENT_RULES = {
    hero: {
        headlineMaxWords: 10,
        headlineMinWords: 3,
        subheadlineMaxWords: 25,
        subheadlineMinWords: 5,
    },
    cta: {
        labelMaxWords: 5,
        labelMinWords: 1,
    },
    section: {
        titleMaxWords: 10,
        titleMinWords: 2,
    },
    feature: {
        descriptionMaxChars: 150,
        titleMaxWords: 6,
    },
    testimonial: {
        quoteMaxChars: 200,
    },
} as const

// ── Blocked Generic Copy ────────────────────────────────────────────────────

/**
 * Substrings flagged as "AI slop" — generic filler copy produced when the
 * model has nothing specific to say. Matched case-insensitively.
 */
export const BLOCKED_CONTENT: ReadonlyArray<string> = [
    'welcome to our website',
    'welcome to our site',
    'lorem ipsum',
    'your trusted partner',
    'one-stop solution',
    'quality service guaranteed',
    'we are the best',
    'the best in the business',
] as const

// ── Multi-language Blocked CTA Labels ───────────────────────────────────────

/**
 * CTA labels that fail CRO — too vague, no benefit, or AI-reflex defaults.
 * Matched case-insensitively, per language. Vietnamese/Malay lists prevent
 * the English-only blocked list from silently passing bad CTAs in other
 * languages (scenario #C1 from scenario report).
 */
export const BLOCKED_CTA_BY_LANG: Readonly<Record<ContentLang, ReadonlyArray<string>>> = {
    en: [
        'submit',
        'click here',
        'click',
        'buy now',
        'learn more',
        'read more',
        'continue',
        'next',
    ],
    vi: [
        'gửi',
        'nhấn vào đây',
        'bấm vào đây',
        'bấm đây',
        'click',
        'đọc thêm',
        'xem thêm',
        'tiếp',
    ],
    ms: [
        'hantar',
        'klik di sini',
        'klik sini',
        'tekan di sini',
        'baca lagi',
        'baca lebih',
        'teruskan',
    ],
} as const

/** Suggested replacements per language — used when auto-fixing a blocked CTA. */
export const SUGGESTED_CTA_BY_LANG: Readonly<Record<ContentLang, ReadonlyArray<string>>> = {
    en: ['Get Started', 'Contact Us', 'Book Now', 'Request a Demo'],
    vi: ['Đăng ký ngay', 'Liên hệ', 'Đặt lịch', 'Yêu cầu demo'],
    ms: ['Mula Sekarang', 'Hubungi Kami', 'Tempah', 'Minta Demo'],
} as const

// ── Section Ordering Rules (AIDA funnel) ────────────────────────────────────

/**
 * Dependencies: `before → after`. `before` must appear before `after` in a
 * rendered page. Non-blocking: violations log a warning; callers decide
 * whether to auto-reorder or accept.
 */
export const ORDERING_RULES: ReadonlyArray<[string, string]> = [
    ['features', 'stats'],
    ['features', 'pricing'],
    ['features', 'testimonials'],
    ['about', 'team'],
] as const

/**
 * Categories that legitimately break the default ordering rules. For example,
 * fundraising landing pages lead with stats as social proof, NOT features.
 */
export const CATEGORY_ORDERING_OVERRIDES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
    fundraising: [
        // stats before features is OK for fundraising (social proof first)
    ],
    nonprofit: [
        // same exception
    ],
} as const

// ── Page-Level Guard ────────────────────────────────────────────────────────

/** Minimum blocks per generated page — nav + hero + footer baseline. */
export const MIN_BLOCKS_PER_PAGE = 3

// ── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: unknown): number {
    if (typeof text !== 'string') return 0
    // Grapheme-aware split (handles emoji correctly)
    return text.trim().split(/\s+/).filter(Boolean).length
}

function countChars(text: unknown): number {
    if (typeof text !== 'string') return 0
    // Use spread for grapheme count, not raw .length (emoji multi-codepoint)
    return [...text].length
}

function isBlockedCopy(text: unknown): boolean {
    if (typeof text !== 'string') return false
    const lower = text.toLowerCase()
    return BLOCKED_CONTENT.some((phrase) => lower.includes(phrase))
}

function isBlockedCTALabel(label: unknown, lang: ContentLang): boolean {
    if (typeof label !== 'string') return false
    const normalized = label.trim().toLowerCase()
    if (normalized.length === 0) return false
    const list = BLOCKED_CTA_BY_LANG[lang]
    return list.some((blocked) => normalized === blocked || normalized.startsWith(blocked + ' '))
}

function suggestCTAReplacement(lang: ContentLang): string {
    const options = SUGGESTED_CTA_BY_LANG[lang]
    return options[0] ?? 'Get Started'
}

/**
 * Locate the primary content array on a block (items/testimonials/features/
 * plans/members/etc.). Used to feed variant min-content fallback.
 */
export function getContentArray(block: Record<string, unknown>): {
    field: string
    items: unknown[]
} | null {
    const FIELDS = [
        'items',
        'testimonials',
        'features',
        'plans',
        'members',
        'logos',
        'images',
        'services',
        'products',
    ]
    for (const field of FIELDS) {
        const val = block[field]
        if (Array.isArray(val)) {
            return { field, items: val }
        }
    }
    return null
}

// ── validateBlockContent ────────────────────────────────────────────────────

export type BlockValidationResult = {
    valid: boolean
    warnings: string[]
    fixes: Record<string, unknown>
}

/**
 * Validate a single block's content against CRO + anti-pattern rules.
 * Returns warnings (non-blocking) and a `fixes` patch that callers merge
 * into the block to auto-repair violations.
 *
 * @param block   Block data (blockType + fields)
 * @param lang    Content language for blocked CTA lookup
 */
export function validateBlockContent(
    block: Record<string, unknown>,
    lang: ContentLang = 'en',
): BlockValidationResult {
    const warnings: string[] = []
    const fixes: Record<string, unknown> = {}
    const type = typeof block.blockType === 'string' ? block.blockType : ''

    // ── Hero headlines ──
    if (type === 'hero') {
        const headline = block.headline
        const wc = countWords(headline)
        if (wc > 0 && wc > CONTENT_RULES.hero.headlineMaxWords) {
            warnings.push(
                `[design-quality] hero headline ${wc} words exceeds max ${CONTENT_RULES.hero.headlineMaxWords}`,
            )
            // Auto-fix: truncate to first N words
            const words = String(headline).trim().split(/\s+/).slice(0, CONTENT_RULES.hero.headlineMaxWords)
            fixes.headline = words.join(' ')
        }
        if (wc > 0 && wc < CONTENT_RULES.hero.headlineMinWords) {
            warnings.push(
                `[design-quality] hero headline ${wc} words below min ${CONTENT_RULES.hero.headlineMinWords}`,
            )
            // Not auto-fixable without business context — warn only
        }
        if (isBlockedCopy(headline)) {
            warnings.push(
                `[design-quality] hero headline uses generic filler copy: "${String(headline).slice(0, 60)}"`,
            )
        }

        const sub = block.subheadline
        const subWc = countWords(sub)
        if (subWc > 0 && subWc > CONTENT_RULES.hero.subheadlineMaxWords) {
            warnings.push(
                `[design-quality] hero subheadline ${subWc} words exceeds max ${CONTENT_RULES.hero.subheadlineMaxWords}`,
            )
            const words = String(sub).trim().split(/\s+/).slice(0, CONTENT_RULES.hero.subheadlineMaxWords)
            fixes.subheadline = words.join(' ')
        }
    }

    // ── CTA labels (hero.ctaButtons + navigation.ctaButton) ──
    if (type === 'hero' && Array.isArray(block.ctaButtons)) {
        const original = block.ctaButtons as unknown[]
        let changed = false
        const fixed = original.map((btn: unknown) => {
            if (typeof btn !== 'object' || btn === null) return btn
            const bObj = btn as Record<string, unknown>
            if (isBlockedCTALabel(bObj.label, lang)) {
                warnings.push(
                    `[design-quality] hero CTA "${bObj.label}" blocked (${lang}), replaced with suggestion`,
                )
                changed = true
                return { ...bObj, label: suggestCTAReplacement(lang) }
            }
            return btn
        })
        if (changed) {
            fixes.ctaButtons = fixed
        }
    }

    if (type === 'navigation' && typeof block.ctaButton === 'object' && block.ctaButton !== null) {
        const btn = block.ctaButton as Record<string, unknown>
        if (isBlockedCTALabel(btn.label, lang)) {
            warnings.push(
                `[design-quality] navigation CTA "${btn.label}" blocked (${lang}), replaced`,
            )
            fixes.ctaButton = { ...btn, label: suggestCTAReplacement(lang) }
        }
    }

    // ── Feature descriptions length ──
    if (type === 'features' && Array.isArray(block.items)) {
        for (const item of block.items) {
            if (typeof item === 'object' && item !== null) {
                const desc = (item as Record<string, unknown>).description
                if (typeof desc === 'string' && countChars(desc) > CONTENT_RULES.feature.descriptionMaxChars) {
                    warnings.push(
                        `[design-quality] feature description ${countChars(desc)} chars exceeds max ${CONTENT_RULES.feature.descriptionMaxChars}`,
                    )
                    // Warn only — truncation could cut mid-sentence awkwardly.
                }
            }
        }
    }

    // ── Testimonial quotes length ──
    if (type === 'testimonials' && Array.isArray(block.items)) {
        for (const item of block.items) {
            if (typeof item === 'object' && item !== null) {
                const quote = (item as Record<string, unknown>).quote
                if (typeof quote === 'string' && countChars(quote) > CONTENT_RULES.testimonial.quoteMaxChars) {
                    warnings.push(
                        `[design-quality] testimonial quote ${countChars(quote)} chars exceeds max ${CONTENT_RULES.testimonial.quoteMaxChars}`,
                    )
                }
            }
        }
    }

    return {
        valid: warnings.length === 0,
        warnings,
        fixes,
    }
}

/**
 * Apply validation to a block and merge auto-fixes. Returns a new object —
 * never mutates input. Consumers in sanitizer / composer call this once per
 * block after schema + variant normalization.
 */
export function applyContentValidation(
    block: Record<string, unknown>,
    lang: ContentLang = 'en',
    options: { silent?: boolean } = {},
): Record<string, unknown> {
    const { valid, warnings, fixes } = validateBlockContent(block, lang)
    if (!valid && !options.silent) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            for (const w of warnings) console.warn(w)
        }
    }
    if (Object.keys(fixes).length === 0) return block
    return { ...block, ...fixes }
}

// ── validateOrdering (page-level) ───────────────────────────────────────────

export type OrderingResult = {
    valid: boolean
    warnings: string[]
    reorderHints: Array<{ blockType: string; moveBefore: string }>
}

/**
 * Verify a sequence of blocks satisfies ORDERING_RULES. Returns warnings and
 * reorder hints but does NOT mutate — page-level reordering is a caller
 * concern (may require re-running other composers).
 */
export function validateOrdering(
    blocks: Array<Record<string, unknown>>,
    category?: string,
): OrderingResult {
    const warnings: string[] = []
    const reorderHints: Array<{ blockType: string; moveBefore: string }> = []

    const rules: ReadonlyArray<[string, string]> =
        category && CATEGORY_ORDERING_OVERRIDES[category]
            ? CATEGORY_ORDERING_OVERRIDES[category]!
            : ORDERING_RULES

    const types = blocks.map((b) => (typeof b.blockType === 'string' ? b.blockType : ''))

    for (const [before, after] of rules) {
        const beforeIdx = types.indexOf(before)
        const afterIdx = types.indexOf(after)
        if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx > afterIdx) {
            warnings.push(
                `[design-quality] ordering: "${before}" must come before "${after}" (currently reversed)`,
            )
            reorderHints.push({ blockType: before, moveBefore: after })
        }
    }

    return {
        valid: warnings.length === 0,
        warnings,
        reorderHints,
    }
}

// ── Page-level guard ────────────────────────────────────────────────────────

/**
 * Verify a page has at least `MIN_BLOCKS_PER_PAGE` blocks. Returns whether
 * the page is viable and what kinds of fallback blocks the caller should add.
 */
export function checkPageBlockCount(
    blocks: Array<Record<string, unknown>>,
): {
    viable: boolean
    hasNav: boolean
    hasHero: boolean
    hasFooter: boolean
} {
    const types = new Set(blocks.map((b) => (typeof b.blockType === 'string' ? b.blockType : '')))
    return {
        viable: blocks.length >= MIN_BLOCKS_PER_PAGE,
        hasNav: types.has('navigation'),
        hasHero: types.has('hero'),
        hasFooter: types.has('footer'),
    }
}
