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
import { seededShufflePick, hashString } from './seeded-random'
import { CATEGORY_RECIPES, type CategoryRecipe, type RecipeCategory } from './category-recipes'
import { isUnsupportedBlock } from './unsupported-blocks'

/**
 * Plan 2253 follow-up (R1 fix) — pick 1 of 3 hand-curated category recipes
 * using seeded Fisher-Yates shuffle so different businesses in the same
 * category rotate through distinct block sequences. Returns null if the
 * category has no recipes defined (falls back to legacy mandatoryBlocks).
 */
function pickSkeletonRecipe(category: string, seed: number): CategoryRecipe | null {
    const recipes = CATEGORY_RECIPES[category as RecipeCategory]
    if (!recipes || recipes.length === 0) return null
    const compound = seed ^ hashString('skeleton:' + category)
    return seededShufflePick(recipes, compound) ?? recipes[0]!
}

/**
 * Filter a recipe's block sequence to drop types the Payload schema can't
 * handle (unsupported-blocks list is the single source of truth) — matches
 * the same drop list applied in openai-generator's validateBlocks and
 * fallback-adapter's filterUnsupportedBlocks. Prevents the enforcer from
 * injecting menu-display / booking-widget / before-after which the sanitizer
 * would then immediately drop.
 */
function recipeBlocksUsable(recipe: CategoryRecipe): string[] {
    return recipe.blocks.filter((b) => !isUnsupportedBlock(b))
}

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
    // AI often picks bland "simple" or "transparent" — override with a seed-picked
    // variant from the category pool so same-category businesses rotate through
    // multiple nav styles instead of locking to one. (Plan 2253 Phase 01 — R9)
    const navPool = NAV_VARIANT_BY_CATEGORY[category]
    if (navPool && navPool.length > 0) {
        const navSeed = (ctx.seed ?? 0) ^ hashString('navigation' + category)
        const preferredNav = seededShufflePick(navPool, navSeed) ?? navPool[0]
        for (const block of out) {
            if (block.blockType === 'navigation') {
                block.variant = preferredNav
                break
            }
        }
    }

    // Plan 2253 follow-up (R1 fix) — if category has recipes, use seed-picked
    // recipe as the skeleton template. Same category + different business =
    // different skeleton rotation. Recipes are defined in category-recipes.ts
    // (shipped by plan 2249 phase 04 data layer).
    const recipe = pickSkeletonRecipe(category, ctx.seed ?? 0)

    if (recipe) {
        const usableBlocks = recipeBlocksUsable(recipe)
        console.info(
            `[Structure Enforcer] using recipe "${recipe.id}" (${recipe.rhythm}) for ${category}`,
        )

        // 1a. Navigation + footer are always required regardless of recipe.
        // Recipe.blocks starts at 'hero' per plan 2249 schema, so we prepend
        // navigation and ensure footer is the last block.
        const alwaysNeeded = ['navigation', 'footer']
        for (const blockType of alwaysNeeded) {
            if (presentTypes.has(blockType)) continue
            const injected = buildBlockFromLibrary(blockType, category, ctx)
            if (!injected) continue
            out.push(injected)
            presentTypes.add(blockType)
        }

        // 1b. Inject any recipe.required block that's missing
        for (const blockType of recipe.required) {
            if (presentTypes.has(blockType)) continue
            if (isUnsupportedBlock(blockType)) continue
            const injected = buildBlockFromLibrary(blockType, category, ctx)
            if (!injected) {
                console.warn(
                    `[Structure Enforcer] no library content for required "${blockType}" (recipe=${recipe.id})`,
                )
                continue
            }
            out.push(injected)
            presentTypes.add(blockType)
            console.info(
                `[Structure Enforcer] injected required "${blockType}" (recipe=${recipe.id})`,
            )
        }

        // 1c. Backward compat — legacy mandatoryBlocks still get injected if
        // they're not in the recipe. Keeps categories that historically
        // required e.g. `team` from losing it when a recipe omits it.
        for (const blockType of req.mandatoryBlocks) {
            if (presentTypes.has(blockType)) continue
            if (isUnsupportedBlock(blockType)) continue
            const injected = buildBlockFromLibrary(blockType, category, ctx)
            if (!injected) continue
            out.push(injected)
            presentTypes.add(blockType)
            console.info(
                `[Structure Enforcer] injected legacy mandatory "${blockType}" (not in recipe ${recipe.id})`,
            )
        }

        // 1d. Pad to minBlocks — first try remaining recipe blocks, then
        // fall through to req.recommendedBlocks if recipe exhausted.
        const padCandidates = [
            ...usableBlocks.filter((b) => !presentTypes.has(b)),
            ...req.recommendedBlocks.filter((b) => !presentTypes.has(b) && !isUnsupportedBlock(b)),
        ]
        let guard = 0
        while (out.length < req.minBlocks && guard < padCandidates.length + 5) {
            guard++
            const next = padCandidates.find((b) => !presentTypes.has(b))
            if (!next) break
            const injected = buildBlockFromLibrary(next, category, ctx)
            if (!injected) {
                presentTypes.add(next)
                continue
            }
            out.push(injected)
            presentTypes.add(next)
            console.info(
                `[Structure Enforcer] padded "${next}" to reach minBlocks=${req.minBlocks}`,
            )
        }

        // 1e. Reorder output to match recipe.blocks sequence, with navigation
        // always at index 0 and footer always at last. Blocks not in the
        // recipe sort by their type's natural mid-section position.
        const recipeOrder = new Map<string, number>()
        usableBlocks.forEach((b, i) => recipeOrder.set(b, i + 1)) // +1 to leave 0 for nav
        recipeOrder.set('navigation', 0)
        recipeOrder.set('footer', Number.MAX_SAFE_INTEGER - 1)
        out.sort((a, b) => {
            const ai = recipeOrder.get(String(a.blockType)) ?? Number.MAX_SAFE_INTEGER / 2
            const bi = recipeOrder.get(String(b.blockType)) ?? Number.MAX_SAFE_INTEGER / 2
            return ai - bi
        })

        return out
    }

    // Legacy fallback: no recipe for this category — use old mandatoryBlocks
    // path. Kept for backward compat so categories not in CATEGORY_RECIPES
    // (none currently, but defensive) still get enforcement.
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

    let guard = 0
    while (out.length < req.minBlocks && guard < req.recommendedBlocks.length + 5) {
        guard++
        const next = req.recommendedBlocks.find((b) => !presentTypes.has(b))
        if (!next) break
        const injected = buildBlockFromLibrary(next, category, ctx)
        if (!injected) {
            presentTypes.add(next)
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
 *
 * Plan 2253 Phase 03 — accept InjectionContext so padItems can seed-rotate
 * its library pool start index, avoiding testimonial/FAQ repetition across
 * same-category businesses.
 */
export function enforceMinItems(
    blocks: Block[],
    category: string,
    ctx: InjectionContext = {},
): Block[] {
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

        const padded = padItems(blockType, current, minCount, category, ctx)
        block[itemField] = padded
        console.info(
            `[Structure Enforcer] padded ${blockType}.${itemField}: ${current.length} → ${padded.length}`,
        )
    }

    return blocks
}
