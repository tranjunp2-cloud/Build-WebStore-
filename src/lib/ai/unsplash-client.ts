/**
 * Unsplash HTTP client — pure wrapper, no Payload, no AI.
 *
 * Usage:
 *   const photos = await searchPhotos('spa wellness', 10, { orientation: 'landscape' })
 *   for (const p of photos) {
 *     const { buffer, mimetype } = await downloadPhotoBuffer(buildImgixUrl(p.urls.raw, { w: 1600, h: 900 }))
 *     trackDownload(p.links.download_location)  // fire-and-forget, license-mandatory
 *   }
 *
 * Server-only. Do NOT import from client components.
 *
 * Auth: `Authorization: Client-ID ${UNSPLASH_ACCESS_KEY}` header (NOT Bearer).
 * Rate limits: demo 50/hr, production 5000/hr. Logged when < 100 remaining.
 * License: Unsplash License (commercial OK, attribution recommended via alt text).
 */

export type UnsplashOrientation = 'landscape' | 'portrait' | 'squarish'
export type UnsplashContentFilter = 'low' | 'high'

export interface UnsplashUser {
    id: string
    username: string
    name: string
}

export interface UnsplashPhoto {
    id: string
    alt_description: string | null
    description: string | null
    urls: {
        raw: string
        full: string
        regular: string
        small: string
        thumb: string
    }
    links: {
        self: string
        html: string
        download: string
        download_location: string
    }
    user: UnsplashUser
    width: number
    height: number
    color: string | null
}

export interface UnsplashSearchResponse {
    total: number
    total_pages: number
    results: UnsplashPhoto[]
}

export interface SearchOptions {
    orientation?: UnsplashOrientation
    color?: string
    contentFilter?: UnsplashContentFilter
    page?: number
}

export interface ImgixParams {
    w?: number
    h?: number
    fit?: 'crop' | 'clip' | 'scale' | 'fill'
    crop?: 'faces' | 'edges' | 'entropy' | 'center'
    quality?: number
    auto?: 'format' | 'compress' | 'enhance'
}

export interface DownloadResult {
    buffer: Buffer
    mimetype: string
    size: number
}

/** Discriminated error class for pipeline decision-making. */
export class UnsplashError extends Error {
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
        super(message ?? `[Unsplash] ${code} (status=${status})`)
        this.name = 'UnsplashError'
    }
}

const BASE = 'https://api.unsplash.com'
const DOWNLOAD_HOST_ALLOWLIST = ['images.unsplash.com', 'plus.unsplash.com']
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 10_000_000 // 10 MB
const RATE_LIMIT_WARN_THRESHOLD = 100

/** Recommended orientation per block type — used by media-pipeline callers. */
export const UNSPLASH_ORIENTATION_BY_BLOCK: Record<string, UnsplashOrientation> = {
    hero: 'landscape',
    gallery: 'landscape',
    about: 'landscape',
    'portfolio-grid': 'portrait',
    team: 'squarish',
    testimonials: 'squarish',
    'logo-cloud': 'squarish',
}

function getClientIdHeader(): Record<string, string> {
    const key = process.env.UNSPLASH_ACCESS_KEY
    if (!key || key.length < 10) {
        throw new UnsplashError('NO_KEY', 0, false, 'UNSPLASH_ACCESS_KEY not set or invalid')
    }
    return { Authorization: `Client-ID ${key}` }
}

function logRateLimit(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining')
    if (remaining != null) {
        const n = Number(remaining)
        if (Number.isFinite(n) && n < RATE_LIMIT_WARN_THRESHOLD) {
            console.warn(`[Unsplash] rate limit low: ${n} requests remaining`)
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
                throw new UnsplashError('UNAUTHORIZED', res.status, false)
            }
            if (res.status === 429 || res.status >= 500) {
                if (attempt === 0) {
                    attempt++
                    const jitter = 2000 + Math.floor(Math.random() * 500)
                    await new Promise((r) => setTimeout(r, jitter))
                    continue
                }
                throw new UnsplashError(
                    res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
                    res.status,
                    true,
                )
            }
            throw new UnsplashError('SERVER_ERROR', res.status, false)
        } catch (err) {
            if (err instanceof UnsplashError) throw err
            if (err instanceof Error && err.name === 'AbortError') {
                throw new UnsplashError('TIMEOUT', 0, true, err.message)
            }
            if (attempt === 0) {
                attempt++
                await new Promise((r) => setTimeout(r, 1500))
                continue
            }
            throw new UnsplashError('SERVER_ERROR', 0, false, (err as Error).message)
        }
    }
    throw new UnsplashError('SERVER_ERROR', 0, false, 'retry exhausted')
}

