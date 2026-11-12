import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroBlock } from '@/blocks/hero'
import { HeroConfigSchema } from '@/blocks/hero/config'
import { bannerContentLosses, HERO_VARIANT_RENDERS_IMAGE } from '@/lib/migration/pw1-variant-fidelity'
import { nativeBannerChoices } from '@/lib/migration/pw1-native-ai'

const IMAGE = 'https://img.test/a.jpg'

describe('[TC-F35.M62] migration only offers variants that render the source content', () => {
  it.each(HeroConfigSchema.shape.variant.removeDefault().options)('hero variant %s image support matches the real component', variant => {
    const html = renderToStaticMarkup(<HeroBlock block={{ blockType: 'hero', variant, headline: 'H', ctaButtons: [], image: { url: IMAGE } } as never} /> as never)
    expect(html.includes('img.test'), `${variant} renders image`).toBe(HERO_VARIANT_RENDERS_IMAGE[variant])
  })
  it('reports an image loss only for variants that drop them', () => {
    expect(bannerContentLosses([{ image: { url: IMAGE } }], 'hero', 'fullscreen')).toEqual(['image'])
    expect(bannerContentLosses([{ image: { url: IMAGE } }], 'hero', 'centered')).toEqual([])
    expect(bannerContentLosses([{ image: { url: IMAGE } }], 'carousel', 'images')).toEqual([])
  })
  it('never offers a lossy variant for banners with an image', () => {
    const hero = { blockType: 'hero', headline: 'H', image: { url: IMAGE } }
    expect(nativeBannerChoices(hero)).not.toContain('hero:fullscreen')
    expect(nativeBannerChoices({ ...hero, image: undefined })).toContain('hero:fullscreen')
  })
})
