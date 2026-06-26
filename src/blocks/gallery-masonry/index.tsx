'use client'

import type { BlockProps } from '../types'
import type { GalleryMasonryConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

void _CSS_VARS

export function GalleryMasonryBlock({ block, theme: _theme }: BlockProps<GalleryMasonryConfig>) {
    void _theme
    const { variant = 'masonry', headline, images = [] } = block

    const columnsClass = variant === 'grid-4'
        ? 'columns-2 md:columns-3 lg:columns-4'
        : variant === 'grid-3'
            ? 'columns-2 md:columns-3'
            : 'columns-2 md:columns-3 lg:columns-4'

    const isGrid = variant === 'grid-3' || variant === 'grid-4'
    const gridCols = variant === 'grid-4' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'

    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                {headline && (
                    <div className="text-center mb-14">
                        <Heading level={2}>
                            <RichText text={headline} as="span" />
                        </Heading>
                    </div>
                )}

                {isGrid ? (
                    <div className={`grid ${gridCols} gap-4`}>
                        {images.map((img, i) => (
                            <div key={i} className="relative group overflow-hidden rounded-2xl aspect-square">
                                <MediaUploadOverlay
                                    field={`images.${i}`}
                                    altText={img?.alt || img?.caption || 'gallery image'}
                                    valueShape="url-group"
                                    positionClass="relative"
                                    className="w-full h-full"
                                >
                                    <img
                                        src={img?.url}
                                        alt={img?.alt || ''}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                </MediaUploadOverlay>
                                <div
                                    className="absolute inset-0 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                    style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.800), transparent)` }}
                                >
                                    {img.caption && <Body size="small" className="text-white font-medium">{img.caption}</Body>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`${columnsClass} gap-4 space-y-4`}>
                        {images.map((img, i) => (
                            <div key={i} className="relative group overflow-hidden rounded-2xl break-inside-avoid">
                                <MediaUploadOverlay
                                    field={`images.${i}`}
                                    altText={img?.alt || img?.caption || 'gallery image'}
                                    valueShape="url-group"
                                    positionClass="relative"
                                    className="w-full"
                                >
                                    <img
                                        src={img?.url}
                                        alt={img?.alt || ''}
                                        className="w-full h-auto transition-transform duration-500 group-hover:scale-110"
                                    />
                                </MediaUploadOverlay>
                                <div
                                    className="absolute inset-0 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                    style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.800), transparent)` }}
                                >
                                    {img.caption && <Body size="small" className="text-white font-medium">{img.caption}</Body>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}
