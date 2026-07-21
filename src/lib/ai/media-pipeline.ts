/**
 * Media pipeline — orchestrates Pixabay search → download → Payload Media upload.
 *
 * Callers pass (blockType, keywords, count, ctx, payload) and receive Media IDs
 * ready to inject into block fields (hero.backgroundImage, gallery.images[].image, etc).
 *
 * Concurrency: pool-based downloads use POOL_CONCURRENCY (6) so a full gallery block
 * (6-8 photos) downloads in 1 batch. Legacy search path keeps SEARCH_CONCURRENCY (3)
 * to avoid search 429s. Payload OOM: 6 × ~2MB = 12MB/block, well within limits.
 * Partial failure returns what succeeded; never throws.
 *
 * Alt-text: Pixabay license requires no attribution; alt text is built from the
 * photo tags + uploader as `${description} — Photo by ${photographer}`.
 *
 * Provider-outage fallbacks use curated category-aware images.unsplash.com URLs
 * (no API key), download them through the SSRF allowlist, and persist them.
 *
 * Server-only. Do NOT import from client components.
 */

import {
    searchPhotos,
    downloadPhotoBuffer,
    detectQueryLang,
    photoMatchesTerms,
    PIXABAY_CATEGORY_BY_COMPOSER,
    PIXABAY_ORIENTATION_BY_BLOCK,
    PixabayError,
    type PixabayPhoto,
} from './pixabay-client'
import { withMediaCreateLock } from './media-create-lock'

/** Render-box width per block — drives Pixabay size pick (largeImageURL vs webformatURL). */
interface SizePreset {
    w: number
}

import { normalizeComposerCategory } from './composer-category-resolver'
import { CATEGORY_BASE_KEYWORDS } from './image-keywords'
import type { ThemeMood } from './theme-moods'
import { VN_CATEGORY_QUERIES, type ImagePool } from './image-pool'
import { getIndustryImages, IMAGE_LIBRARY } from '@/lib/images/industry-images'

export interface MediaPipelineContext {
    businessName: string
    tenantId: string
    // Industry — either the raw user string ("nhà hàng hải sản", "SaaS CRM")
    // or an already-resolved composer key ('restaurant', 'fnb', …). Both are
    // handled via normalizeComposerCategory (GH-1185: the route passes the
    // resolved pool category, and resolveComposerCategory alone is not
    // idempotent — 'fnb' would re-resolve to 'business').
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
    // Plan 260703 Phase 06 (gen-perf) — pool photo id -> Media id, populated
    // during the GPT window when GEN_POOL_PREUPLOAD=true. batchFetchFromPool
    // consumes this to skip download+upload for photos already persisted.
    // Absent/empty when the flag is off — falls through to the legacy inline
    // download+upload path unchanged.
    preUploadedPool?: Map<string, number>
    // Request-scoped fence checked inside serialized media writes.
    assertCanWrite?: () => void
}

export interface BatchFetchResult {
    mediaIds: number[]
    photos: PixabayPhoto[]
    failures: Array<{ photoId: string; error: string }>
}

/** Size presets per block type — Payload auto-generates thumbnail/card/hero/square on upload. */
const SIZE_PRESET_BY_BLOCK: Record<string, SizePreset> = {
    hero: { w: 1920 },
    gallery: { w: 1200 },
    about: { w: 1200 },
    'portfolio-grid': { w: 800 },
    team: { w: 400 },
    testimonials: { w: 200 },
    'logo-cloud': { w: 400 },
}

const DEFAULT_PRESET: SizePreset = { w: 1200 }
// Pool downloads: CDN has no rate limit — 6 concurrent covers a full gallery block (6-8 photos)
// in 1 batch while staying conservative enough to avoid CDN 404 bursts on demo keys.
const POOL_CONCURRENCY = 6
// Legacy per-block Unsplash search path: keep conservative to avoid search API 429s.
const SEARCH_CONCURRENCY = 3

/**
 * Minimal semaphore for bounded parallelism without extra deps.
 * Exported so `pool-preupload.ts` (Phase 06 — gen-perf plan 260703) reuses the
 * same bounded-concurrency pattern instead of duplicating it (DRY).
 */
