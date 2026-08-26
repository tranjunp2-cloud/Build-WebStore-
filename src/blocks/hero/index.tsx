'use client'

import type { BlockProps } from '../types'
import type { HeroConfig } from './config'
import { CenteredHero } from './variants/centered'
import { SplitHero } from './variants/split'
import { FullscreenHero } from './variants/fullscreen'
import { MagazineHero } from './variants/magazine'
import { MinimalHero } from './variants/minimal'
import { CardsOverlayHero } from './variants/cards-overlay'
import { GradientHero } from './variants/gradient'
import { ParallaxHero } from './variants/parallax'
import { SlideshowHero } from './variants/slideshow'
import { SplitVideoHero } from './variants/split-video'
import { VideoHero } from './variants/video'

const VARIANT_MAP: Record<string, React.ComponentType<BlockProps<HeroConfig>>> = {
    'centered': CenteredHero,
    'split-left': SplitHero,
    'split-right': SplitHero,
    'fullscreen': FullscreenHero,
    'magazine': MagazineHero,
    'minimal': MinimalHero,
    'cards-overlay': CardsOverlayHero,
    'gradient': GradientHero,
    'parallax': ParallaxHero,
    'slideshow': SlideshowHero,
    'split-video': SplitVideoHero,
    'video': VideoHero,
}

export function HeroBlock(props: BlockProps<HeroConfig>) {
    const variant = props.block.variant || 'centered'
    const Component = VARIANT_MAP[variant] || VARIANT_MAP['centered']
    return <Component {...props} />
}
