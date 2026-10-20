import { HERO_VARIANT_RENDERS_IMAGE } from './pw1-variant-fidelity'

type HeroVariant = keyof typeof HERO_VARIANT_RENDERS_IMAGE

/** Image-rendering stand-ins: fullscreen keeps its full-bleed look through parallax (image as background); the text-only variants become centered. */
const IMAGE_SAFE_VARIANT: Partial<Record<HeroVariant, HeroVariant>> = { fullscreen: 'parallax', gradient: 'centered', minimal: 'centered' }

export type HeroRepair = { changed: false } | { changed: true; from: string; to: string }

/**
 * A migrated hero whose variant cannot render its image (older migrations picked fullscreen/gradient/minimal)
 * is moved to a variant that can. Heroes without an image, or already on an image-rendering variant, are left alone.
 */
export function repairHeroVariant(hero: { variant?: string | null; imageId?: number | null; backgroundImageId?: number | null }): HeroRepair {
    const variant = hero.variant as HeroVariant | null | undefined
    if (!variant || HERO_VARIANT_RENDERS_IMAGE[variant] !== false) return { changed: false }
    if (!hero.imageId) return { changed: false }
    const to = IMAGE_SAFE_VARIANT[variant]
    return to ? { changed: true, from: variant, to } : { changed: false }
}