/**
 * Search Unsplash photos. Returns first page (max 30 per request).
 * Empty array if no results — not thrown.
 */
export async function searchPhotos(
    query: string,
    count: number,
    opts: SearchOptions = {},
): Promise<UnsplashPhoto[]> {
    if (!query.trim()) return []
    const perPage = Math.min(Math.max(count, 1), 30)
    const params = new URLSearchParams({
        query: query.trim(),
        per_page: String(perPage),
        orientation: opts.orientation ?? 'landscape',
        content_filter: opts.contentFilter ?? 'high',
        page: String(opts.page ?? 1),
    })
    if (opts.color) params.set('color', opts.color)

    const url = `${BASE}/search/photos?${params.toString()}`
    const res = await fetchWithRetry(url, {
        headers: getClientIdHeader(),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
    logRateLimit(res.headers)
    const json = (await res.json()) as UnsplashSearchResponse
    return Array.isArray(json.results) ? json.results : []
}

/**
 * Fire-and-forget download tracking. MANDATORY by Unsplash API ToS — every used
 * photo must trigger this endpoint, or risk key revocation. Do NOT await.
 */
export function trackDownload(downloadLocation: string): void {
    if (!downloadLocation) return
    try {
        const headers = getClientIdHeader()
        fetch(downloadLocation, { headers }).catch((err) => {
            console.warn('[Unsplash] trackDownload failed (non-blocking)', (err as Error).message)
        })
    } catch {
        // swallow key errors — don't break caller
    }
}

/** SSRF guard: URL must be an Unsplash CDN host. */
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
 * SSRF-guarded: URL must be an Unsplash CDN host.
 */
export async function downloadPhotoBuffer(
    url: string,
    maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<DownloadResult> {
    if (!isAllowedDownloadUrl(url)) {
        throw new UnsplashError('SSRF_BLOCKED', 0, false, `URL host not in allowlist: ${url}`)
    }
    let res: Response
    try {
        res = await fetch(url, {
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
            headers: { 'User-Agent': 'ech-prime-web-v2/1.0' },
        })
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new UnsplashError('TIMEOUT', 0, true, err.message)
        }
        throw new UnsplashError('DOWNLOAD_FAIL', 0, true, (err as Error).message)
    }
    if (!res.ok) {
        throw new UnsplashError('DOWNLOAD_FAIL', res.status, res.status >= 500)
    }
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > maxBytes) {
        throw new UnsplashError('TOO_LARGE', 413, false, `${buffer.length} > ${maxBytes}`)
    }
    return {
        buffer,
        mimetype: res.headers.get('content-type') ?? 'image/jpeg',
        size: buffer.length,
    }
}

/**
 * Build an Imgix URL from `urls.raw` with sizing + quality params.
 * Unsplash CDN is Imgix under the hood — query params crop/resize on the fly.
 */
export function buildImgixUrl(rawUrl: string, params: ImgixParams): string {
    const qs = new URLSearchParams()
    if (params.w) qs.set('w', String(params.w))
    if (params.h) qs.set('h', String(params.h))
    if (params.fit) qs.set('fit', params.fit)
    if (params.crop) qs.set('crop', params.crop)
    if (params.quality != null) qs.set('q', String(params.quality))
    if (params.auto) qs.set('auto', params.auto)
    // Default: q=80 + auto=format if not specified
    if (!qs.has('q')) qs.set('q', '80')
    if (!qs.has('auto')) qs.set('auto', 'format')
    const separator = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${separator}${qs.toString()}`
}
