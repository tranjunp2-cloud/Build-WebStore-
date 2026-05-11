/**
 * Shared industry image utilities.
 * Re-exports curated Unsplash images for use in both:
 * - Preview HTML renderers (server-side)
 * - React block components (client-side published site)
 *
 * GH-727 Phase 03: optional `s3Map` parameter prefers seeded S3 URL when present.
 * Zero-arg callers (preview renderers, add-section.ts) continue to receive CDN URLs.
 */
import {
    getHeroImage as _getHeroImage,
    getAboutImage as _getAboutImage,
    getTeamAvatar as _getTeamAvatar,
    getGalleryImages as _getGalleryImages,
    getProductImages as _getProductImages,
    getIndustryImages,
    IMAGE_LIBRARY,
} from '@/app/api/preview/renderers/images'

export { getIndustryImages, IMAGE_LIBRARY }

type S3Map = Readonly<Record<string, string>> | undefined

// GH-727 Phase 04: s3Map is now keyed by slot ('gallery[0]', 'hero[0]', etc.)
// — no category or photoId needed since keys are per-site.
function preferS3(slot: string, cdnUrl: string, s3Map: S3Map): string {
    if (!s3Map) return cdnUrl
    return s3Map[slot] ?? cdnUrl
}

export function getHeroImage(category: string, index = 0, s3Map?: S3Map): string {
    const cdnUrl = _getHeroImage(category, index)
    const heroLen = (IMAGE_LIBRARY[category] ?? IMAGE_LIBRARY['business']!).hero.length
    return preferS3(`hero[${index % heroLen}]`, cdnUrl, s3Map)
}

export function getGalleryImages(category: string, count = 6, s3Map?: S3Map): string[] {
    const cdnUrls = _getGalleryImages(category, count)
    return cdnUrls.map((cdnUrl, i) => preferS3(`gallery[${i}]`, cdnUrl, s3Map))
}

export function getAboutImage(category: string, s3Map?: S3Map): string {
    const cdnUrl = _getAboutImage(category)
    return preferS3('about', cdnUrl, s3Map)
}

export function getTeamAvatar(category: string, index = 0, s3Map?: S3Map): string {
    const cdnUrl = _getTeamAvatar(category, index)
    const teamLen = (IMAGE_LIBRARY[category] ?? IMAGE_LIBRARY['business']!).team.length
    return preferS3(`team[${index % teamLen}]`, cdnUrl, s3Map)
}

export function getProductImages(category: string, count = 6): string[] {
    return _getProductImages(category, count)
}
