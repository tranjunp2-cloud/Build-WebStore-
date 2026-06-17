/**
 * Media pipeline — orchestrates Unsplash search → download → Payload Media upload.
 *
 * Callers pass (blockType, keywords, count, ctx, payload) and receive Media IDs
 * ready to inject into block fields (hero.backgroundImage, gallery.images[].image, etc).
 *
 * Concurrency limited to 3 parallel downloads (avoid Unsplash 429 + Payload OOM).
 * Partial failure returns what succeeded; never throws.
 *
 * Alt-text attribution: per validation 2026-04-14 Q1, alt text format is
 * `${alt_description} — Photo by ${photographer} on Unsplash` to satisfy
 * Unsplash ToS without user-visible footer caption.
 *
 * Server-only. Do NOT import from client components.
 */

import {
    searchPhotos,
    trackDownload,
    downloadPhotoBuffer,
    buildImgixUrl,
    UNSPLASH_ORIENTATION_BY_BLOCK,
    UnsplashError,
    type UnsplashPhoto,
    type ImgixParams,
} from './unsplash-client'

import { resolveComposerCategory } from './composer-category-resolver'
import type { ThemeMood } from './theme-moods'
import type { ImagePool } from './image-pool'

export interface MediaPipelineContext {
    businessName: string
    tenantId: string
    category?: string
    // Plan 260414-2249 phase-01: user-supplied products drive primary Unsplash
    // query via deriveKeywords. vi/ms terms are translated at query time.
    products?: string[]
    // Plan 260414-2249 phase-02: theme mood appends 1-2 imagery adjectives
    // (warm/candlelit/minimalist/...) to every Unsplash query for cohesion.
    mood?: ThemeMood
    // Plan 260414-2249 phase-03: per-site image pool (1-2 Unsplash calls total
    // before fulfillment runs). When present, block needs pick from pool
    // instead of calling searchPhotos per block → visual cohesion by design.
    pool?: ImagePool
    // Plan 260424: LLM-translated English keywords to override hardcoded dictionaries
    englishKeywords?: string[]
}

export interface BatchFetchResult {
    mediaIds: number[]
    photos: UnsplashPhoto[]
    failures: Array<{ photoId: string; error: string }>
}

/** Size presets per block type — Payload auto-generates thumbnail/card/hero/square on upload. */
const SIZE_PRESET_BY_BLOCK: Record<string, ImgixParams> = {
    hero: { w: 1920, h: 1080, fit: 'crop' },
    gallery: { w: 1200, h: 800, fit: 'crop' },
    about: { w: 1200, h: 800, fit: 'crop' },
    'portfolio-grid': { w: 800, h: 1000, fit: 'crop' },
    team: { w: 400, h: 400, fit: 'crop', crop: 'faces' },
    testimonials: { w: 200, h: 200, fit: 'crop', crop: 'faces' },
    'logo-cloud': { w: 400, h: 200, fit: 'clip' },
}

const DEFAULT_PRESET: ImgixParams = { w: 1200, h: 800, fit: 'crop' }
const CONCURRENCY = 3

/** Minimal semaphore for bounded parallelism without extra deps. */
class Semaphore {
    private queue: Array<() => void> = []
    private active = 0
    constructor(private readonly max: number) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.max) {
            await new Promise<void>((resolve) => this.queue.push(resolve))
        }
        this.active++
        try {
            return await fn()
        } finally {
            this.active--
            const next = this.queue.shift()
            if (next) next()
        }
    }
}

/** Sanitize alt text — strip HTML tags, trim whitespace. */
function sanitizeAlt(raw: string | null | undefined): string {
    if (!raw) return ''
    return String(raw)
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
}

/**
 * Build the attribution-compliant alt text.
 * Format: `${description} — Photo by ${photographer} on Unsplash`
 */
function buildAttributedAlt(photo: UnsplashPhoto, fallbackContext: string): string {
    const desc = sanitizeAlt(photo.alt_description ?? photo.description) || fallbackContext
    const photographer = sanitizeAlt(photo.user.name) || photo.user.username
    return `${desc} — Photo by ${photographer} on Unsplash`
}

/** Pick up to `n` random photos from an array without replacement. */
function pickRandomN<T>(arr: T[], n: number): T[] {
    if (arr.length <= n) return [...arr]
    const copy = [...arr]
    const out: T[] = []
    while (out.length < n && copy.length > 0) {
        const idx = Math.floor(Math.random() * copy.length)
        out.push(copy[idx]!)
        copy.splice(idx, 1)
    }
    return out
}

/**
 * Upload a Buffer to Payload Media collection.
 * Exported so other modules (openai-image.ts future refactor) can reuse.
 */
