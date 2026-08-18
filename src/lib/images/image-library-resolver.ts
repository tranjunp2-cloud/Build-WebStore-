/**
 * Resolve seeded IMAGE_LIBRARY mappings for a site.
 * Server-only — uses Payload local API. Do NOT import from client components.
 *
 * Returns a Record<slot, mediaUrl> for fast O(1) lookup in blocks via the
 * shared getter helpers (industry-images.ts).
 *
 * GH-727 Phase 04: keys are per-site (imglib:s{siteId}:{slot}) so each
 * generated site has its own unique photo set instead of shared fixed IDs.
 */

import type { Payload } from 'payload'
import { siteAltKeyPrefix } from './image-library-keys'

export type ImageLibraryS3Map = Record<string, string>

/**
 * Fetch all seeded IMAGE_LIBRARY media for a site.
 * Map keys are slot names: 'gallery[0]', 'hero[0]', 'about', 'team[0]', etc.
 *
 * Returns {} on any error or empty result — blocks fall back to CDN.
 * Never throws.
 */
export async function resolveImageLibraryS3Map(
    payload: Payload,
    siteId: number | string,
): Promise<ImageLibraryS3Map> {
    try {
        const prefix = siteAltKeyPrefix(siteId)
        const res = await payload.find({
            collection: 'media',
            where: { alt: { like: prefix } },
            limit: 200,
            depth: 0,
        })

        const map: ImageLibraryS3Map = {}
        for (const doc of res.docs) {
            const alt = (doc as { alt?: string }).alt
            if (!alt || !alt.startsWith(prefix)) continue

            // Strip prefix → slot name, e.g. 'gallery[0]'
            const slot = alt.slice(prefix.length)

            const url = (doc as { url?: string }).url
            if (url) map[slot] = url
        }

        return map
    } catch (err) {
        console.warn('[image-library-resolver] failed', err instanceof Error ? err.message : err)
        return {}
    }
}
