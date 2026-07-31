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
    CONTACT_VARIANT_BY_CATEGORY,
    FOOTER_VARIANT_BY_CATEGORY,
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

const NON_REPEATABLE_CONTENT_BLOCKS = new Set(['contact'])
const CONTENT_FALLBACK_TYPES = ['features', 'about', 'services', 'contact', 'testimonials', 'faq']
export const MIN_SUBPAGE_CONTENT_SECTIONS = 5

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

        // Plan 260415 — rotate contact + footer variants AFTER recipe
        // injection so freshly injected blocks also pick up the category-
        // seeded variant instead of the library hardcoded default.
        applyStructuralVariantRotation(out, category, ctx.seed ?? 0)

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

    // Plan 260415 — legacy path also rotates contact + footer variants
    // against the category pool on the way out.
    applyStructuralVariantRotation(out, category, ctx.seed ?? 0)

    return out
}

export function enforceSubpageStructure(
    blocks: Block[],
    category: string,
    ctx: InjectionContext = {},
): Block[] {
    const out = [...blocks]
    const navBlock = out.find((b) => b.blockType === 'navigation')
    const footerBlock = out.find((b) => b.blockType === 'footer')
    const contentBlocks = out.filter((b) => b.blockType !== 'navigation' && b.blockType !== 'footer')

    const req = getCategoryRequirement(category)
    const recipe = pickSkeletonRecipe(category, ctx.seed ?? 0)
    const usableBlocks = recipe ? recipeBlocksUsable(recipe) : []
    const presentTypes = new Set(
        contentBlocks.map((b) => (typeof b.blockType === 'string' ? b.blockType : '')).filter(Boolean),
    )

    const padCandidates = [
        ...usableBlocks,
        ...req.recommendedBlocks,
    ].filter((b) => 
        b !== 'navigation' && 
        b !== 'footer' && 
        b !== 'hero' &&
        !presentTypes.has(b) && 
        !isUnsupportedBlock(b)
    )

    for (const type of CONTENT_FALLBACK_TYPES) {
        if (!padCandidates.includes(type) && !presentTypes.has(type)) {
            padCandidates.push(type)
        }
    }

    let guard = 0
    // Pad content blocks to the subpage floor (plus navigation and footer).
    while (
        contentBlocks.length < MIN_SUBPAGE_CONTENT_SECTIONS
        && guard < padCandidates.length + 10
    ) {
        guard++
        const next = padCandidates.find((b) => !presentTypes.has(b))
        if (!next) {
            // Duplicate non-hero/non-nav/non-footer content blocks if candidates exhausted
            const repeatCandidates = CONTENT_FALLBACK_TYPES.filter(
                (b) => !NON_REPEATABLE_CONTENT_BLOCKS.has(b),
            )
            const repeat = repeatCandidates[guard % repeatCandidates.length]
            const injected = buildBlockFromLibrary(repeat, category, ctx)
            if (injected) {
                contentBlocks.push(injected)
            }
            continue
        }
        const injected = buildBlockFromLibrary(next, category, ctx)
        if (!injected) {
            presentTypes.add(next)
            continue
        }
        contentBlocks.push(injected)
        presentTypes.add(next)
        console.info(`[Structure Enforcer] padded subpage with "${next}" to reach content section floor (current count: ${contentBlocks.length})`)
    }

    const finalBlocks: Block[] = []
    if (navBlock) {
        finalBlocks.push(navBlock)
    } else {
        const injectedNav = buildBlockFromLibrary('navigation', category, ctx)
        if (injectedNav) finalBlocks.push(injectedNav)
    }

    finalBlocks.push(...contentBlocks)

    if (footerBlock) {
        finalBlocks.push(footerBlock)
    } else {
        const injectedFooter = buildBlockFromLibrary('footer', category, ctx)
        if (injectedFooter) finalBlocks.push(injectedFooter)
    }

    applyStructuralVariantRotation(finalBlocks, category, ctx.seed ?? 0)

    return finalBlocks
}

/**
 * Restore content removed by cross-page quality checks without re-running the
 * full structure enforcer. Existing blocks keep their order and variants; only
 * missing content is inserted immediately before the footer.
 */
export function backfillContentSections(
    blocks: Block[],
    category: string,
    targetContentCount: number,
    ctx: InjectionContext = {},
    excludedBlockTypes: ReadonlySet<string> = new Set(),
): Block[] {
    const out = [...blocks]
    const isContentBlock = (block: Block) =>
        block.blockType !== 'navigation' && block.blockType !== 'footer'
    let contentCount = out.filter(isContentBlock).length

    if (contentCount >= targetContentCount) return out

    const presentTypes = new Set(
        out.map((block) => (
            typeof block.blockType === 'string' ? block.blockType : ''
        )).filter(Boolean),
    )
    const recipe = pickSkeletonRecipe(category, ctx.seed ?? 0)
    const req = getCategoryRequirement(category)
    const candidates = [
        ...(recipe ? recipeBlocksUsable(recipe) : []),
        ...req.recommendedBlocks,
        ...CONTENT_FALLBACK_TYPES,
    ].filter((blockType, index, all) =>
        all.indexOf(blockType) === index
        && blockType !== 'navigation'
        && blockType !== 'footer'
        && blockType !== 'hero'
        && !excludedBlockTypes.has(blockType)
        && !isUnsupportedBlock(blockType),
    )

    for (const blockType of candidates) {
        if (contentCount >= targetContentCount) break
        if (presentTypes.has(blockType)) continue

        const injected = buildBlockFromLibrary(blockType, category, ctx)
        if (!injected) continue

        const footerIndex = out.findIndex((block) => block.blockType === 'footer')
        out.splice(footerIndex >= 0 ? footerIndex : out.length, 0, injected)
        presentTypes.add(blockType)
        contentCount++
    }

    return out
}

