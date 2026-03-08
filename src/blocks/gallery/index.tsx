'use client'

import type { BlockProps } from '../types'
import type { GalleryConfig } from './config'
import { StaggerGrid, StaggerItem } from '../shared/animations'
import { SectionLabel } from '../shared/decorative'

export function GalleryBlock({ block, theme }: BlockProps<GalleryConfig>) {
    const { headline, images = [] } = block
    const pc = theme.primaryColor

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <div className="text-center mb-14">
                        <SectionLabel color={pc}>Gallery</SectionLabel>
                        <h2 className="text-4xl md:text-5xl font-bold font-heading">{headline}</h2>
                    </div>
                )}
                <StaggerGrid className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {images.map((item, i) => (
                        <StaggerItem key={i} className="break-inside-avoid group">
                            {item.image?.url ? (
                                <div className="relative overflow-hidden rounded-2xl">
                                    <img
                                        src={item.image.url}
                                        alt={item.caption || item.image.alt || ''}
                                        className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {item.caption && (
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <p className="text-white text-sm font-medium">{item.caption}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className="aspect-square rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: `linear-gradient(135deg, ${pc}${(10 + i * 3).toString(16).padStart(2, '0')}, ${pc}05)`,
                                        border: `1px solid ${pc}10`,
                                    }}
                                >
                                    <span className="text-2xl opacity-20">📷</span>
                                </div>
                            )}
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    )
}
