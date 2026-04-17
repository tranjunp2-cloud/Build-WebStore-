'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { FeaturesConfig } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard, staggerContainer, staggerItem } from '../shared/animations'
import { IconContainer, SectionLabel, GradientBlob } from '../shared/decorative'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { SectionWrapper } from '../shared/SectionWrapper'

// Shared wrapper for all features variants — preserves AnimatedSection
// (block-internal framer-motion) while delegating padding/container/inner
// gutter to SectionWrapper tokens. The block keeps its decorative
// GradientBlob since that is structural, not a Phase 05 concern.
function FeaturesSection({ children }: { children: React.ReactNode }) {
    return (
        <AnimatedSection className="relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
            <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="relative z-10">
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

// Shared section header for all variants — uses Typography components so
// type scale, line height, and font weight come from Phase 02 tokens.
function FeaturesHeader({
    sectionLabel,
    headline,
    subheadline,
}: {
    sectionLabel?: string
    headline: string
    subheadline?: string
}) {
    return (
        <div className="text-center max-w-2xl mx-auto mb-16">
            {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
            <RichText
                text={headline}
                as="h2"
                className="font-heading mb-5 text-4xl md:text-5xl font-bold leading-tight"
            />
            {subheadline && (
                <Body size="lg" className="opacity-50 leading-relaxed">
                    {subheadline}
                </Body>
            )}
        </div>
    )
}

const FALLBACK_FEATURES: FeaturesConfig['features'] = [
    { icon: '⭐', title: 'Quality Service', description: 'Exceptional quality in every interaction.' },
    { icon: '🚀', title: 'Fast Response', description: 'Quick turnaround on all requests.' },
    { icon: '💎', title: 'Premium Experience', description: 'Carefully crafted for discerning customers.' },
    { icon: '🛡️', title: 'Trusted & Reliable', description: 'Years of consistent service excellence.' },
]

export function FeaturesBlock({ block, theme }: BlockProps<FeaturesConfig>) {
    const { headline, subheadline, features: rawFeatures = [], variant = 'grid-3' } = block
    const features = rawFeatures.length > 0 ? rawFeatures : FALLBACK_FEATURES

    /* Plan 260415 Lỗi E — empty state dev warn thay vì render header trống */
    if (!features.length) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[features] features array empty — block rendered nothing')
        }
        return null
    }

    // ── icon-top variant ──────────────────────────────────────────────────
    if (variant === 'icon-top') {
        return (
            <FeaturesSection>
                <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />
                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, i) => (
                        <StaggerItem key={`${feature.title}-${i}`}>
                            <HoverCard
                                className={`${CARD_PADDING.lg} rounded-2xl h-full text-center group transition-all duration-300 hover:shadow-xl`}
                                style={{
                                    border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                    background: CSS_VARS.surfacePrimary,
                                }}
                            >
                                {feature.icon && (
                                    <div className="flex justify-center mb-6">
                                        <IconContainer color={CSS_VARS.primary} size="lg" className="group-hover:scale-110 transition-transform duration-300">
                                            {feature.icon}
                                        </IconContainer>
                                    </div>
                                )}
                                <Heading level={3} className="mb-3">{feature.title}</Heading>
                                <Body size="small" className="opacity-50 leading-relaxed">{feature.description}</Body>
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </FeaturesSection>
        )
    }

    // ── icon-left variant ─────────────────────────────────────────────────
    if (variant === 'icon-left') {
        return (
            <FeaturesSection>
                <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />
                <StaggerGrid className="flex flex-col gap-6 max-w-3xl mx-auto">
                    {features.map((feature, i) => (
                        <StaggerItem key={`${feature.title}-${i}`}>
                            <div
                                className={`flex items-start gap-5 ${CARD_PADDING.md} rounded-2xl transition-all duration-300 hover:shadow-lg`}
                                style={{
                                    border: '1px solid rgba(var(--brand-primary-rgb), 0.071)',
                                    background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.024), transparent)',
                                }}
                            >
                                {feature.icon && (
                                    <div
                                        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl"
                                        style={{
                                            background: 'rgba(var(--brand-primary-rgb), 0.1)',
                                            color: CSS_VARS.primary,
                                        }}
                                    >
                                        {feature.icon}
                                    </div>
                                )}
                                <div>
                                    <Heading level={4} className="mb-1">{feature.title}</Heading>
                                    <Body size="small" className="opacity-50 leading-relaxed">{feature.description}</Body>
                                </div>
                            </div>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </FeaturesSection>
        )
    }

    // ── zigzag variant ────────────────────────────────────────────────────
    if (variant === 'zigzag') {
        return (
            <FeaturesSection>
                <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-50px' }}
                    variants={staggerContainer}
                    className="flex flex-col gap-16 max-w-5xl mx-auto"
                >
                    {features.map((feature, i) => {
                        const isEven = i % 2 === 1
                        return (
                            <motion.div
                                key={`${feature.title}-${i}`}
                                variants={staggerItem}
                                className={`flex flex-col md:flex-row items-center gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`}
                            >
                                {/* Icon side */}
                                <div
                                    className="flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-3xl"
                                    style={{
                                        background: 'rgba(var(--brand-primary-rgb), 0.08)',
                                        border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                                    }}
                                >
                                    {feature.icon && (
                                        <span className="text-4xl" style={{ color: CSS_VARS.primary }}>{feature.icon}</span>
                                    )}
                                </div>
                                {/* Content side */}
                                <div className={`flex-1 ${isEven ? 'md:text-right' : ''}`}>
                                    <Heading level={3} className="mb-3">{feature.title}</Heading>
                                    <Body className="opacity-50 leading-relaxed">{feature.description}</Body>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            </FeaturesSection>
        )
    }

    // ── carousel variant ──────────────────────────────────────────────────
    if (variant === 'carousel') {
        return <FeaturesCarousel block={block} theme={theme} headline={headline} subheadline={subheadline} features={features} />
    }

    // ── list variant ─────────────────────────────────────────────────────
    if (variant === 'list') {
        return (
            <FeaturesSection>
                <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />
                <StaggerGrid className="flex flex-col gap-5 max-w-3xl mx-auto">
                    {features.map((feature, i) => (
                        <StaggerItem key={`${feature.title}-${i}`}>
                            <HoverCard
                                className={`flex items-center gap-6 ${CARD_PADDING.md} rounded-2xl h-full group transition-all duration-300 hover:shadow-xl`}
                                style={{
                                    background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.024), transparent)`,
                                    border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                                }}
                            >
                                {feature.icon && (
                                    <IconContainer color={CSS_VARS.primary} className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        {feature.icon}
                                    </IconContainer>
                                )}
                                <div className="flex-1 min-w-0">
                                    <Heading level={4} className="mb-1">{feature.title}</Heading>
                                    <Body size="small" className="opacity-50 leading-relaxed">{feature.description}</Body>
                                </div>
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </FeaturesSection>
        )
    }

    // ── Default grid variants (grid-2, grid-3, grid-4) ───────────────────
    const gridCols = {
        'grid-2': 'grid-cols-1 md:grid-cols-2',
        'grid-3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        'grid-4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    }[variant] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

    return (
        <FeaturesSection>
            <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />

            {/* Feature Cards */}
            <StaggerGrid className={`grid gap-6 ${gridCols}`}>
                {features.map((feature, i) => (
                    <StaggerItem key={`${feature.title}-${i}`}>
                        <HoverCard
                            className={`${CARD_PADDING.lg} rounded-2xl h-full transition-all duration-300 group hover:shadow-xl`}
                            style={{
                                background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.024), transparent)`,
                                border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                                boxShadow: `0 2px 8px rgba(var(--brand-primary-rgb), 0.02)`,
                            }}
                        >
                            {/* Icon */}
                            {feature.icon && (
                                <IconContainer color={CSS_VARS.primary} className="mb-5 group-hover:scale-110 transition-transform duration-300">
                                    {feature.icon}
                                </IconContainer>
                            )}

                            <Heading level={3} className="mb-3 group-hover:opacity-100 transition-opacity">
                                {feature.title}
                            </Heading>
                            <Body size="small" className="opacity-50 leading-relaxed">{feature.description}</Body>

                            {/* Bottom accent line on hover */}
                            <div
                                className="mt-6 h-0.5 w-0 group-hover:w-12 transition-all duration-500 rounded-full"
                                style={{ background: `linear-gradient(90deg, var(--brand-primary), transparent)` }}
                            />
                        </HoverCard>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </FeaturesSection>
    )
}

// ── Carousel sub-component (uses useState) ────────────────────────────────
function FeaturesCarousel({
    block,
    theme: _theme,
    headline,
    subheadline,
    features,
}: {
    block: BlockProps<FeaturesConfig>['block']
    theme: BlockProps<FeaturesConfig>['theme']
    headline: string
    subheadline?: string
    features: FeaturesConfig['features']
}) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true)

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 0)
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
    }, [])

    const scroll = useCallback((direction: 'left' | 'right') => {
        const el = scrollRef.current
        if (!el) return
        const amount = direction === 'left' ? -320 : 320
        el.scrollBy({ left: amount, behavior: 'smooth' })
        setTimeout(updateScrollState, 350)
    }, [updateScrollState])

    return (
        <FeaturesSection>
            <FeaturesHeader sectionLabel={block.sectionLabel} headline={headline} subheadline={subheadline} />

            <div className="relative">
                {/* Nav arrows — desktop only */}
                <button
                    onClick={() => scroll('left')}
                    className={`flex absolute left-2 md:-left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-10 md:h-10 items-center justify-center rounded-full border transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
                    style={{
                        background: CSS_VARS.surfacePrimary,
                        borderColor: 'rgba(var(--brand-primary-rgb), 0.2)',
                        color: CSS_VARS.primary,
                    }}
                    aria-label="Scroll left"
                >
                    &#8592;
                </button>
                <button
                    onClick={() => scroll('right')}
                    className={`flex absolute right-2 md:-right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-10 md:h-10 items-center justify-center rounded-full border transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
                    style={{
                        background: CSS_VARS.surfacePrimary,
                        borderColor: 'rgba(var(--brand-primary-rgb), 0.2)',
                        color: CSS_VARS.primary,
                    }}
                    aria-label="Scroll right"
                >
                    &#8594;
                </button>

                <div
                    ref={scrollRef}
                    onScroll={updateScrollState}
                    className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {features.map((feature, i) => (
                        <motion.div
                            /* Plan 260415 Lỗi F — stable key; Lỗi C — responsive card width */
                            key={`${feature.title}-${i}`}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            className={`flex-shrink-0 w-[280px] sm:w-[300px] md:w-[320px] snap-start ${CARD_PADDING.lg} rounded-2xl group transition-all duration-300 hover:shadow-xl`}
                            style={{
                                background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.024), transparent)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.071)',
                            }}
                        >
                            {feature.icon && (
                                <IconContainer color={CSS_VARS.primary} className="mb-5 group-hover:scale-110 transition-transform duration-300">
                                    {feature.icon}
                                </IconContainer>
                            )}
                            <Heading level={3} className="mb-3">{feature.title}</Heading>
                            <Body size="small" className="opacity-50 leading-relaxed">{feature.description}</Body>
                        </motion.div>
                    ))}
                </div>
            </div>
        </FeaturesSection>
    )
}
