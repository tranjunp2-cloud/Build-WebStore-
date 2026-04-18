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
}

export interface EvalResult {
    pass: boolean
    partial?: boolean
    reason?: string
}

type Evaluator = (ctx: EvalContext) => EvalResult

/** Registry — rubric-v1.json references evaluators by these keys. */
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
