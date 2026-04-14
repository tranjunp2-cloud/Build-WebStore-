/**
 * Media injector — plans and fulfills image needs for AI-generated blocks.
 *
 * Flow:
 *   1. planImageNeeds(blocks) — walks blocks, identifies fields needing images
 *   2. fulfillImageNeeds(needs, ctx, payload) — calls media-pipeline for each,
 *      mutates blocks in place to replace URL strings with Media IDs
 *
 * Used by /api/ai/generate-site route AFTER AI returns blocks, BEFORE sanitizer
 * strips URL fields. Replaces single DALL-E hero call with batched Unsplash pipeline.
 *
 * Server-only.
 */

import { deriveKeywords, type KeywordLanguage } from './image-keywords'
import { getMediaForBlock, type MediaPipelineContext } from './media-pipeline'

/** Describes how to find/mutate image fields for each block type. */
export interface BlockImageSpec {
    /** Top-level fields directly on block (set to single Media ID). */
    topLevel?: string[]
    /** Nested array fields: { arrayField, itemField } — each array item gets 1 image. */
    nestedArray?: Array<{ arrayField: string; itemField: string; minCount?: number }>
}

/**
 * Image-field mapping for each supported block type. Drives planImageNeeds walker.
 * Keys MUST match registered block types in Payload Pages.ts.
 */
export const BLOCK_IMAGE_SPEC: Record<string, BlockImageSpec> = {
    hero: { topLevel: ['backgroundImage'] },
    about: { topLevel: ['image'] },
    gallery: {
        nestedArray: [{ arrayField: 'images', itemField: 'image', minCount: 6 }],
    },
    'portfolio-grid': {
        nestedArray: [{ arrayField: 'items', itemField: 'image', minCount: 6 }],
    },
    team: {
        nestedArray: [{ arrayField: 'members', itemField: 'avatar', minCount: 3 }],
    },
    testimonials: {
        nestedArray: [{ arrayField: 'testimonials', itemField: 'avatar' }],
    },
    'logo-cloud': {
        nestedArray: [{ arrayField: 'logos', itemField: 'logo' }],
    },
}

export interface ImageNeed {
    blockType: string
    count: number
    assign: (mediaIds: number[]) => void
}

export interface FulfillmentContext extends MediaPipelineContext {
    language?: KeywordLanguage
}

type AIBlock = Record<string, unknown>

/**
 * Walk blocks and collect image needs as a flat list of "tasks".
 * Each need carries its own `assign` closure that mutates the block in place.
 */
export function planImageNeeds(blocks: AIBlock[]): ImageNeed[] {
    const needs: ImageNeed[] = []

    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const spec = BLOCK_IMAGE_SPEC[blockType]
        if (!spec) continue

        // Top-level image fields (hero.backgroundImage, about.image)
        if (spec.topLevel) {
            for (const field of spec.topLevel) {
                // Skip if already a number (Media ID — already filled)
                if (typeof block[field] === 'number') continue
                needs.push({
                    blockType,
                    count: 1,
                    assign: (ids) => {
                        if (ids[0] != null) block[field] = ids[0]
                    },
                })
            }
        }

        // Nested array fields (gallery.images[].image, team.members[].avatar)
        if (spec.nestedArray) {
            for (const { arrayField, itemField, minCount } of spec.nestedArray) {
                let arr = block[arrayField]
                if (!Array.isArray(arr)) {
                    // Create array if missing with minCount empty entries
                    if (minCount && minCount > 0) {
                        arr = Array.from({ length: minCount }, () => ({}))
                        block[arrayField] = arr
                    } else {
                        continue
                    }
                }
                const items = arr as AIBlock[]
                // Pad array to minCount if below
                if (minCount && items.length < minCount) {
                    while (items.length < minCount) items.push({})
                }
                const count = items.length
                if (count === 0) continue
                needs.push({
                    blockType,
                    count,
                    assign: (ids) => {
                        for (let i = 0; i < items.length && i < ids.length; i++) {
                            const item = items[i]
                            if (item && typeof item === 'object') item[itemField] = ids[i]
                        }
                    },
                })
            }
        }
    }

    return needs
}

/**
 * Fulfill image needs — calls media-pipeline.getMediaForBlock for each need group
 * and applies results via each need's `assign` closure.
 *
 * Sequential per need (not parallel across needs) to avoid Unsplash 429 spikes.
 * Each call has its own internal concurrency limit inside media-pipeline.
 */
/**
 * Walk all blocks and strip any upload field that is NOT a numeric Media ID.
 * Ensures Payload save doesn't reject with "expected number, got object/string".
 * Call AFTER fulfillImageNeeds — failed slots will still have {url,alt} or string,
 * which this step cleans to undefined (Payload upload fields are optional).
 */
export function cleanupNonNumericImageFields(blocks: AIBlock[]): void {
    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const spec = BLOCK_IMAGE_SPEC[blockType]
        if (!spec) continue

        if (spec.topLevel) {
            for (const field of spec.topLevel) {
                if (typeof block[field] !== 'number') delete block[field]
            }
        }

        if (spec.nestedArray) {
            for (const { arrayField, itemField } of spec.nestedArray) {
                const arr = block[arrayField]
                if (!Array.isArray(arr)) continue
                for (const item of arr as AIBlock[]) {
                    if (item && typeof item === 'object' && typeof item[itemField] !== 'number') {
                        delete item[itemField]
                    }
                }
            }
        }
    }
}

export async function fulfillImageNeeds(
    needs: ImageNeed[],
    ctx: FulfillmentContext,
    payload: Parameters<typeof getMediaForBlock>[4],
): Promise<{ succeeded: number; failed: number }> {
    if (needs.length === 0) return { succeeded: 0, failed: 0 }

    let succeeded = 0
    let failed = 0
    const category = ctx.category ?? 'business'

    // Group needs by blockType so we can do a single search per block type
    const groupedByBlock = new Map<string, ImageNeed[]>()
    for (const need of needs) {
        const list = groupedByBlock.get(need.blockType) ?? []
        list.push(need)
        groupedByBlock.set(need.blockType, list)
    }

    for (const [blockType, groupNeeds] of groupedByBlock.entries()) {
        const totalCount = groupNeeds.reduce((sum, n) => sum + n.count, 0)
        if (totalCount === 0) continue

        const keywords = deriveKeywords(category, blockType, {
            businessName: ctx.businessName,
            industry: ctx.category,
            language: ctx.language,
        })

        try {
            const result = await getMediaForBlock(blockType, keywords, totalCount, ctx, payload)
            const ids = [...result.mediaIds]
            // Distribute IDs across needs in order
            for (const need of groupNeeds) {
                const slice = ids.splice(0, need.count)
                if (slice.length > 0) {
                    need.assign(slice)
                    succeeded += slice.length
                    failed += need.count - slice.length
                } else {
                    failed += need.count
                }
            }
            if (result.failures.length > 0) {
                console.warn(
                    `[Media Injector] ${blockType}: ${result.failures.length} photo(s) failed`,
                )
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn(`[Media Injector] ${blockType} fulfillment failed: ${msg}`)
            failed += totalCount
        }
    }

    console.info(
        `[Media Injector] fulfilled ${succeeded}/${succeeded + failed} image slots across ${groupedByBlock.size} block type(s)`,
    )
    return { succeeded, failed }
}
