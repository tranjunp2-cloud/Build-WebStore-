import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { uploadImageBuffer } from '@/lib/ai/upload-media'

const LEGACY_HOSTS = new Set(['tm-prime-web-dev.sgp1.digitaloceanspaces.com', 'tm-prime-web.sgp1.digitaloceanspaces.com'])

export function validatePw1MediaUrl(value: string): URL {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !LEGACY_HOSTS.has(url.hostname) || url.port || url.username || url.password) throw new Error('Source media host is not approved for this PW1 migration')
    return url
}

async function downloadSourceImage(value: string) {
    const url = validatePw1MediaUrl(value)
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })
    if (!response.ok || !response.body) throw new Error(`Source media download failed (HTTP ${response.status})`)
    const mimetype = (response.headers.get('content-type') || '').split(';')[0]
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mimetype)) throw new Error('Source media is not a supported raster image')
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
                    const filename = `pw1-${tenantId}-${createHash('sha256').update(url).digest('hex').slice(0, 20)}.jpg`
                    const sourceAlt = typeof child === 'object' && 'alt' in child && typeof child.alt === 'string' ? child.alt.trim() : ''
                    const alt = sourceAlt || (typeof record.headline === 'string' && record.headline.trim() ? record.headline : new URL(url).pathname.split('/').pop() || 'PW1 image')
                    const { buffer, mimetype } = await downloadSourceImage(url)
                    mediaId = await uploadImageBuffer(buffer, mimetype, filename, alt, tenantId, payload, false)
                    if (!mediaId) throw new Error('Source media upload returned no media ID')
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
