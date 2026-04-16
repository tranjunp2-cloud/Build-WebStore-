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
import { getMediaForBlock, batchFetchFromPool, type MediaPipelineContext } from './media-pipeline'
import { pickManyFromPool, type ImageRole } from './image-pool'

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
// Field names MUST match Payload Pages.ts block schemas — not Zod block schemas
// (there's intentional drift where Zod is AI-facing and Payload is DB-facing).
// See plan 260414-1400-ai-gen-unsplash-pipeline phase-04 route-integration.
export const BLOCK_IMAGE_SPEC: Record<string, BlockImageSpec> = {
    hero: { topLevel: ['image', 'backgroundImage'] },
    about: { topLevel: ['image'] },
    gallery: {
        nestedArray: [{ arrayField: 'images', itemField: 'image', minCount: 6 }],
    },
    'portfolio-grid': {
        // Pages.ts: projects[].image (NOT items[].image)
        nestedArray: [{ arrayField: 'projects', itemField: 'image', minCount: 6 }],
    },
    team: {
        // Pages.ts: members[].image (NOT members[].avatar — Zod has avatar, drift)
        nestedArray: [{ arrayField: 'members', itemField: 'image', minCount: 3 }],
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
 * Map a composer block type to the image-pool role bucket.
 * Plan 260414-2249 phase-03 — used when ctx.pool is present.
 */
function roleForBlock(blockType: string): ImageRole {
    switch (blockType) {
        case 'hero':
        case 'video-background':
            return 'hero'
        case 'gallery':
        case 'gallery-masonry':
        case 'portfolio-grid':
        case 'before-after':
            return 'gallery'
        case 'team':
        case 'doctor-profile':
            return 'team'
        case 'products-grid':
        case 'products-featured':
        case 'product-quick-view':
        case 'property-card':
            return 'product'
        default:
            return 'any'
    }
}

/** Deterministic seed per blockType + businessName — stable across reruns. */
function hashBlockSeed(blockType: string, businessName: string): number {
    const str = `${blockType}::${businessName}`
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

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

        // Top-level image fields — one need per block (shared Media ID across all
        // top-level fields). Avoids burning 2 API calls for hero.image + hero.backgroundImage.
        if (spec.topLevel && spec.topLevel.length > 0) {
            const unfilled = spec.topLevel.filter((f) => typeof block[f] !== 'number')
            if (unfilled.length > 0) {
                needs.push({
                    blockType,
                    count: 1,
                    assign: (ids) => {
                        if (ids[0] == null) return
                        for (const field of unfilled) {
                            block[field] = ids[0]
                        }
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
    // Also strip common legacy upload fields that exist in any block
    // (Payload rejects non-numeric values for upload relationship fields).
    const UNIVERSAL_UPLOAD_FIELDS = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']

    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const spec = BLOCK_IMAGE_SPEC[blockType]

        // Strip universal upload fields at top-level (hero.image, about.image, etc)
        for (const field of UNIVERSAL_UPLOAD_FIELDS) {
            if (field in block && typeof block[field] !== 'number' && block[field] != null) {
                delete block[field]
            }
        }

        if (!spec) continue

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

/**
 * Plan 260415 fix-500 — strip references to media rows that failed the
 * Payload upload persist step (logs: "Failed to persist upload data for
 * collection media document N: g: Not Found"). Those rows exist in the
 * `media` table but are missing the `filename` / `url` fields, so when
 * Payload tries to insert `pages_blocks_gallery_images` rows referencing
 * them the whole transaction fails and the entire gen 500s.
 *
 * Run AFTER `fulfillImageNeeds` and BEFORE `payload.create pages`. Returns
 * how many refs were stripped so the caller can warn/telemetry.
 *
 * Expensive (1 `payload.find media` call) — only call once per gen.
 */
// Minimal payload interface needed for the orphan media verify step.
// Accepts any object with a find method — avoids importing the full Payload
// type from the deep-bundled payload package.
export interface MediaFinder {
    find: (args: {
        collection: 'media'
        where: { id: { in: number[] } }
        limit: number
        pagination?: boolean
        depth?: number
    }) => Promise<{ docs: Array<Record<string, unknown>> }>
}

export async function stripOrphanMediaRefs(
    blocks: AIBlock[],
    payload: MediaFinder,
): Promise<{ stripped: number; checked: number }> {
    const UNIVERSAL_UPLOAD_FIELDS = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']

    // 1. Collect every numeric media ID referenced by the block tree.
    const mediaIds = new Set<number>()
    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const spec = BLOCK_IMAGE_SPEC[blockType]

        for (const field of UNIVERSAL_UPLOAD_FIELDS) {
            const val = block[field]
            if (typeof val === 'number' && Number.isFinite(val)) mediaIds.add(val)
        }

        if (spec?.nestedArray) {
            for (const { arrayField, itemField } of spec.nestedArray) {
                const arr = block[arrayField]
                if (!Array.isArray(arr)) continue
                for (const item of arr as AIBlock[]) {
                    if (item && typeof item === 'object') {
                        const val = item[itemField]
                        if (typeof val === 'number' && Number.isFinite(val)) mediaIds.add(val)
                    }
                }
            }
        }
    }

    if (mediaIds.size === 0) return { stripped: 0, checked: 0 }

    // 2. Query Payload to verify each media row has a usable filename or url.
    let found: Array<Record<string, unknown>> = []
    try {
        const result = await payload.find({
            collection: 'media',
            where: { id: { in: Array.from(mediaIds) } },
            limit: mediaIds.size,
            pagination: false,
            depth: 0,
        })
        found = result.docs as Array<Record<string, unknown>>
    } catch (err) {
        console.warn('[stripOrphanMediaRefs] media lookup failed, skipping', err instanceof Error ? err.message : err)
        return { stripped: 0, checked: mediaIds.size }
    }

    // 3. Build the "valid" set. A row is valid iff it has either filename or url.
    //    Payload upload persist failures leave filename/url null which causes
    //    downstream block inserts to fail.
    const valid = new Set<number>()
    for (const doc of found) {
        const hasFilename = typeof doc.filename === 'string' && (doc.filename as string).length > 0
        const hasUrl = typeof doc.url === 'string' && (doc.url as string).length > 0
        if (hasFilename || hasUrl) valid.add(doc.id as number)
    }

    if (valid.size === mediaIds.size) {
        return { stripped: 0, checked: mediaIds.size }
    }

    // 4. Walk blocks again and strip / null out orphan refs.
    let stripped = 0
    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        const spec = BLOCK_IMAGE_SPEC[blockType]

        for (const field of UNIVERSAL_UPLOAD_FIELDS) {
            const val = block[field]
            if (typeof val === 'number' && !valid.has(val)) {
                delete block[field]
                stripped++
            }
        }

        if (spec?.nestedArray) {
            for (const { arrayField, itemField } of spec.nestedArray) {
                const arr = block[arrayField]
                if (!Array.isArray(arr)) continue
                for (const item of arr as AIBlock[]) {
                    if (item && typeof item === 'object') {
                        const val = item[itemField]
                        if (typeof val === 'number' && !valid.has(val)) {
                            delete item[itemField]
                            stripped++
                        }
                    }
                }
            }
        }
    }

    return { stripped, checked: mediaIds.size }
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

        // Plan 260414-2249 phase-03: pool-aware fast path.
        // When ctx.pool is present, pick from the pre-built site pool
        // instead of calling Unsplash search per block. This is what
        // delivers visual cohesion — all blocks share the same source.
        if (ctx.pool) {
            const role = roleForBlock(blockType)
            // Pool seed derived from blockType so different blocks pick
            // different pool entries (no collision on the same hero photo
            // across features + gallery).
            const poolSeed = hashBlockSeed(blockType, ctx.businessName)
            const picks = pickManyFromPool(ctx.pool, role, poolSeed, totalCount)
            if (picks.length > 0) {
                try {
                    const result = await batchFetchFromPool(picks, blockType, ctx, payload)
                    const ids = [...result.mediaIds]
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
                            `[Media Injector] ${blockType}: ${result.failures.length} pool photo(s) failed`,
                        )
                    }
                    // Pool path succeeded — skip legacy search below
                    continue
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    console.warn(`[Media Injector] ${blockType} pool path failed, falling back to search: ${msg}`)
                    // Fall through to legacy search path as backfill
                }
            } else {
                console.warn(
                    `[Media Injector] ${blockType} pool picks empty (role=${role}) — falling back to legacy search`,
                )
                // Fall through to legacy search path
            }
        }

        // Legacy path: per-block searchPhotos (pool absent or pool picks empty)
        const keywords = deriveKeywords(category, blockType, {
            businessName: ctx.businessName,
            industry: ctx.category,
            language: ctx.language,
            products: ctx.products,
            mood: ctx.mood,
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
