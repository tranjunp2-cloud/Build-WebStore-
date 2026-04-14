/**
 * Structure enforcer — post-AI gap-filler and item padder.
 *
 * Runs inside generateSiteWithAI after validateBlocks but before final output.
 * Fixes the sparse-layout problem where AI defaults to 5-6 block layouts.
 *
 * Two-step process:
 *   1. enforceMinimumStructure(blocks, category) — injects missing mandatory blocks
 *      from content-injection library, pads to minBlocks with recommended blocks
 *   2. enforceMinItems(blocks, category) — pads block items (testimonials, faq, etc)
 *
 * Plan: 260414-1400-ai-gen-unsplash-pipeline phase-05
 */

import {
    getCategoryRequirement,
    ITEM_FIELD_BY_BLOCK,
    NAV_VARIANT_BY_CATEGORY,
    type CategoryRequirement,
} from './category-requirements'
import { buildBlockFromLibrary, padItems, type InjectionContext } from './content-injection'

type Block = Record<string, unknown>

/** Insertion index resolver — places new blocks in sensible positions. */
function findInsertionIndex(blocks: Block[], blockType: string): number {
    const types = blocks.map((b) => (typeof b.blockType === 'string' ? b.blockType : ''))

    // Fixed positions
    if (blockType === 'navigation') return 0
    if (blockType === 'footer') return blocks.length
    if (blockType === 'hero') {
        const navIdx = types.indexOf('navigation')
        return navIdx >= 0 ? navIdx + 1 : 0
    }

    // Before footer by default
    const footerIdx = types.indexOf('footer')
    const beforeFooter = footerIdx >= 0 ? footerIdx : blocks.length

    // CTA near end but before footer
    if (blockType === 'cta') {
        return beforeFooter
    }

    // Contact just before footer
    if (blockType === 'contact') {
        return beforeFooter
    }

    // Testimonials after features if features exists
    if (blockType === 'testimonials') {
        const featIdx = types.indexOf('features')
        if (featIdx >= 0) return featIdx + 1
    }

    // Stats after features
    if (blockType === 'stats') {
        const featIdx = types.indexOf('features')
        if (featIdx >= 0) return featIdx + 1
    }

    // Default: insert in the middle section (after hero, before footer)
    const heroIdx = types.indexOf('hero')
    const midStart = heroIdx >= 0 ? heroIdx + 1 : 1
    const midEnd = footerIdx >= 0 ? footerIdx : blocks.length
    return Math.max(midStart, Math.min(midEnd, blocks.length))
}

/**
 * Inject missing mandatory blocks + pad to minBlocks with recommended blocks.
 */
export function enforceMinimumStructure(
    blocks: Block[],
    category: string,
    ctx: InjectionContext = {},
): Block[] {
    const req: CategoryRequirement = getCategoryRequirement(category)
    const out = [...blocks]
    const presentTypes = new Set(
        out.map((b) => (typeof b.blockType === 'string' ? b.blockType : '')).filter(Boolean),
    )

    // Upgrade navigation variant per category (before any other enforcement).
    // AI often picks bland "simple" or "transparent" — override with category-appropriate.
    const preferredNav = NAV_VARIANT_BY_CATEGORY[category]
    if (preferredNav) {
        for (const block of out) {
            if (block.blockType === 'navigation') {
                block.variant = preferredNav
                break
            }
        }
    }

    // 1. Inject missing mandatory blocks
    for (const blockType of req.mandatoryBlocks) {
        if (presentTypes.has(blockType)) continue
        const injected = buildBlockFromLibrary(blockType, category, ctx)
        if (!injected) {
            console.warn(`[Structure Enforcer] no library content for mandatory "${blockType}" in category "${category}"`)
            continue
        }
        const insertIdx = findInsertionIndex(out, blockType)
        out.splice(insertIdx, 0, injected)
        presentTypes.add(blockType)
        console.info(`[Structure Enforcer] injected mandatory "${blockType}" at index ${insertIdx} for ${category}`)
    }

    // 2. Pad to minBlocks using recommended
    let guard = 0
    while (out.length < req.minBlocks && guard < req.recommendedBlocks.length + 5) {
        guard++
        const next = req.recommendedBlocks.find((b) => !presentTypes.has(b))
        if (!next) break
        const injected = buildBlockFromLibrary(next, category, ctx)
        if (!injected) {
            presentTypes.add(next) // avoid infinite loop
            continue
        }
        const insertIdx = findInsertionIndex(out, next)
        out.splice(insertIdx, 0, injected)
        presentTypes.add(next)
        console.info(`[Structure Enforcer] padded recommended "${next}" to reach minBlocks=${req.minBlocks}`)
    }

    return out
}

/**
 * Pad per-block items to meet minItems requirements.
 * Mutates blocks in place + returns same array for chainability.
 */
export function enforceMinItems(blocks: Block[], category: string): Block[] {
    const req = getCategoryRequirement(category)
    const mins = req.minItems
    if (!mins) return blocks

    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (!blockType) continue
        const minCount = mins[blockType]
        if (minCount == null || minCount <= 0) continue

        const itemField = ITEM_FIELD_BY_BLOCK[blockType]
        if (!itemField) continue

        const current = block[itemField]
        if (!Array.isArray(current)) continue
        if (current.length >= minCount) continue

        const padded = padItems(blockType, current, minCount, category)
        block[itemField] = padded
        console.info(
            `[Structure Enforcer] padded ${blockType}.${itemField}: ${current.length} → ${padded.length}`,
        )
    }

    return blocks
}
