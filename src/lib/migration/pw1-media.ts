import sharp from 'sharp'
import { load } from 'cheerio'
import { PW1_PLACEHOLDER_URL } from './pw1-placeholder'
import { hasValidImageSignature } from '@/lib/media/image-signature'
import { recordCreatedPw1Media } from './pw1-media-tracking'
import { sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { uploadImageBuffer } from '@/lib/ai/upload-media'

export const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

type BrowserImageFetcher = (url: URL) => Promise<{ buffer: Buffer; mimetype: string } | null>
let browserImageFetcher: BrowserImageFetcher | undefined
/** CLI-only hook: this module is reachable from web routes, which must not bundle a browser, so the CLI registers one. */
export function registerBrowserImageFetcher(fetcher: BrowserImageFetcher | undefined) { browserImageFetcher = fetcher }

export function validatePw1MediaUrl(value: string): URL {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new Error('Source media URL must use HTTPS without credentials or a custom port')
    return url
}

async function placeholderImage() {
    const svg = '<svg width="960" height="640" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="640" fill="#f1f5f9"/><rect x="360" y="220" width="240" height="180" rx="16" fill="none" stroke="#94a3b8" stroke-width="8"/><circle cx="425" cy="270" r="20" fill="#94a3b8"/><path d="M375 380l70-70 50 45 40-40 50 65" fill="none" stroke="#94a3b8" stroke-width="8"/></svg>'
    return { buffer: await sharp(Buffer.from(svg)).png().toBuffer(), mimetype: 'image/png', placeholder: true as const }
}

const MAX_REDIRECTS = 5

/** Fetch with manual redirects so every hop passes the same HTTPS/no-credentials/no-port check as the source URL. */
async function fetchSourceImage(initial: URL): Promise<Response> {
    let url = initial
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        // Some CDNs (e.g. oecd.org) answer 403 to the default fetch User-Agent but serve browsers
        const request = () => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: 'image/*,*/*;q=0.8' } })
        // One retry absorbs transient CDN timeouts/resets
        const response = await request().catch(() => request())
        const location = response.headers.get('location')
        if (response.status < 300 || response.status >= 400 || !location) return response
        await response.body?.cancel()
        url = validatePw1MediaUrl(new URL(location, url).href)
    }
    throw new Error('Source media redirected too many times')
}

export async function downloadSourceImage(value: string) {
    if (value === PW1_PLACEHOLDER_URL) return placeholderImage()
    const url = validatePw1MediaUrl(value)
    const response = await fetchSourceImage(url)
    if (response.status === 403) {
        await response.body?.cancel()
        // Bot-protected CDNs (Cloudflare challenge) reject fetch but serve a real browser
        const viaBrowser = await browserImageFetcher?.(url).catch(() => null)
        if (viaBrowser) return normalizeImageBytes(viaBrowser.buffer, viaBrowser.mimetype, true)
        console.warn('[PW1 media] Source returned HTTP 403; using placeholder')
        return placeholderImage()
    }
    if (!response.ok || !response.body) throw new Error(`Source media download failed (HTTP ${response.status})`)
    const mimetype = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    // PW1 banners may hold a video; image-only blocks cannot use it, so keep the store on a neutral placeholder.
    if (mimetype.startsWith('video/')) {
        await response.body.cancel()
        console.warn(`[PW1 media] Source is a video (${mimetype}); using placeholder`)
        return placeholderImage()
    }
    // Some storage hosts label images "image" or octet-stream; the bytes are validated below
    const typedAsImage = mimetype.startsWith('image/')
    if (!typedAsImage && !['image', 'application/octet-stream', 'binary/octet-stream'].includes(mimetype)) throw new Error('Source media is not a supported raster image')
    const limit = 30 * 1024 * 1024
    if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new Error('Source image exceeds 30 MiB') }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
    try {
        while (true) {
            const { done, value: chunk } = await reader.read()
            if (done) break
            size += chunk.length
            if (size > limit) { await reader.cancel(); throw new Error('Source image exceeds 30 MiB') }
            chunks.push(chunk)
        }
    } finally { reader.releaseLock() }
    return normalizeImageBytes(Buffer.concat(chunks), mimetype, typedAsImage)
}

/** Media accepts only JPEG/PNG/WebP/ICO bytes and PW1 content-types are unreliable (image/jpg,
 * AVIF labelled image/png): trust the bytes, re-encode other formats to PNG (first frame for
 * animations), and fall back to the neutral placeholder when bytes of an image-typed response
 * cannot be decoded. Bytes of an untyped response that are not an image are an error. */
