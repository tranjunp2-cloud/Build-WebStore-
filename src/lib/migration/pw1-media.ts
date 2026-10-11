import sharp from 'sharp'
import { PW1_PLACEHOLDER_URL } from './pw1-placeholder'
import { hasValidImageSignature } from '@/lib/media/image-signature'
import { recordCreatedPw1Media } from './pw1-media-tracking'
import { sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { uploadImageBuffer } from '@/lib/ai/upload-media'

export function validatePw1MediaUrl(value: string): URL {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new Error('Source media URL must use HTTPS without credentials or a custom port')
    return url
}

async function placeholderImage() {
    const svg = '<svg width="960" height="640" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="640" fill="#f1f5f9"/><rect x="360" y="220" width="240" height="180" rx="16" fill="none" stroke="#94a3b8" stroke-width="8"/><circle cx="425" cy="270" r="20" fill="#94a3b8"/><path d="M375 380l70-70 50 45 40-40 50 65" fill="none" stroke="#94a3b8" stroke-width="8"/></svg>'
    return { buffer: await sharp(Buffer.from(svg)).png().toBuffer(), mimetype: 'image/png' }
}

export async function downloadSourceImage(value: string) {
    if (value === PW1_PLACEHOLDER_URL) return placeholderImage()
    const url = validatePw1MediaUrl(value)
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })
    if (response.status === 403) {
        await response.body?.cancel()
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
    if (!mimetype.startsWith('image/')) throw new Error('Source media is not a supported raster image')
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
    const buffer = Buffer.concat(chunks)
    // Media accepts only JPEG/PNG/WebP/ICO bytes and PW1 content-types are unreliable (image/jpg,
    // AVIF labelled image/png): trust the bytes, re-encode other formats to PNG (first frame for
    // animations), and fall back to the neutral placeholder when the bytes cannot be decoded.
    const signatureMimetype = detectSupportedImageMimetype(new Uint8Array(buffer.subarray(0, 12)))
    if (signatureMimetype) return { buffer, mimetype: signatureMimetype }
    try {
        return { buffer: await sharp(buffer, { animated: false }).png().toBuffer(), mimetype: 'image/png' }
    } catch (error) {
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
                    const db = payload.db as unknown as { drizzle: { execute(query: unknown): Promise<{ rows: Array<{ media_id: number }> }> } }
                    const cached = await db.drizzle.execute(sql`SELECT c.media_id FROM pw1_migration_media c JOIN media m ON m.id=c.media_id WHERE c.tenant_id=${tenantId} AND c.source_hash=${sourceHash} AND m.filename LIKE ${`pw1-${tenantId}-${sourceHash.slice(0, 20)}%`}`)
                    mediaId = cached.rows[0]?.media_id
                    if (!mediaId) {
                        // Recover an upload whose process died between media creation and cache registration.
                        const existing = await payload.find({ collection: 'media', where: { filename: { in: ['jpg','jpeg','png','webp','gif','avif'].map(ext => filename.replace(/\.jpg$/, `.${ext}`)) } }, limit: 1, depth: 0 })
                        mediaId = existing.docs[0] ? Number(existing.docs[0].id) : undefined
                    }
                    const sourceAlt = typeof child === 'object' && 'alt' in child && typeof child.alt === 'string' ? child.alt.trim() : ''
                    const alt = sourceAlt || (typeof record.headline === 'string' && record.headline.trim() ? record.headline : new URL(url).pathname.split('/').pop() || 'PW1 image')
                    if (!mediaId) {
                        const { buffer, mimetype } = await downloadSourceImage(url)
                        const uploadFilename = ['image/x-icon', 'image/vnd.microsoft.icon'].includes(mimetype) ? filename.replace(/\.jpg$/, '.ico') : filename
                        mediaId = await uploadImageBuffer(buffer, mimetype, uploadFilename, alt, tenantId, payload, false)
                        if (mediaId) recordCreatedPw1Media(mediaId)
                    }
                    if (!mediaId) throw new Error('Source media upload returned no media ID')
                    await db.drizzle.execute(sql`INSERT INTO pw1_migration_media(tenant_id,source_hash,media_id) VALUES(${tenantId},${sourceHash},${mediaId}) ON CONFLICT(tenant_id,source_hash) DO UPDATE SET media_id=EXCLUDED.media_id,last_used_at=now()`)
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

async function rehostHtmlImages(html: string, tenantId: number | string, payload: Payload, cache: Map<string, number>): Promise<string> {
    const imgRegex = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi
    const matches = [...html.matchAll(imgRegex)]
    if (!matches.length) return html

    let result = html
    for (const match of matches) {
        const originalSrc = match[2].trim()
        if (!/^https?:\/\//i.test(originalSrc)) continue

        try {
            const httpsUrl = originalSrc.startsWith('http://') ? originalSrc.replace(/^http:\/\//i, 'https://') : originalSrc
            validatePw1MediaUrl(httpsUrl)
            let mediaId = cache.get(httpsUrl)
            if (!mediaId) {
                const sourceHash = createHash('sha256').update(httpsUrl).digest('hex')
                const filename = `pw1-${tenantId}-${sourceHash.slice(0, 20)}.jpg`
                const db = payload.db as unknown as { drizzle: { execute(query: unknown): Promise<{ rows: Array<{ media_id: number }> }> } }
                const cached = await db.drizzle.execute(sql`SELECT c.media_id FROM pw1_migration_media c JOIN media m ON m.id=c.media_id WHERE c.tenant_id=${tenantId} AND c.source_hash=${sourceHash} AND m.filename LIKE ${`pw1-${tenantId}-${sourceHash.slice(0, 20)}%`}`)
                mediaId = cached.rows[0]?.media_id
                if (!mediaId) {
                    const existing = await payload.find({ collection: 'media', where: { filename: { in: ['jpg','jpeg','png','webp','gif','avif'].map(ext => filename.replace(/\.jpg$/, `.${ext}`)) } }, limit: 1, depth: 0 })
                    mediaId = existing.docs[0] ? Number(existing.docs[0].id) : undefined
                }
                if (!mediaId) {
                    const { buffer, mimetype } = await downloadSourceImage(httpsUrl)
                    const uploadFilename = ['image/x-icon', 'image/vnd.microsoft.icon'].includes(mimetype) ? filename.replace(/\.jpg$/, '.ico') : filename
                    const alt = new URL(httpsUrl).pathname.split('/').pop() || 'PW1 document image'
                    mediaId = await uploadImageBuffer(buffer, mimetype, uploadFilename, alt, tenantId, payload, false)
                    if (mediaId) recordCreatedPw1Media(mediaId)
                }
                if (mediaId) {
                    await db.drizzle.execute(sql`INSERT INTO pw1_migration_media(tenant_id,source_hash,media_id) VALUES(${tenantId},${sourceHash},${mediaId}) ON CONFLICT(tenant_id,source_hash) DO UPDATE SET media_id=EXCLUDED.media_id,last_used_at=now()`)
                    cache.set(httpsUrl, mediaId)
                }
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
