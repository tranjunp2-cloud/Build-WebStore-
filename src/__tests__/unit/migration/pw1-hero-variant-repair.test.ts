import { describe, expect, it } from 'vitest'
import { repairHeroVariant } from '@/lib/migration/pw1-hero-variant-repair'
import { HERO_VARIANT_RENDERS_IMAGE } from '@/lib/migration/pw1-variant-fidelity'

// TC-F35.M70: hero banner repair moves image-hiding variants to ones that render the image
describe('pw1 hero variant repair', () => {
    it('moves fullscreen with an image to parallax', () => {
        expect(repairHeroVariant({ variant: 'fullscreen', imageId: 5 })).toEqual({ changed: true, from: 'fullscreen', to: 'parallax' })
    })
    it.each(['gradient', 'minimal'])('moves %s with an image to centered', variant => {
        expect(repairHeroVariant({ variant, imageId: 5 })).toEqual({ changed: true, from: variant, to: 'centered' })
    })
    it('leaves a hero without an image alone', () => {
        expect(repairHeroVariant({ variant: 'fullscreen', imageId: null })).toEqual({ changed: false })
    })
    it.each(Object.entries(HERO_VARIANT_RENDERS_IMAGE).filter(([, renders]) => renders).map(([v]) => v))('leaves image-rendering %s alone', variant => {
        expect(repairHeroVariant({ variant, imageId: 5 })).toEqual({ changed: false })
    })
    it('every replacement variant renders the image', () => {
        for (const variant of ['fullscreen', 'gradient', 'minimal']) {
            const repair = repairHeroVariant({ variant, imageId: 1 })
            expect(repair.changed && HERO_VARIANT_RENDERS_IMAGE[repair.to as keyof typeof HERO_VARIANT_RENDERS_IMAGE]).toBe(true)
        }
    })
})