export async function uploadBufferToMedia(
    payload: {
        create: (args: {
            collection: string
            data: Record<string, unknown>
            file: { data: Buffer; mimetype: string; name: string; size: number }
        }) => Promise<{ id: number }>
    },
    args: {
        buffer: Buffer
        filename: string
        mimetype: string
        alt: string
        tenantId: string
    },
): Promise<number> {
    const doc = await payload.create({
        collection: 'media',
        data: {
            alt: args.alt,
            aiGenerated: true,
        },
        file: {
            data: args.buffer,
            mimetype: args.mimetype,
            name: args.filename,
            size: args.buffer.length,
        },
    })
    return doc.id
}

/** Download + upload a single Unsplash photo; returns Media ID. */
async function fetchAndStorePhoto(
    photo: UnsplashPhoto,
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<number> {
    const preset = SIZE_PRESET_BY_BLOCK[blockType] ?? DEFAULT_PRESET
    const url = buildImgixUrl(photo.urls.raw, preset)
    const { buffer, mimetype } = await downloadPhotoBuffer(url)
    // Fire-and-forget download tracking — license-mandatory
    trackDownload(photo.links.download_location)
    const alt = buildAttributedAlt(photo, `${ctx.businessName} ${blockType}`)
    const extension = mimetype.includes('png') ? 'png' : 'jpg'
    const filename = `${blockType}-${photo.id}-${Date.now()}.${extension}`
    return uploadBufferToMedia(payload, {
        buffer,
        filename,
        mimetype,
        alt,
        tenantId: ctx.tenantId,
    })
}

/**
 * Download + upload a PoolPhoto (normalized Unsplash photo from image-pool).
 * Bridges the pool abstraction to the existing upload pipeline.
 *
 * Plan 260414-2249 phase-03.
 */
async function fetchAndStorePoolPhoto(
    photo: { id: string; url: string; alt: string; downloadLocation: string },
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<number> {
    const { buffer, mimetype } = await downloadPhotoBuffer(photo.url)
    // Fire-and-forget license-mandatory download tracking
    if (photo.downloadLocation) trackDownload(photo.downloadLocation)
    const extension = mimetype.includes('png') ? 'png' : 'jpg'
    const filename = `${blockType}-${photo.id}-${Date.now()}.${extension}`
    const alt = photo.alt || `${ctx.businessName} ${blockType}`
    return uploadBufferToMedia(payload, {
        buffer,
        filename,
        mimetype,
        alt,
        tenantId: ctx.tenantId,
    })
}

/**
 * Batch-download + upload pre-selected pool photos. Skips Unsplash search —
 * caller already picked from the site-level pool.
 *
 * Plan 260414-2249 phase-03: public API consumed by media-injector when
 * ctx.pool is present. Preserves partial-failure tolerance of batchFetch.
 */
export async function batchFetchFromPool(
    poolPhotos: Array<{ id: string; url: string; alt: string; downloadLocation: string }>,
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const mediaIds: number[] = []
    const failures: BatchFetchResult['failures'] = []
    const sem = new Semaphore(CONCURRENCY)
    await Promise.all(
        poolPhotos.map((photo) =>
            sem.run(async () => {
                try {
                    const id = await fetchAndStorePoolPhoto(photo, blockType, ctx, payload)
                    mediaIds.push(id)
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    failures.push({ photoId: photo.id, error: msg })
                    console.warn(`[Media Pipeline] pool photo ${photo.id} (${blockType}) failed: ${msg}`)
                }
            }),
        ),
    )
    return { mediaIds, photos: [], failures }
}

/** Concurrent batch fetch with partial-failure tolerance. */
async function batchFetch(
    photos: UnsplashPhoto[],
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const mediaIds: number[] = []
    const failures: BatchFetchResult['failures'] = []
    const sem = new Semaphore(CONCURRENCY)
    await Promise.all(
        photos.map((photo) =>
            sem.run(async () => {
                try {
                    const id = await fetchAndStorePhoto(photo, blockType, ctx, payload)
                    mediaIds.push(id)
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    failures.push({ photoId: photo.id, error: msg })
                    console.warn(`[Media Pipeline] failed photo ${photo.id} (${blockType}): ${msg}`)
                }
            }),
        ),
    )
    return { mediaIds, photos, failures }
}

/**
 * Per-category hero fallback Unsplash photo IDs — landscape 1920×1080.
 * Used when ALL Unsplash search attempts fail so the hero image still reflects
 * the business industry instead of a generic office hallway.
 * Exported for testing only.
 */
export const HERO_FALLBACK_BY_CATEGORY: Record<string, string[]> = {
    tech:       ['photo-1498050108023-c5249f4df085', 'photo-1460925895917-afdab827c52f', 'photo-1518770660439-4636190af475'],
    restaurant: ['photo-1414235077428-338989a2e8c0', 'photo-1504674900247-0877df9cc836'],
    beauty:     ['photo-1522335789203-aabd1fc54bc9', 'photo-1570172619644-dfd03ed5d881'],
    health:     ['photo-1576091160399-112ba8d25d1d', 'photo-1519494026892-80bbd2d6fd0d'],
    education:  ['photo-1546410531-bb4caa6b424d', 'photo-1503676260728-1c00da094a0b'],
    fitness:    ['photo-1571019614242-c5c5dee9f50b', 'photo-1534438327276-14e5300c3a48'],
    creative:   ['photo-1561070791-2526d30994b5', 'photo-1535303311164-664fc9ec6532'],
    business:   ['photo-1553877522-43269d4ea984', 'photo-1497366412874-3415097a27e7'],
    fnb:        ['photo-1453614512568-c4024d13c247', 'photo-1495474472287-4d71bcdd2085'],
    realestate: ['photo-1600596542815-ffad4c1539a9', 'photo-1560448204-e02f11c3d0e2'],
    events:     ['photo-1519167758481-83f550bb49b3', 'photo-1464366400600-7168b8af9bc3'],
    travel:     ['photo-1469474968028-56623f02e42e', 'photo-1488646953014-85cb44e25828'],
    ecommerce:  ['photo-1472851294608-062f824d29cc', 'photo-1441986300917-64674bd600d8'],
    blog:       ['photo-1499750310107-5fef28a66643', 'photo-1456324504439-367cee3b3c32'],
}

/** Exported for testing only. */
export function pickHeroFallbackUrl(rawCategory: string | undefined): string {
    const key = resolveComposerCategory(rawCategory ?? '')
    const list = HERO_FALLBACK_BY_CATEGORY[key] ?? HERO_FALLBACK_BY_CATEGORY['business']!
    const photoId = list[Math.floor(Math.random() * list.length)]!
    return `https://images.unsplash.com/${photoId}?w=1920&h=1080&fit=crop&q=80`
}

/**
 * Hero fallback: picks a category-appropriate Unsplash URL when all search
 * attempts fail, so every business gets an industry-relevant hero image.
 */
async function heroFallbackChain(
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const url = pickHeroFallbackUrl(ctx.category)
    try {
        const { buffer, mimetype } = await downloadPhotoBuffer(url)
        const id = await uploadBufferToMedia(payload, {
            buffer,
            filename: `hero-fallback-${Date.now()}.jpg`,
            mimetype,
            alt: `${ctx.businessName} — Stock Photo from Unsplash`,
            tenantId: ctx.tenantId,
        })
        return { mediaIds: [id], photos: [], failures: [] }
    } catch (err) {
        console.warn('[Media Pipeline] hero fallback chain exhausted', (err as Error).message)
        return { mediaIds: [], photos: [], failures: [] }
    }
}

/**
 * PUBLIC: fetch N images for a given block type + keyword set.
 *
 * Fallback chain:
 *   1. Unsplash search with given keywords (orientation + content_filter=high)
 *   2. Unsplash search with broadened keywords (keyword[0] only) — for hero only
 *   3. Hardcoded Unsplash stock URL — for hero only
 *   4. Return empty result — caller decides whether to drop the block
 */
export async function getMediaForBlock(
    blockType: string,
    keywords: string[],
    count: number,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const query = keywords.filter(Boolean).join(' ').trim()
    if (!query) {
        if (blockType === 'hero') return heroFallbackChain(ctx, payload)
        return { mediaIds: [], photos: [], failures: [] }
    }
    const orientation = UNSPLASH_ORIENTATION_BY_BLOCK[blockType] ?? 'landscape'
    try {
        // Request 2x count to have random pool, then pickRandomN
        const photos = await searchPhotos(query, Math.max(count * 2, 10), {
            orientation,
            contentFilter: 'high',
        })
        if (photos.length === 0) {
            // Broaden: try first keyword only
            if (keywords[0]) {
                const broader = await searchPhotos(keywords[0], Math.max(count * 2, 10), {
                    orientation,
                    contentFilter: 'high',
                })
                if (broader.length === 0) {
                    return blockType === 'hero'
                        ? heroFallbackChain(ctx, payload)
                        : { mediaIds: [], photos: [], failures: [] }
                }
                const picks = pickRandomN(broader, count)
                return batchFetch(picks, blockType, ctx, payload)
            }
            return blockType === 'hero'
                ? heroFallbackChain(ctx, payload)
                : { mediaIds: [], photos: [], failures: [] }
        }
        const picks = pickRandomN(photos, count)
        const result = await batchFetch(picks, blockType, ctx, payload)
        console.info(
            `[Media Pipeline] ${blockType}: ${result.mediaIds.length}/${count} uploaded (query="${query}")`,
        )
        return result
    } catch (err) {
        const msg = err instanceof UnsplashError ? err.code : (err as Error).message
        console.warn(`[Media Pipeline] ${blockType} search failed: ${msg}`)
        if (blockType === 'hero') return heroFallbackChain(ctx, payload)
        return { mediaIds: [], photos: [], failures: [{ photoId: 'search', error: msg }] }
    }
}
