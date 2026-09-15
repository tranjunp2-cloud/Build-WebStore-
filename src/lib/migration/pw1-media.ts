import { SUPPORTED_IMAGE_MIMES } from '@/lib/media/image-signature'
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

async function downloadSourceImage(value: string) {
    const url = validatePw1MediaUrl(value)
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })
    if (!response.ok || !response.body) throw new Error(`Source media download failed (HTTP ${response.status})`)
    const mimetype = (response.headers.get('content-type') || '').split(';')[0]
    if (!SUPPORTED_IMAGE_MIMES.has(mimetype) && !['image/gif', 'image/avif'].includes(mimetype)) throw new Error('Source media is not a supported raster image')
    const limit = 10 * 1024 * 1024
    if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new Error('Source image exceeds 10 MiB') }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
    try {
        while (true) {
            const { done, value: chunk } = await reader.read()
            if (done) break
            size += chunk.length
            if (size > limit) { await reader.cancel(); throw new Error('Source image exceeds 10 MiB') }
            chunks.push(chunk)
        }
    } finally { reader.releaseLock() }
    return { buffer: Buffer.concat(chunks), mimetype }
}

/** Upload actual source assets through the existing shared uploader. Never replace
 * missing PW1 assets with stock images. Fail before page replacement on error. */
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
                    record[key] = { url: media.url, alt: media.alt || '' }
                } else record[key] = mediaId
            } else await visit(child, jsonField || key === 'slides' || key === 'sourceContent')
        }
    }
    for (const bucket of buckets) await visit(bucket)
    return { succeeded, failed: 0 }
}
