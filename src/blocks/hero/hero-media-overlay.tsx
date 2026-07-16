import { MediaUploadOverlay, type MediaUploadOverlayProps } from '@/blocks/shared/media-upload-overlay'

// Thin wrapper kept so existing hero-variant imports stay unchanged. The upload overlay logic
// now lives in the shared MediaUploadOverlay (used by every block). Hero pins the top-right
// control position and a hero-specific default alt.
type HeroMediaOverlayProps = Omit<MediaUploadOverlayProps, 'buttonPosition' | 'valueShape'>

export function HeroMediaOverlay({ altText = 'Hero image', ...props }: HeroMediaOverlayProps) {
    return <MediaUploadOverlay altText={altText} buttonPosition="top-right" {...props} />
}
