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
import { getMediaForBlock, getAvatarMedia, batchFetchFromPool, getCuratedFallbackMedia, type MediaPipelineContext } from './media-pipeline'
import { pickManyFromPool, bucketForRole, DEFAULT_LANDSCAPE_SIZE, DEFAULT_SQUARE_SIZE, type ImageRole } from './image-pool'

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
    // Plan 260417 Wave 1 C2 — expand coverage 7 → 15 to kill composer
    // placehold.co grey boxes. `roleForBlock` already maps these types.
    'products-grid': {
        nestedArray: [{ arrayField: 'products', itemField: 'image', minCount: 4 }],
    },
    'products-featured': {
        nestedArray: [{ arrayField: 'products', itemField: 'image', minCount: 1 }],
    },
    'property-card': {
        nestedArray: [{ arrayField: 'properties', itemField: 'image', minCount: 3 }],
    },
    'doctor-profile': {
        nestedArray: [{ arrayField: 'doctors', itemField: 'image', minCount: 2 }],
    },
    'before-after': {
        topLevel: ['beforeImage', 'afterImage'],
    },
    'case-study': {
        nestedArray: [{ arrayField: 'caseStudies', itemField: 'image', minCount: 3 }],
    },
    'event-card': {
        nestedArray: [{ arrayField: 'events', itemField: 'image', minCount: 2 }],
    },
    'blog-posts': {
        nestedArray: [{ arrayField: 'posts', itemField: 'image', minCount: 3 }],
    },
}

/**
 * Which block types should fetch stock images during gen.
 * Env var `PIXABAY_BLOCKS` overrides (comma-separated list).
 * Default: hero-only. Set to `all` to enable all block types — safe given
 * Pixabay's generous limit (~100 req/min ≈ 6000/hr).
 *
 * BLOCK_IMAGE_SPEC above is still used by cleanupNonNumericImageFields
 * and stripOrphanMediaRefs regardless — those only clean refs, not fetch.
 */
function getImageEnabledBlocks(): ReadonlySet<string> {
    const env = process.env.PIXABAY_BLOCKS?.trim()
    if (!env) return IMAGE_BLOCKS_DEFAULT
    if (env === 'all') return new Set(Object.keys(BLOCK_IMAGE_SPEC))
    return new Set(env.split(',').map((s) => s.trim()).filter(Boolean))
}
const IMAGE_BLOCKS_DEFAULT: ReadonlySet<string> = new Set(['hero'])

// GH-1185: blocks whose image slots show PEOPLE — routed to the dedicated
// portrait search (getAvatarMedia) instead of the product-keyword pool.
const PEOPLE_BLOCKS: ReadonlySet<string> = new Set(['testimonials', 'team', 'doctor-profile'])

// GH-1185: logo-cloud must NEVER receive stock/pool photos — client logos are
// name-only badges (monogram placeholder), not photo subjects. Kept separate
// from `BLOCK_IMAGE_SPEC['logo-cloud']`, which is still required by
// hydrateUrlUploadsToMedia / cleanupNonNumericImageFields / stripOrphanMediaRefs
// for real editor-uploaded logos. This set only excludes fulfillment planning.
const NO_STOCK_BLOCKS: ReadonlySet<string> = new Set(['logo-cloud'])

// Pool sizing: fetch/pre-upload only what the enabled blocks can consume,
// not a fixed 12+6. Buffer keeps enough surplus that pickManyFromPool can
// shuffle DISTINCT picks across same-role blocks (anti-duplication) — a pool
// sized to the exact count would hand every same-role block the identical set.
const POOL_BUFFER_FACTOR = 1.4
const POOL_MIN_EXTRA = 2

