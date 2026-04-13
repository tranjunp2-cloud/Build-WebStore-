'use client'

import type { BlockProps } from '../types'
import type { GalleryMasonryConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

export function GalleryMasonryBlock({ block, theme }: BlockProps<GalleryMasonryConfig>) {
    const { variant = 'masonry', headline, images = [] } = block

    const columnsClass = variant === 'grid-4'
        ? 'columns-2 md:columns-3 lg:columns-4'
        : variant === 'grid-3'
            ? 'columns-2 md:columns-3'
            : 'columns-2 md:columns-3 lg:columns-4'

    const isGrid = variant === 'grid-3' || variant === 'grid-4'
    const gridCols = variant === 'grid-4' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'

    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <div className="text-center mb-14">
                        <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading" />
                    </div>
                )}

                {isGrid ? (
                    <div className={`grid ${gridCols} gap-4`}>
                        {images.map((img, i) => (
                            <div key={i} className="relative group overflow-hidden rounded-2xl aspect-square">
                                <img
                                    src={img?.url}
                                    alt={img?.alt || ''}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div
                                    className="absolute inset-0 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.800), transparent)` }}
                                >
                                    {img.caption && <p className="text-white text-sm font-medium">{img.caption}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`${columnsClass} gap-4 space-y-4`}>
                        {images.map((img, i) => (
                            <div key={i} className="relative group overflow-hidden rounded-2xl break-inside-avoid">
                                <img
                                    src={img?.url}
                                    alt={img?.alt || ''}
                                    className="w-full h-auto transition-transform duration-500 group-hover:scale-110"
                                />
                                <div
                                    className="absolute inset-0 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.800), transparent)` }}
                                >
                                    {img.caption && <p className="text-white text-sm font-medium">{img.caption}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}
