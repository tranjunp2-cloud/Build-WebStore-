/**
 * Shared key utilities for IMAGE_LIBRARY seeder and resolver.
 * Both sides must produce identical keys for the S3 lookup to work.
 *
 * GH-727 Phase 03: extracted from image-library-seeder.ts to avoid duplication.
 * GH-727 Phase 04: per-site keys (imglib:s{siteId}:{slot}) replace shared
 *   category+photoId keys so each generated site gets unique photos.
 */

/** Extract photo ID from an Unsplash URL — e.g. photo-1234-abcd → 1234-abcd */
export function extractPhotoId(url: string): string {
    const match = /photo-([a-zA-Z0-9-]+)/.exec(url)
    return match ? match[1]! : url
}

/** Build idempotency alt key for a given slot (legacy — shared across sites). */
export function buildAltKey(category: string, slot: string, photoId: string): string {
    return `imglib:${category}:${slot}:${photoId}`
}

/** Build per-site alt key: imglib:s{siteId}:{slot} */
export function buildSiteAltKey(siteId: number | string, slot: string): string {
    return `imglib:s${siteId}:${slot}`
}

/** Query prefix for all image-library media belonging to a site */
export function siteAltKeyPrefix(siteId: number | string): string {
    return `imglib:s${siteId}:`
}
