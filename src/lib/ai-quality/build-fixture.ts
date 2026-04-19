/**
 * Converts a Payload Template document + its Pages (depth=1) into
 * the ScoreFixtureArgs shape expected by scoreFixture().
 *
 * Pages are fetched separately and passed in; this keeps the function pure
 * and easy to unit-test.
 */
import type { ScoreFixtureArgs } from './scorer'
import type { HarnessBlock } from '../../../scripts/test-harness/types'

/** Minimal page shape after depth=1 Payload fetch. */
export interface PayloadPage {
    slug?: string | null
    title?: string | null
    /** Payload stores blocks as an array of typed objects */
    layout?: Array<Record<string, unknown>> | null
}

/** Minimal template shape from Payload after depth=1 fetch. */
export interface PayloadTemplate {
    id: string | number
    name?: string | null
    /** First category value — used as scorer `category` */
    category?: string | string[] | null
    /** Theme config blob — pass through as-is */
    themeConfig?: Record<string, unknown> | null
}

/**
 * Convert a Payload block doc to the lightweight HarnessBlock shape.
 * Strips admin-only fields that must not leak into scorer fixtures.
 */
function toHarnessBlock(raw: Record<string, unknown>): HarnessBlock {
    const { blockType, variant, blockName, id, _uuid, _order, ...rest } = raw

    // Strip admin/internal keys that should not influence scoring
    const STRIP_KEYS = new Set(['adminNotes', 'hiddenConfig', '_parentId', 'createdAt', 'updatedAt'])
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
        if (!STRIP_KEYS.has(k)) data[k] = v
    }

    return {
        blockType: (blockType as string) ?? 'unknown',
        ...(variant ? { variant: variant as string } : {}),
        data,
    }
}

/**
 * Build a ScoreFixtureArgs from a Payload template + its pages.
 *
 * @param template  - Payload template document (depth=1)
 * @param pages     - Array of Payload page docs belonging to this template
 * @returns ScoreFixtureArgs ready to pass to scoreFixture()
 */
export function buildFixture(
    template: PayloadTemplate,
    pages: PayloadPage[],
): ScoreFixtureArgs {
    const fixtureId = String(template.id)

    // Normalise category to first string value
    const rawCategory = template.category
    const category: string = Array.isArray(rawCategory)
        ? (rawCategory[0] ?? 'unknown')
        : (rawCategory ?? 'unknown')

    // Homepage blocks: prefer page with slug '' or 'home', fallback to first page
    const homepage =
        pages.find(p => p.slug === '' || p.slug === 'home' || p.slug === '/') ??
        pages[0]

    const homepageBlocks: HarnessBlock[] = (homepage?.layout ?? [])
        .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
        .map(toHarnessBlock)

    // All blocks across all pages (for cross-page evaluators)
    const allBlocks: HarnessBlock[] = pages
        .flatMap(p => p.layout ?? [])
        .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
        .map(toHarnessBlock)

    const theme: Record<string, unknown> = template.themeConfig ?? {}

    return {
        fixtureId,
        category,
        blocks: homepageBlocks,
        theme,
        allBlocks,
    }
}
