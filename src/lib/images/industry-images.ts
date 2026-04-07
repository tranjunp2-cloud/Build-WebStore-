/**
 * Shared industry image utilities.
 * Re-exports curated Unsplash images for use in both:
 * - Preview HTML renderers (server-side)
 * - React block components (client-side published site)
 */
export {
    getHeroImage,
    getAboutImage,
    getTeamAvatar,
    getGalleryImages,
    getIndustryImages,
} from '@/app/api/preview/renderers/images'