/**
 * Plan 260415 — rotate contact + footer block variants against the curated
 * per-category pool using the same seeded-shuffle approach as nav rotation.
 * Mutates blocks in place. Shared helper so the recipe + legacy paths both
 * apply the rotation on their final block list.
 */
function applyStructuralVariantRotation(out: Block[], category: string, seed: number): void {
    const contactPool = CONTACT_VARIANT_BY_CATEGORY[category]
    if (contactPool && contactPool.length > 0) {
        const contactSeed = seed ^ hashString('contact' + category)
        const preferredContact = seededShufflePick(contactPool, contactSeed) ?? contactPool[0]
        for (const block of out) {
            if (block.blockType === 'contact') {
                block.variant = preferredContact
                break
            }
        }
    }

    const footerPool = FOOTER_VARIANT_BY_CATEGORY[category]
    if (footerPool && footerPool.length > 0) {
        const footerSeed = seed ^ hashString('footer' + category)
        const preferredFooter = seededShufflePick(footerPool, footerSeed) ?? footerPool[0]
        for (const block of out) {
            if (block.blockType === 'footer') {
                block.variant = preferredFooter
                break
            }
        }
    }
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

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex]!
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (!blockType) continue
        const configuredMin = mins[blockType] ?? 0
        const isFeaturedServiceCards =
            blockType === 'service-cards' && block.variant === 'featured'
        const serviceCardsTarget = blockType === 'service-cards'
            ? (isFeaturedServiceCards ? 4 : 3)
            : null
        const minCount = serviceCardsTarget ?? configuredMin
        if (minCount == null || minCount <= 0) continue

        const itemField = ITEM_FIELD_BY_BLOCK[blockType]
        if (!itemField) continue

        const current = block[itemField]
        if (!Array.isArray(current)) continue

        if (serviceCardsTarget && current.length > serviceCardsTarget) {
            block[itemField] = current.slice(0, serviceCardsTarget)
            console.info(
                `[Structure Enforcer] normalized service-cards.${String(block.variant)}: ${current.length} → ${serviceCardsTarget}`,
            )
            continue
        }
        if (current.length >= minCount) continue

        const padded = padItems(blockType, current, minCount, category, ctx)
        block[itemField] = padded
        console.info(
            `[Structure Enforcer] padded ${blockType}.${itemField}: ${current.length} → ${padded.length}`,
        )
        if (isFeaturedServiceCards && padded.length === 3) {
            block.variant = 'grid'
            console.info(
                `[Structure Enforcer] changed service-cards variant featured → grid because locale-safe padding could not reach 4 items`,
            )
        } else if (blockType === 'service-cards' && padded.length < 3) {
            console.warn(
                `[Structure Enforcer] kept underfilled service-cards block with ${padded.length} localized item(s); no safe localized padding source was available`,
            )
        }
    }

    return blocks
}

/**
 * Pad grid-based blocks to the nearest multiple of their column count.
 * Prevents orphan items (e.g., 4 items on 3-col grid → pad to 6).
 * Mutates blocks in place.
 *
 * Strategy: pad UP to next multiple (not trim down) — more content is
 * always better than less. Uses padItems to fill from content library.
 */
const GRID_COLS: Record<string, Record<string, number>> = {
    testimonials: { cards: 3, masonry: 3 },
    features: { 'grid-2': 2, 'grid-3': 3, 'grid-4': 4 },
    gallery: { grid: 3 },
    'social-proof': { cards: 3, grid: 3 },
    team: { grid: 3 },
}

export function enforceGridAlignment(
    blocks: Block[],
    category: string,
    ctx: InjectionContext = {},
): Block[] {
    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const variant = typeof block.variant === 'string' ? block.variant : ''
        if (!blockType || !variant) continue

        const colMap = GRID_COLS[blockType]
        if (!colMap) continue
        const cols = colMap[variant]
        if (!cols) continue

        const itemField = ITEM_FIELD_BY_BLOCK[blockType]
        if (!itemField) continue

        const items = block[itemField]
        if (!Array.isArray(items) || items.length === 0) continue
        if (items.length % cols === 0) continue

        // Pad UP to next multiple
        const target = Math.ceil(items.length / cols) * cols
        if (target > items.length) {
            const padded = padItems(blockType, items, target, category, ctx)
            block[itemField] = padded
            console.info(
                `[Grid Alignment] padded ${blockType}.${itemField}: ${items.length} → ${padded.length} (${cols}-col)`,
            )
        }
    }

    return blocks
}
