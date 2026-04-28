/**
 * Shared key utilities for IMAGE_LIBRARY seeder and resolver.
 * Both sides must produce identical keys for the S3 lookup to work.
 *
 * GH-727 Phase 03: extracted from image-library-seeder.ts to avoid duplication.
 * Server and client safe — pure functions, no side effects.
 */

/** Extract photo ID from an Unsplash URL — e.g. photo-1234-abcd → 1234-abcd */
export function extractPhotoId(url: string): string {
    const match = /photo-([a-zA-Z0-9-]+)/.exec(url)
    return match ? match[1]! : url
}

/** Build idempotency alt key for a given slot. */
export function buildAltKey(category: string, slot: string, photoId: string): string {
    return `imglib:${category}:${slot}:${photoId}`
}
