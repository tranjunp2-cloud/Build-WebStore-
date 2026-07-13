import Image from 'next/image'
import type { ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { LogoCloudConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Caption } from '../shared/Typography'
import { SectionWrapper } from '../shared/SectionWrapper'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

void _CSS_VARS

function LogoHeadline({ text }: { text?: string }) {
    if (!text) return null
    return (
        <Caption className="block font-semibold uppercase tracking-widest text-center mb-8 opacity-50">
            <RichText text={text} as="span" />
        </Caption>
    )
}

/** Uniform square frame so every logo renders at the same size regardless of the
 *  source aspect ratio. `grid` uses a larger box than `row`. The inner content
 *  (real <Image> or placeholder) carries data-image-index for editor replace. */
function LogoFrame({ size, children }: { size: 'grid' | 'row'; children: ReactNode }) {
    const box = size === 'grid' ? 'w-24 h-24 md:w-28 md:h-28' : 'w-20 h-20 md:w-24 md:h-24'
    return (
        <div
            className={`${box} rounded-xl p-3 transition-all duration-200 hover:shadow-md`}
            style={{
                border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                background: `rgba(var(--brand-primary-rgb), 0.04)`,
            }}
        >
            {/* Relative inner box gives the fixed-size area that a `fill` <Image> needs.
             *  Fill reserves the full padded box up-front → no layout shift on image load,
             *  and makes the whole padded area the click target for editor image-replace. */}
            <div className="relative flex h-full w-full items-center justify-center">
                {children}
            </div>
        </div>
    )
}

/** Text placeholder for logos without valid image URL — shows initials centered in the frame.
 *  data-image-index enables editor image-replace on placeholder click (no real <img> present). */
function LogoPlaceholder({ name, imageIndex }: { name?: string; imageIndex?: number }) {
    const initials = (name ?? '')
        .split(/\s+/)
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?'
    return (
        <span
            className="flex h-full w-full items-center justify-center text-base font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: 'var(--brand-primary)' }}
            data-image-index={imageIndex}
        >
            {initials}
        </span>
    )
}

/** Real logo fitted into the square frame via fill + object-contain — keeps aspect
 *  ratio, no crop, letterboxed within the box so wide and tall logos stay uniform. */
function LogoImage({ item, index }: { item: LogoCloudConfig['logos'][number]; index: number }) {
    return (
        <Image
            src={item.logo!.url}
            alt={item.logo?.alt || item.name}
            fill
            sizes="128px"
            className="object-contain opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
            data-image-index={index}
        />
    )
}

export function LogoCloudBlock({ block, theme: _theme }: BlockProps<LogoCloudConfig>) {
    void _theme
    const { headline, logos = [], variant = 'row' } = block
    const size = variant === 'grid' ? 'grid' : 'row'
    const gap = variant === 'grid' ? 'gap-6 md:gap-8' : 'gap-5 md:gap-6'

    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="compact" container="default" background="alternate">
                <LogoHeadline text={headline} />
                <div className={`flex flex-wrap items-center justify-center ${gap} max-w-5xl mx-auto`}>
                    {logos.map((item, i) => (
                        // MediaUploadOverlay tracks hover on its parentElement — each tile needs
                        // its own wrapper, or hovering one logo shows the overlay on all of them.
                        <div key={i}>
                            <MediaUploadOverlay field={`logos.${i}.logo`} altText={item.logo?.alt || item.name} valueShape="media" buttonPosition="top-center">
                                <LogoFrame size={size}>
                                    {item.logo?.url ? (
                                        <LogoImage item={item} index={i} />
                                    ) : (
                                        <LogoPlaceholder name={item.name} imageIndex={i} />
                                    )}
                                </LogoFrame>
                            </MediaUploadOverlay>
                        </div>
                    ))}
                </div>
            </SectionWrapper>
        </AnimatedSection>
    )
}