/**
 * Per-bucket pool size derived from the enabled image blocks — known entirely
 * pre-GPT (env + static specs), so this can size the pre-GPT pool build.
 *
 * A bucket's base = the LARGEST single-block need mapping to it (blocks share
 * the pool as a selection reservoir, they don't each consume a disjoint slice),
 * then padded by the diversity buffer and capped at the legacy default. People
 * blocks are excluded (avatars use getAvatarMedia, not the pool). A bucket with
 * no enabled block resolves to 0 → buildImagePool skips that Pixabay call.
 *
 * Default config (hero-only) → { landscape: 3, square: 0 } instead of 12+6.
 *
 * GH-1611: also returns the un-buffered base (`landscapeMin`/`squareMin`) — the
 * hungriest single block's need. buildImagePool uses it as the "bucket is
 * filled" threshold, so the fallback ladder keeps going until gallery's 6 slots
 * can actually be served from the pool instead of stopping at half the bucket
 * and leaving media-injector to patch the deficit with off-pool photos.
 */
export function computePoolBucketSizes(
    enabled: ReadonlySet<string> = getImageEnabledBlocks(),
): { landscape: number; square: number; landscapeMin: number; squareMin: number } {
    let landscapeBase = 0
    let squareBase = 0
    for (const blockType of enabled) {
        if (PEOPLE_BLOCKS.has(blockType)) continue
        // GH-1185: logo-cloud never consumes stock photos — exclude from sizing
        if (NO_STOCK_BLOCKS.has(blockType)) continue
        const spec = BLOCK_IMAGE_SPEC[blockType]
        if (!spec) continue
        const need = spec.nestedArray
            ? Math.max(...spec.nestedArray.map((a) => a.minCount ?? 1))
            : 1 // top-level fields share one Media ID → 1 slot per block
        const bucket = bucketForRole(roleForBlock(blockType))
        if (bucket === 'square') squareBase = Math.max(squareBase, need)
        else landscapeBase = Math.max(landscapeBase, need)
    }
    const sized = (base: number, cap: number) =>
        base === 0 ? 0 : Math.min(cap, Math.max(base + POOL_MIN_EXTRA, Math.ceil(base * POOL_BUFFER_FACTOR)))
    return {
        landscape: sized(landscapeBase, DEFAULT_LANDSCAPE_SIZE),
        square: sized(squareBase, DEFAULT_SQUARE_SIZE),
        landscapeMin: Math.min(landscapeBase, DEFAULT_LANDSCAPE_SIZE),
        squareMin: Math.min(squareBase, DEFAULT_SQUARE_SIZE),
    }
}


export interface ImageNeed {
    blockType: string
    count: number
    assign: (mediaIds: number[]) => void
}

/**
 * Actual pool capacity required after AI has produced every page/block.
 * Sum real slots so repeated block types can receive different photos, while
 * retaining the existing per-bucket caps that bound Pixabay and upload work.
 */