async function normalizeImageBytes(buffer: Buffer, mimetype: string, typedAsImage: boolean) {
    const signatureMimetype = detectSupportedImageMimetype(new Uint8Array(buffer.subarray(0, 12)))
    if (signatureMimetype) return { buffer, mimetype: signatureMimetype }
    try {
        return { buffer: await sharp(buffer, { animated: false }).png().toBuffer(), mimetype: 'image/png' }
    } catch (error) {
        if (!typedAsImage) throw new Error('Source media is not a supported raster image')
        console.warn(`[PW1 media] Source image (${mimetype}) could not be decoded; using placeholder: ${error instanceof Error ? error.message : error}`)
        return placeholderImage()
    }
}

function detectSupportedImageMimetype(head: Uint8Array): string | undefined {
    if (!hasValidImageSignature(head)) return undefined
    if (head[0] === 0xFF) return 'image/jpeg'
    if (head[0] === 0x89) return 'image/png'
    if (head[0] === 0x00) return 'image/x-icon'
    return 'image/webp'
}

/** Upload actual source assets through the existing shared uploader. Never replace
 * missing category images or HTTP 403 responses with stock photos: use a neutral
 * local placeholder instead. Other download failures still fail the store. */
type MigrationDb = { drizzle: { execute(query: unknown): Promise<{ rows: Array<{ media_id: number; mime_type?: string | null; width?: number | string | null; height?: number | string | null }> }> } }
const MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']

/** The neutral placeholder is a 960x640 PNG; a cached copy must not stop a later run from retrying the real download. */
const isPlaceholderMedia = (media: { mime_type?: string | null; mimeType?: string | null; width?: number | string | null; height?: number | string | null }) =>
    (media.mime_type ?? media.mimeType) === 'image/png' && Number(media.width) === 960 && Number(media.height) === 640

/** Cached (or crash-recovered) media for a source URL; a stale placeholder is reported so the caller retries the download. */
async function findReusablePw1Media(payload: Payload, tenantId: number | string, sourceHash: string, filename: string): Promise<{ id?: number; stale: boolean }> {
    const db = payload.db as unknown as MigrationDb
    const cached = await db.drizzle.execute(sql`SELECT c.media_id, m.mime_type, m.width, m.height FROM pw1_migration_media c JOIN media m ON m.id=c.media_id WHERE c.tenant_id=${tenantId} AND c.source_hash=${sourceHash} AND m.filename LIKE ${`pw1-${tenantId}-${sourceHash.slice(0, 20)}%`}`)
    const row = cached.rows[0]
    if (row) return isPlaceholderMedia(row) ? { stale: true } : { id: row.media_id, stale: false }
    // Recover an upload whose process died between media creation and cache registration.
    const existing = await payload.find({ collection: 'media', where: { filename: { in: MEDIA_EXTENSIONS.map(ext => filename.replace(/\.jpg$/, `.${ext}`)) } }, limit: 1, depth: 0 })
    const doc = existing.docs[0] as { id: number | string; mimeType?: string | null; width?: number | null; height?: number | null } | undefined
    return doc && !isPlaceholderMedia(doc) ? { id: Number(doc.id), stale: false } : { stale: Boolean(doc) }
}

/** Download a source image and store it. Real images are cached by URL; placeholders are not, so a rerun retries them. */
async function downloadAndStorePw1Media(payload: Payload, tenantId: number | string, url: string, sourceHash: string, filename: string, alt: string, stale: boolean): Promise<number | undefined> {
    const asset = await downloadSourceImage(url)
    const isIcon = ['image/x-icon', 'image/vnd.microsoft.icon'].includes(asset.mimetype)
    // Distinct names keep a retry from colliding with the stale placeholder file or an earlier placeholder.
    const uploadFilename = ('placeholder' in asset ? filename.replace(/\.jpg$/, '-placeholder.jpg') : stale ? filename.replace(/\.jpg$/, 'r.jpg') : filename).replace(/\.jpg$/, isIcon ? '.ico' : '.jpg')
    if ('placeholder' in asset) {
        const prior = await payload.find({ collection: 'media', where: { filename: { equals: uploadFilename } }, limit: 1, depth: 0 })
        if (prior.docs[0]) return Number(prior.docs[0].id)
    }
    const mediaId = await uploadImageBuffer(asset.buffer, asset.mimetype, uploadFilename, alt, tenantId, payload, false)
    if (!mediaId) return undefined
    recordCreatedPw1Media(mediaId)
    if (!('placeholder' in asset)) {
        const db = payload.db as unknown as MigrationDb
        await db.drizzle.execute(sql`INSERT INTO pw1_migration_media(tenant_id,source_hash,media_id) VALUES(${tenantId},${sourceHash},${mediaId}) ON CONFLICT(tenant_id,source_hash) DO UPDATE SET media_id=EXCLUDED.media_id,last_used_at=now()`)
    }
    return mediaId
}

