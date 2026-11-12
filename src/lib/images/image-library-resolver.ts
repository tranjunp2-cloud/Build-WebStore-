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
import { unstable_cache } from 'next/cache'
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
        // `like` is ILIKE '%…%' over the whole media table; one statement (no COUNT) and only the columns read
        // below + what the storage adapter builds `url` from (TC-PERF-063).
        const res = await payload.find({
            collection: 'media',
            where: { alt: { like: prefix } },
            limit: 200,
            pagination: false,
            depth: 0,
            select: { alt: true, url: true, filename: true, prefix: true },
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

/**
 * Visitor storefront variant: the same map cached for 5 minutes per site and dropped with the site's storefront
 * tag (`site-${siteId}`, fired on publish and site/page writes). It ran uncached on every page view, scanning the
 * media table of every tenant (TC-PERF-063). Owner previews and the seeding route keep the live read above.
 */
export function resolveImageLibraryS3MapCached(payload: Payload, siteId: number | string): Promise<ImageLibraryS3Map> {
    return unstable_cache(
        () => resolveImageLibraryS3Map(payload, siteId),
        ['image-library-s3', String(siteId)],
        { revalidate: 300, tags: [`site-${siteId}`] },
    )()
}