export function computePoolTargetsForNeeds(
    needs: ReadonlyArray<Pick<ImageNeed, 'blockType' | 'count'>>,
): { landscape: number; square: number } {
    let landscape = 0
    let square = 0
    for (const need of needs) {
        if (PEOPLE_BLOCKS.has(need.blockType) || NO_STOCK_BLOCKS.has(need.blockType)) continue
        const bucket = bucketForRole(roleForBlock(need.blockType))
        if (bucket === 'square') {
            square = Math.min(DEFAULT_SQUARE_SIZE, square + need.count)
        } else {
            landscape = Math.min(DEFAULT_LANDSCAPE_SIZE, landscape + need.count)
        }
    }
    return { landscape, square }
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
            return 'product'
        case 'property-card':
            // Real-estate photos are landscape; square bucket (6 photos) yields poor
            // squarish Unsplash results. Shares landscape bucket with gallery — seeds
            // differ per block type so picks are shuffled differently, but cross-block
            // photo duplication is possible when both appear on the same template.
            return 'gallery'
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
    const enabledBlocks = getImageEnabledBlocks()

    for (const block of blocks) {
        const blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (NO_STOCK_BLOCKS.has(blockType)) continue
        const spec = BLOCK_IMAGE_SPEC[blockType]
        if (!spec) continue
        if (!enabledBlocks.has(blockType)) continue

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

        // Nested array fields (gallery.images[].image, team.members[].avatar).
        // GH-1621: never pad with `{}` placeholders to reach `minCount` — a padded
        // item only gets an `image` assigned below, so any other Payload-required
        // field on that item (e.g. portfolio-grid.projects[].title) would stay empty.
        // Only inject images for items the AI actually generated — `minCount` here
        // is a pool-sizing hint for computePoolBucketSizes(), not a floor to pad to.
        // NOTE: this function's sole caller (generate-site/route.ts) creates pages as
        // `_status:'published'` (not draft), so it's fully Payload-validated at create
        // time regardless — a title-less padded item would already fail loudly there,
        // and generate-site also runs its own portfolio-grid title fallback afterward
        // (sanitizeBlocksForPayload). Removing the padding is still correct hygiene
        // (no reason to fabricate content-free array items) and protects any future
        // caller of planImageNeeds that lacks that same downstream safety net — but it
        // is not, by itself, a confirmed fix for the original GH-1621 Sentry incident.
        // The confirmed live gap for that failure mode is normalize-required-titles.ts
        // (edit-block's draft-editing path). See the GH-1621 journal entry.
        if (spec.nestedArray) {
            for (const { arrayField, itemField } of spec.nestedArray) {
                const arr = block[arrayField]
                if (!Array.isArray(arr) || arr.length === 0) continue
                const items = arr as AIBlock[]
                const count = items.length
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

    // 2. Query Payload to verify each media row has a usable file.
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

    // 3. Build the "valid" set.
    //
    // Plan 260415 F01-gen-audit hardening: the previous predicate
    // `filename || url` was trivially satisfied because Payload populates
    // `filename` via a hook BEFORE the S3 upload runs, and `url` is a
    // virtual field computed from filename+endpoint regardless of whether
    // the PUT succeeded. Every partial row looked valid → no stripping →
    // downstream FK failures on page insert.
    //
    // Stricter check: require BOTH filename AND mimeType AND filesize > 0.
    // These three are only written after the upload handler has buffered
    // the file; if the PUT to S3 later fails the row does exist but
    // filesize/mimeType can be null. This matches the "Failed to persist
    // upload data" warning pattern observed in staging logs.
    const valid = new Set<number>()
    const invalidReasons: string[] = []
    for (const doc of found) {
        const id = doc.id as number
        const filename = typeof doc.filename === 'string' ? doc.filename : ''
        const mimeType = typeof doc.mimeType === 'string' ? doc.mimeType : ''
        const filesize = typeof doc.filesize === 'number' ? doc.filesize : 0
        if (filename.length > 0 && mimeType.length > 0 && filesize > 0) {
            valid.add(id)
        } else {
            invalidReasons.push(`#${id}(fn=${filename ? 'y' : 'n'} mt=${mimeType ? 'y' : 'n'} sz=${filesize})`)
        }
    }
    // Also treat any id that wasn't returned by the find as invalid — Payload
    // may have rolled back the row entirely if the upload handler threw hard.
    for (const id of mediaIds) {
        if (!valid.has(id) && !invalidReasons.some((r) => r.startsWith(`#${id}(`))) {
            invalidReasons.push(`#${id}(missing row)`)
        }
    }
    if (invalidReasons.length > 0) {
        console.warn(
            `[stripOrphanMediaRefs] ${invalidReasons.length} orphan media ref(s) flagged: ${invalidReasons.slice(0, 10).join(', ')}${invalidReasons.length > 10 ? '…' : ''}`,
        )
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

    const category = ctx.category ?? 'business'

    // Group needs by blockType so we can do a single search per block type
    const groupedByBlock = new Map<string, ImageNeed[]>()
    for (const need of needs) {
        const list = groupedByBlock.get(need.blockType) ?? []
        list.push(need)
        groupedByBlock.set(need.blockType, list)
    }

    // Plan 260415 F01-gen-audit — parallelize across block types.
    // Each block-type fetch is independent (different Unsplash query + different
    // media upload targets). Running them concurrently cuts wall-clock from
    // ~sum(blockType) to ~max(blockType) — typically 30-60s → 5-10s.
    // batchFetch / batchFetchFromPool already use an internal semaphore
    // (CONCURRENCY) so we won't spike Unsplash beyond their rate limit.
    const start = Date.now()
    const curatedFallbackUsed = new Set<string>()
    const perBlockResults = await Promise.all(
        Array.from(groupedByBlock.entries()).map(async ([blockType, groupNeeds]) => {
            const totalCount = groupNeeds.reduce((sum, n) => sum + n.count, 0)
            if (totalCount === 0) return { blockType, groupNeeds, ids: [] as number[], reusable: true }
            const uniqueCount = Math.max(...groupNeeds.map((need) => need.count))
            const role = roleForBlock(blockType)
            const bucketCap = bucketForRole(role) === 'square'
                ? DEFAULT_SQUARE_SIZE
                : DEFAULT_LANDSCAPE_SIZE
            // Fetch enough IDs to keep repeated block instances distinct. The
            // cap prevents large sites from returning to the old 84-upload path;
            // a single oversized block may still request its full own count.
            const requestCount = Math.max(uniqueCount, Math.min(totalCount, bucketCap))
            const completeWithCuratedFallback = async (ids: number[]) => {
                if (ids.length >= requestCount) {
                    return { blockType, groupNeeds, ids: ids.slice(0, requestCount), reusable: true }
                }
                const fallback = await getCuratedFallbackMedia(
                    blockType,
                    requestCount - ids.length,
                    ctx,
                    payload,
                    curatedFallbackUsed,
                )
                if (fallback.failures.length > 0) {
                    console.warn(
                        `[Media Injector] ${blockType}: ${fallback.failures.length} curated fallback photo(s) failed`,
                    )
                }
                return { blockType, groupNeeds, ids: [...ids, ...fallback.mediaIds], reusable: true }
            }

            // GH-1185: people slots (testimonial avatars, team members,
            // doctor profiles) are PEOPLE — never pool photos (pool is built
            // from product keywords → food close-ups in face slots).
            // Dedicated portrait search; on provider miss use only the curated
            // people library, so product-pool photos never appear in face slots.
            if (PEOPLE_BLOCKS.has(blockType)) {
                try {
                    const result = await getAvatarMedia(requestCount, ctx.language, ctx, payload, blockType)
                    if (result.failures.length > 0) {
                        console.warn(
                            `[Media Injector] ${blockType}: ${result.failures.length} portrait photo(s) failed`,
                        )
                    }
                    return completeWithCuratedFallback(result.mediaIds)
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    console.warn(`[Media Injector] ${blockType} portrait fetch failed: ${msg}`)
                    return completeWithCuratedFallback([])
                }
            }

            // Phase-03 pool-aware fast path: pick from pre-built site pool to
            // preserve visual cohesion across blocks.
            if (ctx.pool) {
                const poolSeed = hashBlockSeed(blockType, ctx.businessName)
                const picks = pickManyFromPool(ctx.pool, role, poolSeed, requestCount)
                if (picks.length > 0) {
                    try {
                        const result = await batchFetchFromPool(picks, blockType, ctx, payload)
                        if (result.failures.length > 0) {
                            console.warn(
                                `[Media Injector] ${blockType}: ${result.failures.length} pool photo(s) failed`,
                            )
                        }
                        if (result.mediaIds.length >= requestCount) {
                            return completeWithCuratedFallback(result.mediaIds)
                        }
                        console.warn(
                            `[Media Injector] ${blockType} pool partial (${result.mediaIds.length}/${requestCount}) — reusing only after unique IDs are exhausted`,
                        )
                        // A separate search can return a photo already present in
                        // the pool under a new Media ID. Keep the partial unique set;
                        // the renderer fills only the missing slots with curated images.
                        return completeWithCuratedFallback(result.mediaIds)
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
                        console.warn(`[Media Injector] ${blockType} pool path failed, falling back to search: ${msg}`)
                    }
                } else {
                    console.warn(
                        `[Media Injector] ${blockType} pool picks empty (role=${role}) — falling back to legacy search`,
                    )
                }
            }

            // Legacy path: per-block Unsplash search (pool absent or empty).
            const keywords = deriveKeywords(category, blockType, {
                businessName: ctx.businessName,
                industry: ctx.category,
                language: ctx.language,
                products: ctx.products,
                mood: ctx.mood,
                englishKeywords: ctx.englishKeywords,
            })

            try {
                const result = await getMediaForBlock(blockType, keywords, requestCount, ctx, payload)
                if (result.failures.length > 0) {
                    console.warn(
                        `[Media Injector] ${blockType}: ${result.failures.length} photo(s) failed`,
                    )
                }
                return completeWithCuratedFallback(result.mediaIds)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.warn(`[Media Injector] ${blockType} fulfillment failed: ${msg}`)
                return completeWithCuratedFallback([])
            }
        }),
    )

    // Assign IDs to needs — must happen after the fetch phase so mutations on
    // the shared `blocks` tree are serialized (not concurrent with themselves).
    let succeeded = 0
    let failed = 0
    for (const r of perBlockResults) {
        let offset = 0
        let wrapped = false
        const greatestCommonDivisor = (a: number, b: number): number => {
            let left = Math.abs(a)
            let right = Math.abs(b)
            while (right !== 0) {
                const next = left % right
                left = right
                right = next
            }
            return left
        }
        const allocationStride = (poolSize: number, take: number): number => {
            if (poolSize <= 1) return 0
            let stride = Math.max(1, take % poolSize)
            while (greatestCommonDivisor(stride, poolSize) !== 1) {
                stride += 1
            }
            return stride % poolSize
        }
        for (const need of r.groupNeeds) {
            const take = Math.min(need.count, r.ids.length)
            const slice = r.reusable && take > 0
                ? Array.from({ length: take }, (_, index) => r.ids[(offset + index) % r.ids.length]!)
                : []
            if (slice.length > 0) {
                need.assign(slice)
                succeeded += slice.length
                failed += need.count - slice.length

                const rawNextOffset = offset + take
                if (!wrapped && rawNextOffset < r.ids.length) {
                    // Consume disjoint windows first while the pool can satisfy
                    // them without overlap.
                    offset = rawNextOffset
                } else if (!wrapped) {
                    wrapped = true
                    offset = take < r.ids.length ? 1 : 0
                } else {
                    // Once the first pass wraps, a stride coprime with the pool
                    // size visits every cyclic window before repeating.
                    offset = (offset + allocationStride(r.ids.length, take)) % r.ids.length
                }
            } else {
                failed += need.count
            }
        }
    }

    console.info(
        `[Media Injector] fulfilled ${succeeded}/${succeeded + failed} image slots across ${groupedByBlock.size} block type(s) in ${Date.now() - start}ms`,
    )
    return { succeeded, failed }
}

// ── Save pre-pass URL ingest ─────────────────────────────────────────────────

/** Hostnames whose images may be fetched and ingested as Payload Media records. */
const INGEST_ALLOWED_HOSTNAMES = new Set([
    'images.unsplash.com',
    'images.pexels.com',
    'cdn.pixabay.com',
    'lh3.googleusercontent.com',
    'res.cloudinary.com',
])

/** Test helper — exported for test isolation. No-op for static allowlist. */
export function __resetIngestAllowlistCache(): void {
    // Allowlist is statically defined — nothing to reset.
}

type IngestContext = { tenantId: string }
type MinimalPayload = { create: (args: unknown) => Promise<{ id: number }> }

/**
 * Converts a raw image field value to a Payload Media ID, uploading if needed.
 *
 * - number → return as-is
 * - {id: number} → extract id
 * - {url, alt?} or URL string on allowlisted host → fetch + upload → return new id
 * - anything else, disallowed host, or upload failure → return null (never throws)
 */
export async function ingestUrlToMediaIfNeeded(
    value: unknown,
    ctx: IngestContext,
    payload: MinimalPayload,
): Promise<number | null> {
    if (typeof value === 'number') return value

    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        if (typeof obj.id === 'number') return obj.id
    }

    let url: string | undefined
    let alt = ''
    if (typeof value === 'string') {
        url = value
    } else if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        if (typeof obj.url === 'string') {
            url = obj.url
            alt = typeof obj.alt === 'string' ? obj.alt : ''
        }
    }

    if (!url) return null

    let hostname: string
    try {
        hostname = new URL(url).hostname
    } catch {
        return null
    }

    if (!INGEST_ALLOWED_HOSTNAMES.has(hostname)) {
        console.warn(`[ingestUrlToMediaIfNeeded] host not in allowlist: ${hostname}`)
        return null
    }

    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buf = await res.arrayBuffer()
        const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
        const ext = mimeType.includes('png') ? 'png' : 'jpg'
        const uid = Math.random().toString(16).slice(2, 10).padEnd(8, '0')
        const fileName = `ingest-${uid}-${Date.now()}.${ext}`
        const result = await payload.create({
            collection: 'media',
            data: { tenant: ctx.tenantId, alt, aiGenerated: true },
            file: { name: fileName, data: Buffer.from(buf), mimetype: mimeType, size: buf.byteLength },
        })
        return result.id
    } catch {
        return null
    }
}

const MAX_INGEST_SLOTS = 50

/**
 * Walks all blocks using BLOCK_IMAGE_SPEC, finds image fields that hold URL objects
 * (not yet numeric Media IDs), and ingests them. Caps at 50 slots to bound latency.
 * Mutates blocks in place. Returns hydrated/failed/skipped counts.
 */
export async function hydrateUrlUploadsToMedia(
    blocks: Record<string, unknown>[],
    payload: MinimalPayload,
    ctx: IngestContext,
): Promise<{ hydrated: number; failed: number; skipped: number }> {
    if (blocks.length === 0) return { hydrated: 0, failed: 0, skipped: 0 }

    type Slot = { getValue: () => unknown; setValue: (id: number) => void }
    const slots: Slot[] = []

    for (const block of blocks) {
        const spec = BLOCK_IMAGE_SPEC[block.blockType as string]
        if (!spec) continue

        for (const field of spec.topLevel ?? []) {
            const val = block[field]
            if (val === undefined || typeof val === 'number') continue
            slots.push({ getValue: () => block[field], setValue: (id) => { block[field] = id } })
        }

        for (const { arrayField, itemField } of spec.nestedArray ?? []) {
            const arr = block[arrayField]
            if (!Array.isArray(arr)) continue
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i] as Record<string, unknown> | undefined
                if (!item) continue
                const val = item[itemField]
                if (val === undefined || typeof val === 'number') continue
                const ci = i
                slots.push({
                    getValue: () => (arr[ci] as Record<string, unknown>)[itemField],
                    setValue: (id) => { (arr[ci] as Record<string, unknown>)[itemField] = id },
                })
            }
        }
    }

    const toProcess = slots.slice(0, MAX_INGEST_SLOTS)
    const skipped = slots.length - toProcess.length
    let hydrated = 0
    let failed = 0

    for (const slot of toProcess) {
        const id = await ingestUrlToMediaIfNeeded(slot.getValue(), ctx, payload)
        if (id !== null) {
            slot.setValue(id)
            hydrated++
        } else {
            failed++
        }
    }

    return { hydrated, failed, skipped }
}