export async function importPw1BlockMedia(buckets: Record<string, unknown>[][], tenantId: number | string, payload: Payload) {
    const cache = new Map<string, number>()
    const visited = new Set<object>()
    let succeeded = 0
    async function visit(value: unknown, jsonField = false): Promise<void> {
        if (!value || typeof value !== 'object' || visited.has(value)) return
        visited.add(value)
        if (Array.isArray(value)) { for (const item of value) await visit(item, jsonField); return }
        const record = value as Record<string, unknown>
        for (const [key, child] of Object.entries(record)) {
            if (['image', 'backgroundImage', 'logo', 'avatar'].includes(key) && child != null && typeof child !== 'number') {
                const url = typeof child === 'string' ? child : typeof child === 'object' && 'url' in child ? child.url : undefined
                if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Source upload field has no HTTP(S) asset URL')
                let mediaId = cache.get(url)
                if (!mediaId) {
                    validatePw1MediaUrl(url)
                    const sourceHash = createHash('sha256').update(url).digest('hex')
                    const filename = `pw1-${tenantId}-${sourceHash.slice(0, 20)}.jpg`
                    const reusable = await findReusablePw1Media(payload, tenantId, sourceHash, filename)
                    mediaId = reusable.id
                    const sourceAlt = typeof child === 'object' && 'alt' in child && typeof child.alt === 'string' ? child.alt.trim() : ''
                    const alt = sourceAlt || (typeof record.headline === 'string' && record.headline.trim() ? record.headline : new URL(url).pathname.split('/').pop() || 'PW1 image')
                    if (!mediaId) mediaId = await downloadAndStorePw1Media(payload, tenantId, url, sourceHash, filename, alt, reusable.stale)
                    if (!mediaId) throw new Error('Source media upload returned no media ID')
                    cache.set(url, mediaId)
                    succeeded++
                }
                if (jsonField) {
                    const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })
                    if (!media.url) throw new Error('Imported slide image has no public URL')
                    record[key] = { url: media.url, alt: media.alt || '', ...(media.width && media.height ? { width: media.width, height: media.height } : {}) }
                } else record[key] = mediaId
            } else if (key === 'html' && typeof child === 'string' && child.includes('<img')) {
                record.html = await rehostHtmlImages(child, tenantId, payload, cache)
            } else await visit(child, jsonField || key === 'slides' || key === 'sourceContent')
        }
    }
    for (const bucket of buckets) await visit(bucket)
    return { succeeded, failed: 0 }
}

export async function rehostHtmlImages(html: string, tenantId: number | string, payload: Payload, cache: Map<string, number>, shouldRehost: (url: string) => boolean = () => true): Promise<string> {
    const imgRegex = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi
    const matches = [...html.matchAll(imgRegex)]
    if (!matches.length) return html

    let result = html
    for (const match of matches) {
        // The regex yields raw attribute text; decode entities (&amp; in signed CDN URLs) before fetching
        const originalSrc = (load(match[0], null, false)('img').attr('src') ?? match[2]).trim()
        if (!/^https?:\/\//i.test(originalSrc)) continue
        if (!shouldRehost(originalSrc)) continue

        try {
            const httpsUrl = originalSrc.startsWith('http://') ? originalSrc.replace(/^http:\/\//i, 'https://') : originalSrc
            validatePw1MediaUrl(httpsUrl)
            let mediaId = cache.get(httpsUrl)
            if (!mediaId) {
                const sourceHash = createHash('sha256').update(httpsUrl).digest('hex')
                const filename = `pw1-${tenantId}-${sourceHash.slice(0, 20)}.jpg`
                const reusable = await findReusablePw1Media(payload, tenantId, sourceHash, filename)
                mediaId = reusable.id
                if (!mediaId) {
                    const alt = new URL(httpsUrl).pathname.split('/').pop() || 'PW1 document image'
                    mediaId = await downloadAndStorePw1Media(payload, tenantId, httpsUrl, sourceHash, filename, alt, reusable.stale)
                }
                if (mediaId) cache.set(httpsUrl, mediaId)
            }
            if (mediaId) {
                const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })
                if (media?.url) {
                    result = result.replaceAll(match[0], `<img${match[1]}src="${media.url}"${match[3]}>`)
                }
            }
        } catch (error) {
            console.warn(`[rehostHtmlImages] Non-fatal rich-text image rehost error for ${originalSrc}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
    return result
}

/** Media for a source image: the stored copy when there is a real one, else a fresh download (a still-broken source yields the existing placeholder, nothing new is uploaded). */
export async function restorePw1Media(payload: Payload, tenantId: number | string, url: string, alt: string): Promise<number | undefined> {
    const sourceHash = createHash('sha256').update(url).digest('hex')
    const filename = `pw1-${tenantId}-${sourceHash.slice(0, 20)}.jpg`
    const reusable = await findReusablePw1Media(payload, tenantId, sourceHash, filename)
    return reusable.id ?? downloadAndStorePw1Media(payload, tenantId, url, sourceHash, filename, alt, reusable.stale)
}
