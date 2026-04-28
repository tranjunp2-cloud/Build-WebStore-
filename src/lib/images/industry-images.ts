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
    getIndustryImages,
    IMAGE_LIBRARY,
} from '@/app/api/preview/renderers/images'
import { extractPhotoId, buildAltKey } from './image-library-keys'

export { getIndustryImages, IMAGE_LIBRARY }

type S3Map = Readonly<Record<string, string>> | undefined

/** If a seeded S3 copy exists, return it; otherwise return the original CDN URL. */
function preferS3(category: string, slot: string, cdnUrl: string, s3Map: S3Map): string {
    if (!s3Map) return cdnUrl
    const key = buildAltKey(category, slot, extractPhotoId(cdnUrl))
    return s3Map[key] ?? cdnUrl
}

export function getHeroImage(category: string, index = 0, s3Map?: S3Map): string {
    const cdnUrl = _getHeroImage(category, index)
    const heroLen = (IMAGE_LIBRARY[category] ?? IMAGE_LIBRARY['business']!).hero.length
    return preferS3(category, `hero[${index % heroLen}]`, cdnUrl, s3Map)
}

export function getGalleryImages(category: string, count = 6, s3Map?: S3Map): string[] {
    const cdnUrls = _getGalleryImages(category, count)
    return cdnUrls.map((cdnUrl, i) => preferS3(category, `gallery[${i}]`, cdnUrl, s3Map))
}

export function getAboutImage(category: string, s3Map?: S3Map): string {
    const cdnUrl = _getAboutImage(category)
    return preferS3(category, 'about', cdnUrl, s3Map)
}

export function getTeamAvatar(category: string, index = 0, s3Map?: S3Map): string {
    const cdnUrl = _getTeamAvatar(category, index)
    const teamLen = (IMAGE_LIBRARY[category] ?? IMAGE_LIBRARY['business']!).team.length
    return preferS3(category, `team[${index % teamLen}]`, cdnUrl, s3Map)
}