export class Semaphore {
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
 * Build descriptive alt text from the photo tags + uploader.
 * Pixabay license requires no attribution, but a photographer credit keeps the
 * alt informative. Format: `${description} — Photo by ${photographer}`
 */
function buildAttributedAlt(photo: PixabayPhoto, fallbackContext: string): string {
    const desc = sanitizeAlt(photo.alt) || fallbackContext
    const photographer = sanitizeAlt(photo.photographer)
    return photographer ? `${desc} — Photo by ${photographer}` : desc
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
        assertCanWrite?: () => void
    },
): Promise<number> {
    const createArgs = {
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
    }
    // GH-1185: DB create is serialized via withMediaCreateLock — concurrent
    // media creates silently lose rows (drizzle transaction race, see
    // media-create-lock.ts). Downloads/S3 stay parallel upstream.
    try {
        const doc = await withMediaCreateLock(() => {
            args.assertCanWrite?.()
            return payload.create(createArgs)
        })
        return doc.id
    } catch (err) {
        args.assertCanWrite?.()
        // Belt & braces for genuinely transient failures (network, S3 hiccup).
        console.warn(
            `[Media Pipeline] media create failed for ${args.filename}, retrying once: ${err instanceof Error ? err.message : String(err)}`,
        )
        await new Promise((r) => setTimeout(r, 300))
        const doc = await withMediaCreateLock(() => {
            args.assertCanWrite?.()
            return payload.create(createArgs)
        })
        return doc.id
    }
}

