/**
 * Pixabay HTTP client — pure wrapper, no Payload, no AI.
 *
 * Replaces the former Unsplash search client. Pixabay free tier allows ~100
 * req/60s (≈6000/hr) vs Unsplash demo 50/hr, so rate-limit fallbacks are rare.
 *
 * Usage:
 *   const photos = await searchPhotos('spa wellness', 10, { orientation: 'landscape', width: 1600 })
 *   for (const p of photos) {
 *     const { buffer, mimetype } = await downloadPhotoBuffer(p.url)  // p.url is pre-sized
 *   }
 *
 * Server-only. Do NOT import from client components.
 *
 * Auth: `key` query param (NOT a header). License: Pixabay Content License
 * (commercial OK, no attribution required, no download-tracking endpoint).
 * Pixabay ships FIXED sizes — no Imgix/query-param resize. `webformatURL` ~640px,
 * `largeImageURL` ~1280px. `fullHDURL`/original need full-API-access approval.
 */

export type PixabayOrientation = 'landscape' | 'portrait' | 'squarish'

/** Normalized photo — `url` is already sized by the client (no Imgix on Pixabay). */
export interface PixabayPhoto {
    id: string
    /** Ready-to-download URL, already sized. Pass straight to downloadPhotoBuffer. */
    url: string
    /** Comma-separated tags — used as alt-text source (pre-sanitize). */
    alt: string | null
    /** Uploader display name. */
    photographer: string
    width: number
    height: number
}

export interface PixabaySearchOptions {
    orientation?: PixabayOrientation
    /** Target render width — client picks largeImageURL (≥900) or webformatURL. */
    width?: number
    page?: number
}

export interface DownloadResult {
    buffer: Buffer
    mimetype: string
    size: number
}

/** Raw Pixabay API hit (subset we read). */
interface PixabayHit {
    id: number
    webformatURL: string
    largeImageURL: string
    tags: string
    user: string
    imageWidth: number
    imageHeight: number
}

interface PixabaySearchResponse {
    total: number
    totalHits: number
    hits: PixabayHit[]
}

/**
 * Discriminated error class — SAME 9-member code union as the former
 * UnsplashError, so existing `err.code === 'RATE_LIMITED'` branches keep working.
 */
export class PixabayError extends Error {
    constructor(
        public readonly code:
            | 'NO_KEY'
            | 'UNAUTHORIZED'
            | 'RATE_LIMITED'
            | 'SERVER_ERROR'
            | 'DOWNLOAD_FAIL'
            | 'TOO_LARGE'
            | 'TIMEOUT'
            | 'SSRF_BLOCKED'
            | 'EMPTY_RESULTS',
        public readonly status: number,
        public readonly retryable: boolean,
        message?: string,
    ) {
        super(message ?? `[Pixabay] ${code} (status=${status})`)
        this.name = 'PixabayError'
    }
}

const BASE = 'https://pixabay.com/api/'
// SSRF allowlist: Pixabay hit/CDN hosts + the static curated Unsplash fallback
// hosts (hero / blog / product fallbacks still hotlink images.unsplash.com and
// download through this same guard). Dropping the Unsplash hosts breaks them.
const DOWNLOAD_HOST_ALLOWLIST = [
    'pixabay.com',
    'cdn.pixabay.com',
    'images.unsplash.com',
    'plus.unsplash.com',
]
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 10_000_000 // 10 MB
const RATE_LIMIT_WARN_THRESHOLD = 20
const LARGE_SIZE_MIN_WIDTH = 700 // ≥ this → largeImageURL (1280px), else webformatURL (640px)

/** Recommended orientation per block type — used by media-pipeline callers. */
export const PIXABAY_ORIENTATION_BY_BLOCK: Record<string, PixabayOrientation> = {
    hero: 'landscape',
    gallery: 'landscape',
    about: 'landscape',
    'portfolio-grid': 'portrait',
    team: 'squarish',
    testimonials: 'squarish',
    'logo-cloud': 'squarish',
}

const ORIENTATION_MAP: Record<PixabayOrientation, string> = {
    landscape: 'horizontal',
    portrait: 'vertical',
    squarish: 'all',
}

function hasPixabayKey(): boolean {
    const key = process.env.PIXABAY_API_KEY
    return Boolean(key && key.length >= 10)
}

function getKey(): string {
    const key = process.env.PIXABAY_API_KEY
    if (!key || key.length < 10) {
        throw new PixabayError('NO_KEY', 0, false, 'PIXABAY_API_KEY not set or invalid')
    }
    return key
}

// Log the "no key" warning ONCE per process so we don't spam the dev console.
let pixabayKeyWarningLogged = false
function warnNoKeyOnce(): void {
    if (pixabayKeyWarningLogged) return
    pixabayKeyWarningLogged = true
    console.warn(
        '[Pixabay] PIXABAY_API_KEY not set — image pipeline will skip pool + per-block searches. ' +
            'Set the key in .env.local to enable stock photography (copy from Vercel Dashboard staging env).',
    )
}

