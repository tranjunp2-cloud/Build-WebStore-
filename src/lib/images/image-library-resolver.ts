/**
 * Resolve seeded IMAGE_LIBRARY mappings (Phase 2 output) for a tenant.
 * Server-only — uses Payload local API. Do NOT import from client components.
 *
 * Returns a Record<altKey, mediaUrl> for fast O(1) lookup in blocks via the
 * shared getter helpers (industry-images.ts).
 *
 * GH-727 Phase 03
 */

import type { Payload } from 'payload'

export type ImageLibraryS3Map = Record<string, string>

/**
 * Fetch all seeded IMAGE_LIBRARY media for a tenant.
 *
 * Returns {} on any error or empty result — blocks fall back to CDN.
 * Never throws.
 */
export async function resolveImageLibraryS3Map(
    payload: Payload,
    tenantId: number | string,
): Promise<ImageLibraryS3Map> {
    try {
        // media has no tenant field — alt key is globally unique per (category,slot,photoId)
        const res = await payload.find({
            collection: 'media',
            where: { alt: { like: 'imglib:' } },
            limit: 200,
            depth: 0,
        })

        const map: ImageLibraryS3Map = {}
        for (const doc of res.docs) {
            const alt = (doc as { alt?: string }).alt
            // `url` is a virtual field injected by the S3 plugin via generateFileURL.
            // It is undefined in dev environments without S3_BUCKET configured — empty map is correct fallback.
            const url = (doc as { url?: string }).url
            if (alt && url && alt.startsWith('imglib:')) {
                map[alt] = url
            }
        }
        return map
    } catch (err) {
        console.warn('[image-library-resolver] failed', err instanceof Error ? err.message : err)
        return {}
    }
}
