'use client'

import type { BlockProps } from '../types'
import type { FeaturesConfig } from './config'
import { StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { IconContainer, SectionLabel, GradientBlob } from '../shared/decorative'

export function FeaturesBlock({ block, theme }: BlockProps<FeaturesConfig>) {
    const { headline, subheadline, features = [], variant = 'grid-3' } = block
    const pc = theme.primaryColor

    const gridCols = {
        'grid-2': 'grid-cols-1 md:grid-cols-2',
        'grid-3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        'grid-4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        'list': 'grid-cols-1 max-w-2xl mx-auto',
    }[variant] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={pc} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                {/* Section Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && (
                        <SectionLabel color={pc}>{block.sectionLabel}</SectionLabel>
                    )}
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                </div>

                {/* Feature Cards */}
                <StaggerGrid className={`grid gap-6 ${gridCols}`}>
                    {features.map((feature, i) => (
                        <StaggerItem key={i}>
                            <HoverCard
                                className="p-8 rounded-2xl h-full transition-all duration-300 group"
                                style={{
                                    background: `linear-gradient(135deg, ${pc}06, transparent)`,
                                    border: `1px solid ${pc}12`,
                                    boxShadow: `0 2px 8px ${pc}05`,
                                }}
                            >
                                {/* Icon */}
                                {feature.icon && (
                                    <IconContainer color={pc} className="mb-5 group-hover:scale-110 transition-transform duration-300">
                                        {feature.icon}
                                    </IconContainer>
                                )}

                                <h3 className="text-xl font-bold font-heading mb-3 group-hover:opacity-100 transition-opacity">
                                    {feature.title}
                                </h3>
                                <p className="opacity-50 leading-relaxed text-sm">{feature.description}</p>

                                {/* Bottom accent line on hover */}
                                <div
                                    className="mt-6 h-0.5 w-0 group-hover:w-12 transition-all duration-500 rounded-full"
                                    style={{ background: `linear-gradient(90deg, ${pc}, transparent)` }}
                                />
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    )
}
