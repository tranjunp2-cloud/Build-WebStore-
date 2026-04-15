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
            tenant: args.tenantId,
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
 * Hero fallback: hardcoded generic Unsplash URL, mirrors prior art in openai-image.ts.
 * Only used when Unsplash search returns empty or throws for hero block.
 */
async function heroFallbackChain(
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const HARDCODED = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop&q=80'
    try {
        const { buffer, mimetype } = await downloadPhotoBuffer(HARDCODED)
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