function logRateLimit(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining')
    if (remaining != null) {
        const n = Number(remaining)
        if (Number.isFinite(n) && n < RATE_LIMIT_WARN_THRESHOLD) {
            console.warn(`[Pixabay] rate limit low: ${n} requests remaining`)
        }
    }
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let attempt = 0
    while (attempt <= 1) {
        try {
            const res = await fetch(url, init)
            if (res.ok) return res
            if (res.status === 401 || res.status === 403) {
                throw new PixabayError('UNAUTHORIZED', res.status, false)
            }
            if (res.status === 429 || res.status >= 500) {
                if (attempt === 0) {
                    attempt++
                    const jitter = 2000 + Math.floor(Math.random() * 500)
                    await new Promise((r) => setTimeout(r, jitter))
                    continue
                }
                throw new PixabayError(
                    res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
                    res.status,
                    true,
                )
            }
            throw new PixabayError('SERVER_ERROR', res.status, false)
        } catch (err) {
            if (err instanceof PixabayError) throw err
            if (err instanceof Error && err.name === 'AbortError') {
                throw new PixabayError('TIMEOUT', 0, true, err.message)
            }
            if (attempt === 0) {
                attempt++
                await new Promise((r) => setTimeout(r, 1500))
                continue
            }
            throw new PixabayError('SERVER_ERROR', 0, false, (err as Error).message)
        }
    }
    throw new PixabayError('SERVER_ERROR', 0, false, 'retry exhausted')
}

/** Pick the pre-sized URL for a hit given the caller's target width. */
function pickSizedUrl(hit: PixabayHit, targetWidth?: number): string {
    const wantsLarge = targetWidth == null || targetWidth >= LARGE_SIZE_MIN_WIDTH
    if (wantsLarge && hit.largeImageURL) return hit.largeImageURL
    return hit.webformatURL || hit.largeImageURL
}

/**
 * Search Pixabay photos. Returns up to `count` normalized photos.
 * Empty array if no results — not thrown.
 *
 * When `PIXABAY_API_KEY` is missing (common on fresh local dev), returns `[]`
 * gracefully instead of throwing. Downstream callers already handle empty
 * results via backoff + cleanup paths, so the gen pipeline stays healthy.
 */
export async function searchPhotos(
    query: string,
    count: number,
    opts: PixabaySearchOptions = {},
): Promise<PixabayPhoto[]> {
    if (!query.trim()) return []
    if (!hasPixabayKey()) {
        warnNoKeyOnce()
        return []
    }
    // Pixabay has no 'squarish' orientation (mapped to 'all'). Over-fetch candidates
    // so we can prefer near-square hits for avatar/team buckets — see reordering below.
    const isSquarish = opts.orientation === 'squarish'
    // Pixabay per_page min is 3 — clamp low side, then slice to requested count.
    const perPage = Math.min(Math.max(isSquarish ? count * 3 : count, 3), 200)
    const params = new URLSearchParams({
        key: getKey(),
        q: query.trim().slice(0, 100),
        image_type: 'photo',
        orientation: ORIENTATION_MAP[opts.orientation ?? 'landscape'],
        per_page: String(perPage),
        safesearch: 'true',
        page: String(opts.page ?? 1),
    })

    const url = `${BASE}?${params.toString()}`
    const res = await fetchWithRetry(url, {
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
    logRateLimit(res.headers)
    const json = (await res.json()) as PixabaySearchResponse
    let hits = Array.isArray(json.hits) ? json.hits : []
    if (isSquarish) {
        // Stable-prefer near-square hits, fall back to the rest to still fill count.
        const isNearSquare = (h: PixabayHit): boolean => {
            const ar = h.imageWidth / Math.max(h.imageHeight, 1)
            return ar >= 0.8 && ar <= 1.25
        }
        hits = [...hits.filter(isNearSquare), ...hits.filter((h) => !isNearSquare(h))]
    }
    return hits.slice(0, count).map((hit) => ({
        id: String(hit.id),
        url: pickSizedUrl(hit, opts.width),
        alt: hit.tags || null,
        photographer: hit.user,
        width: hit.imageWidth,
        height: hit.imageHeight,
    }))
}

/** SSRF guard: URL host must be in the allowlist (Pixabay or static-fallback hosts). */
function isAllowedDownloadUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        return DOWNLOAD_HOST_ALLOWLIST.includes(parsed.hostname)
    } catch {
        return false
    }
}

/**
 * Download a photo URL to a Buffer. Caps at 10 MB by default, 15s timeout.
 * SSRF-guarded: URL must be an allowlisted host.
 */
export async function downloadPhotoBuffer(
    url: string,
    maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<DownloadResult> {
    if (!isAllowedDownloadUrl(url)) {
        throw new PixabayError('SSRF_BLOCKED', 0, false, `URL host not in allowlist: ${url}`)
    }
    let res: Response
    try {
        res = await fetch(url, {
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
            headers: { 'User-Agent': 'ech-prime-web-v2/1.0' },
        })
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new PixabayError('TIMEOUT', 0, true, err.message)
        }
        throw new PixabayError('DOWNLOAD_FAIL', 0, true, (err as Error).message)
    }
    if (!res.ok) {
        throw new PixabayError('DOWNLOAD_FAIL', res.status, res.status >= 500)
    }
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > maxBytes) {
        throw new PixabayError('TOO_LARGE', 413, false, `${buffer.length} > ${maxBytes}`)
    }
    return {
        buffer,
        mimetype: res.headers.get('content-type') ?? 'image/jpeg',
        size: buffer.length,
    }
}
