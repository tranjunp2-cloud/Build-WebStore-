import type { HeroConfig } from '@/blocks/hero/config'

/**
 * Which hero variants render the source image. Migration may only choose a variant that shows
 * it; `pw1-variant-fidelity.test.tsx` renders every variant to keep this table in sync.
 */
export const HERO_VARIANT_RENDERS_IMAGE: Record<NonNullable<HeroConfig['variant']>, boolean> = {
  centered: true, 'split-left': true, 'split-right': true, magazine: true, 'cards-overlay': true,
  parallax: true, slideshow: true, 'split-video': true, video: true,
  fullscreen: false, gradient: false, minimal: false,
}

type SourceSlide = { image?: { url?: string } }

/** Source content that `blockType:variant` would silently drop; empty means nothing is lost. */
export function bannerContentLosses(slides: SourceSlide[], blockType: string, variant: string): string[] {
  const hidesImage = blockType === 'hero' && !HERO_VARIANT_RENDERS_IMAGE[variant as keyof typeof HERO_VARIANT_RENDERS_IMAGE]
  return hidesImage && slides.some(slide => slide.image?.url) ? ['image'] : []
}
