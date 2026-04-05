'use client'

import type { BlockProps } from '../types'
import type { TestimonialsConfig } from './config'
import { StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { AvatarRing, GradientBlob } from '../shared/decorative'
import { getTeamAvatar } from '@/lib/images/industry-images'

export function TestimonialsBlock({ block, theme, site }: BlockProps<TestimonialsConfig>) {
    const { headline, testimonials = [] } = block
    const pc = theme.primaryColor
    const category = (site?.siteType as string) || 'business'

    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={pc} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">
                        {headline || 'What Our Clients Say'}
                    </h2>
                    <p className="text-lg opacity-40">Genuine reviews from our customers</p>
                </div>

                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <StaggerItem key={i}>
                            <HoverCard
                                className="p-8 rounded-2xl h-full relative group transition-shadow duration-300 hover:shadow-xl"
                                style={{
                                    background: `linear-gradient(160deg, ${pc}08, transparent 60%)`,
                                    border: `1px solid ${pc}10`,
                                }}
                            >
                                {/* Decorative quote mark */}
                                <div
                                    className="absolute top-4 right-6 text-6xl font-serif leading-none opacity-[0.06] select-none"
                                    style={{ color: pc }}
                                >
                                    &ldquo;
                                </div>

                                {/* Star rating */}
                                <div className="flex gap-0.5 mb-5">
                                    {Array.from({ length: t.rating || 5 }).map((_, j) => (
                                        <span key={j} className="text-sm" style={{ color: pc }}>★</span>
                                    ))}
                                </div>

                                {/* Quote */}
                                <p className="opacity-70 mb-8 leading-relaxed text-[15px] italic relative z-10">
                                    &ldquo;{t.quote}&rdquo;
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-3 mt-auto">
                                    <AvatarRing color={pc} src={t.avatar?.url || getTeamAvatar(category, i)} name={t.name} size={44} />
                                    <div>
                                        <p className="font-semibold text-sm">{t.name}</p>
                                        {(t.title || t.company) && (
                                            <p className="text-xs opacity-45">
                                                {[t.title, t.company].filter(Boolean).join(' • ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    )
}