/** Download + upload a single Pixabay photo; returns Media ID. */
async function fetchAndStorePhoto(
    photo: PixabayPhoto,
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<number> {
    // photo.url is already sized by the client (Pixabay ships fixed sizes).
    const { buffer, mimetype } = await downloadPhotoBuffer(photo.url)
    const alt = buildAttributedAlt(photo, `${ctx.businessName} ${blockType}`)
    const extension = mimetype.includes('png') ? 'png' : 'jpg'
    const filename = `${blockType}-${photo.id}-${Date.now()}.${extension}`
    return uploadBufferToMedia(payload, {
        buffer,
        filename,
        mimetype,
        alt,
        tenantId: ctx.tenantId,
        assertCanWrite: ctx.assertCanWrite,
    })
}

/**
 * Download + upload a PoolPhoto (normalized Pixabay photo from image-pool).
 * Bridges the pool abstraction to the existing upload pipeline.
 *
 * Plan 260414-2249 phase-03.
 */
async function fetchAndStorePoolPhoto(
    photo: { id: string; url: string; alt: string },
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<number> {
    const { buffer, mimetype } = await downloadPhotoBuffer(photo.url)
    const extension = mimetype.includes('png') ? 'png' : 'jpg'
    const filename = `${blockType}-${photo.id}-${Date.now()}.${extension}`
    const alt = photo.alt || `${ctx.businessName} ${blockType}`
    return uploadBufferToMedia(payload, {
        buffer,
        filename,
        mimetype,
        alt,
        tenantId: ctx.tenantId,
        assertCanWrite: ctx.assertCanWrite,
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
    poolPhotos: Array<{ id: string; url: string; alt: string }>,
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const mediaIds: number[] = []
    const failures: BatchFetchResult['failures'] = []

    // Plan 260703 Phase 06 — reuse Media IDs pre-uploaded during the GPT
    // window (GEN_POOL_PREUPLOAD=true). When the flag is off/empty this map
    // is undefined/empty so every photo falls through to the inline path
    // below, identical to pre-Phase-06 behavior.
    const preUploaded = ctx.preUploadedPool
    const toFetch: Array<{ id: string; url: string; alt: string }> = []
    if (preUploaded && preUploaded.size > 0) {
        for (const photo of poolPhotos) {
            const cachedId = preUploaded.get(photo.id)
            if (cachedId != null) {
                mediaIds.push(cachedId)
            } else {
                toFetch.push(photo)
            }
        }
    } else {
        toFetch.push(...poolPhotos)
    }

    if (toFetch.length === 0) {
        return { mediaIds, photos: [], failures }
    }

    const sem = new Semaphore(POOL_CONCURRENCY)
    await Promise.all(
        toFetch.map((photo) =>
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

/**
 * Concurrent batch fetch with partial-failure tolerance.
 * INVARIANT: never rejects — every per-photo error is caught inside the
 * semaphore closure and returned via `failures`. Callers rely on this to
 * `return batchFetch(...)` un-awaited inside try/catch (getMediaForBlock);
 * moving any throwing call outside the inner try reintroduces review
 * finding H1 (PR #1481).
 */
async function batchFetch(
    photos: PixabayPhoto[],
    blockType: string,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<BatchFetchResult> {
    const mediaIds: number[] = []
    const failures: BatchFetchResult['failures'] = []
    const sem = new Semaphore(SEARCH_CONCURRENCY)
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
export const HERO_FALLBACK_BY_CATEGORY: Readonly<Record<string, readonly string[]>> = {
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
    const key = normalizeComposerCategory(rawCategory)
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
            assertCanWrite: ctx.assertCanWrite,
        })
        return { mediaIds: [id], photos: [], failures: [] }
    } catch (err) {
        console.warn('[Media Pipeline] hero fallback chain exhausted', (err as Error).message)
        return { mediaIds: [], photos: [], failures: [] }
    }
}

function curatedUrlKey(url: string): string {
    return url.match(/photo-[^?&/]+/)?.[0] ?? url.split('?')[0]!
}

function curatedFallbackCandidates(blockType: string, rawCategory: string | undefined): string[] {
    const category = normalizeComposerCategory(rawCategory)
    const primary = getIndustryImages(category)
    const business = getIndustryImages('business')
    const isPeople = blockType === 'team' || blockType === 'testimonials' || blockType === 'doctor-profile'
    const isProduct = blockType === 'products-grid' || blockType === 'products-featured'

    const preferred = isPeople
        ? [...primary.team, ...business.team]
        : isProduct
            ? [...primary.products, ...primary.gallery, ...primary.features, primary.about, ...primary.hero]
            : [...primary.gallery, ...primary.features, primary.about, ...primary.hero, ...primary.products]
    const reserve = isPeople
        ? Object.values(IMAGE_LIBRARY).flatMap((images) => images.team)
        : Object.values(IMAGE_LIBRARY).flatMap((images) => [
            ...images.gallery,
            ...images.features,
            images.about,
            ...images.hero,
            ...images.products,
        ])

    const seen = new Set<string>()
    return [...preferred, ...reserve].filter((url) => {
        const key = curatedUrlKey(url)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

/** Persist deterministic category-aware media when Pixabay is unavailable.
 * The request-scoped used set prevents the same underlying photo from being
 * assigned to multiple generated blocks, even when library URLs use different sizes. */
export async function getCuratedFallbackMedia(
    blockType: string,
    count: number,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
    usedUrlKeys: Set<string>,
): Promise<BatchFetchResult> {
    if (count <= 0) return { mediaIds: [], photos: [], failures: [] }

    const selected: Array<{ url: string; key: string }> = []
    for (const url of curatedFallbackCandidates(blockType, ctx.category)) {
        const key = curatedUrlKey(url)
        if (usedUrlKeys.has(key)) continue
        usedUrlKeys.add(key)
        selected.push({ url, key })
        if (selected.length >= count) break
    }

    const semaphore = new Semaphore(3)
    const settled: Array<{ id: number; key: string } | { key: string; error: string }> = await Promise.all(selected.map(({ url, key }, index) => semaphore.run(async () => {
        try {
            const { buffer, mimetype } = await downloadPhotoBuffer(url)
            const extension = mimetype.includes('png') ? 'png' : 'jpg'
            const id = await uploadBufferToMedia(payload, {
                buffer,
                filename: `${blockType}-curated-${key}-${Date.now()}-${index}.${extension}`,
                mimetype,
                alt: `${ctx.businessName} ${blockType}`,
                tenantId: ctx.tenantId,
                assertCanWrite: ctx.assertCanWrite,
            })
            return { id, key }
        } catch (error) {
            return { key, error: error instanceof Error ? error.message : String(error) }
        }
    })))

    return {
        mediaIds: settled.flatMap((result) => 'id' in result ? [result.id] : []),
        photos: [],
        failures: settled.flatMap((result) => 'error' in result
            ? [{ photoId: result.key, error: result.error }]
            : []),
    }
}

/**
 * GH-1185: people-slot photos (testimonial avatars, team members, doctor
 * profiles) must be PEOPLE, not the site's product/food photos — the shared
 * pool is built from product keywords, so these slots were getting bánh khọt
 * close-ups. Language-matched portrait query + Pixabay category=people;
 * squarish for round avatar crops.
 * Returns empty on miss — an empty slot (initials placeholder) reads better
 * than a food photo in a face slot, so callers must NOT fall back to the pool.
 */
const AVATAR_QUERY_BY_LANG: Readonly<Record<string, string>> = {
    vi: 'chân dung người việt',
    ms: 'asian portrait',
}

export async function getAvatarMedia(
    count: number,
    language: string | undefined,
    ctx: MediaPipelineContext,
    payload: Parameters<typeof uploadBufferToMedia>[0],
    blockType: string = 'testimonials',
): Promise<BatchFetchResult> {
    const query = AVATAR_QUERY_BY_LANG[language ?? ''] ?? 'portrait people'
    try {
        const photos = await searchPhotos(query, Math.max(count * 3, 10), {
            orientation: 'squarish',
            width: (SIZE_PRESET_BY_BLOCK[blockType] ?? DEFAULT_PRESET).w,
            category: 'people',
        })
        if (photos.length === 0) return { mediaIds: [], photos: [], failures: [] }
        return batchFetch(pickRandomN(photos, count), blockType, ctx, payload)
    } catch (err) {
        const msg = err instanceof PixabayError ? err.code : (err as Error).message
        console.warn(`[Media Pipeline] avatar search failed (${blockType}): ${msg}`)
        return { mediaIds: [], photos: [], failures: [{ photoId: 'avatar-search', error: msg }] }
    }
}

/**
 * PUBLIC: fetch N images for a given block type + keyword set.
 *
 * Fallback chain:
 *   1. Pixabay search with given keywords (orientation + VN relevance gate)
 *   2. Pixabay search with broadened keywords (keyword[0] only)
 *   3. Category fallback — curated VN phrase (VN query) or English category
 *      base keyword (non-VN query)
 *   4. Hardcoded Unsplash stock URL — for hero only
 *   5. Return empty result — caller decides whether to drop the block
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
    const orientation = PIXABAY_ORIENTATION_BY_BLOCK[blockType] ?? 'landscape'
    const targetWidth = (SIZE_PRESET_BY_BLOCK[blockType] ?? DEFAULT_PRESET).w
    const composerCategory = normalizeComposerCategory(ctx.category)
    // GH-1185: domain filter — keeps loose/fallback matches on-topic (see
    // PixabaySearchOptions.category). Unmapped composer categories → no filter.
    const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[composerCategory]
    // GH-1185: queries get the same relevance gate as the pool path — Pixabay
    // AND-matching is loose ("phở bò" hits a moose photo tagged "bò đực").
    // GH-1611: gate EVERY language (the gate used to run for Vietnamese only,
    // while the default pipeline searches in English) and gate on the keyword
    // TERMS rather than the joined query, so a multi-product query does not
    // demand one photo satisfy every product at once.
    const isVN = detectQueryLang(query) === 'vi'
    // Gate ONLY on the user's product terms (the raw-keyword path). On the
    // scaffolding path `keywords` is category base + block modifier + mood
    // adjectives — gating on those would both admit off-industry photos (a
    // 1-word adjective like "minimalist" matches a clothing flatlay) and reject
    // on-industry ones, leaving non-hero blocks with no image at all.
    const subjectTerms = (ctx.englishKeywords ?? []).map((k) => k.trim()).filter(Boolean)
    const categoryMapped = Boolean(PIXABAY_CATEGORY_BY_COMPOSER[composerCategory])
    const gateTerms = (photos: PixabayPhoto[], terms: string[]): PixabayPhoto[] => {
        if (terms.length === 0) {
            if (categoryMapped) return photos
            return []
        }
        const kept = photos.filter((p) => photoMatchesTerms(p.alt, terms))
        if (kept.length < photos.length) {
            console.info(
                `[Media Pipeline] ${blockType} relevance gate: ${kept.length}/${photos.length} match "${terms.join(' | ')}"`,
            )
        }
        return kept
    }
    // Tier 3 broadens the search with a category phrase, then applies the same
    // trusted product gate as earlier tiers. VN queries use the curated Vietnamese
    // phrase (lang=vi); non-VN queries (Malay/English zero-hit) fall to the
    // English category base keyword — an empty result here means the block
    // keeps whatever URL GPT hallucinated into it (GH-1185 QC retest).
    const categoryFallback = async (): Promise<BatchFetchResult> => {
        const vnQuery = isVN ? VN_CATEGORY_QUERIES[composerCategory] : undefined
        const fallbackQuery = vnQuery ?? CATEGORY_BASE_KEYWORDS[composerCategory]?.[0]
        // `!== keywords[0]` guard: tier-2 broadens to keywords[0], and on the
        // scaffolding path deriveKeywords puts a random CATEGORY_BASE_KEYWORDS
        // entry there — re-issuing the byte-identical just-failed search
        // wastes a rate-limited Pixabay call.
        if (fallbackQuery && fallbackQuery !== query && fallbackQuery !== keywords[0]?.trim()) {
            // lang:'vi' explicit for VN phrases — mirrors image-pool
            // searchBucket; curated phrases like "quán cà phê" are not
            // script-detectable. EN base keywords use the default lang.
            const photos = await searchPhotos(fallbackQuery, Math.max(count * 2, 10), {
                orientation,
                width: targetWidth,
                category: pixCategory,
                ...(vnQuery ? { lang: 'vi' as const } : {}),
            })
            // Keep the merchant's product terms as the relevance contract on
            // every tier. A Pixabay category only constrains the broad industry;
            // it cannot distinguish a bakery photo from another food product.
            // gateTerms handles the no-product case: mapped categories may rely
            // on the server-side filter, while unmapped categories reject all.
            const gatedPhotos = gateTerms(photos, subjectTerms)
            if (gatedPhotos.length > 0) {
                console.info(
                    `[Media Pipeline] ${blockType} category fallback "${fallbackQuery}": ${gatedPhotos.length}/${photos.length} photo(s)`,
                )
                return batchFetch(pickRandomN(gatedPhotos, count), blockType, ctx, payload)
            }
        }
        return blockType === 'hero'
            ? heroFallbackChain(ctx, payload)
            : { mediaIds: [], photos: [], failures: [] }
    }
    try {
        // Request 2x count to have random pool, then pickRandomN
        const photos = gateTerms(
            await searchPhotos(query, Math.max(count * 2, 10), {
                orientation,
                width: targetWidth,
                category: pixCategory,
            }),
            subjectTerms,
        )
        if (photos.length === 0) {
            // Broaden: try first keyword only. Skip when the query was already
            // a single term — the retry would re-issue the identical Pixabay
            // call (raw 1-term keywords are common after GH-1185).
            if (keywords[0] && keywords[0].trim() !== query) {
                const broadQuery = keywords[0].trim()
                const broader = gateTerms(
                    await searchPhotos(broadQuery, Math.max(count * 2, 10), {
                        orientation,
                        width: targetWidth,
                        category: pixCategory,
                    }),
                    // Broadening changes only the SEARCH query. Relevance remains
                    // anchored to all trusted merchant product terms, otherwise an
                    // ambiguous first keyword can admit the wrong product at tier 2.
                    subjectTerms,
                )
                if (broader.length === 0) {
                    // `await` is load-bearing: categoryFallback can throw
                    // (unguarded searchPhotos) — without it the rejection
                    // escapes this try/catch and hero loses its fallback chain.
                    return await categoryFallback()
                }
                const picks = pickRandomN(broader, count)
                return batchFetch(picks, blockType, ctx, payload)
            }
            // See comment above — `await` keeps the rejection inside this catch.
            return await categoryFallback()
        }
        const picks = pickRandomN(photos, count)
        const result = await batchFetch(picks, blockType, ctx, payload)
        console.info(
            `[Media Pipeline] ${blockType}: ${result.mediaIds.length}/${count} uploaded (query="${query}")`,
        )
        return result
    } catch (err) {
        const msg = err instanceof PixabayError ? err.code : (err as Error).message
        console.warn(`[Media Pipeline] ${blockType} search failed: ${msg}`)
        if (blockType === 'hero') return heroFallbackChain(ctx, payload)
        return { mediaIds: [], photos: [], failures: [{ photoId: 'search', error: msg }] }
    }
}
