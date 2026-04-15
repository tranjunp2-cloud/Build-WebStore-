'use client'

import type { ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { AboutConfig, TimelineItem } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import { motion } from 'framer-motion'
import { getAboutImage } from '@/lib/images/industry-images'
import { SectionLabel } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { toPlainText } from '@/lib/utils/to-plain-text'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

const ABOUT_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`
const ABOUT_CONTAINER_NARROW = `${CONTAINER.narrow} mx-auto ${INNER_PADDING}`

type AboutSectionProps = {
    children: ReactNode
    narrow?: boolean
    className?: string
}

/** Outer wrapper for all variants. AnimatedSection + token container. */
function AboutSection({ children, narrow = false, className = '' }: AboutSectionProps) {
    const containerCls = narrow ? ABOUT_CONTAINER_NARROW : ABOUT_CONTAINER
    return (
        <AnimatedSection
            className={`${SECTION_PADDING.default} ${className}`.trim()}
            style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
        >
            <div className={containerCls}>{children}</div>
        </AnimatedSection>
    )
}

function SimpleVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel } = block
    const body = toPlainText(block.body)
    return (
        <AboutSection narrow>
            <div className="text-center">
                {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                <Heading level={2} className="mb-6" style={{ fontFamily: CSS_VARS.fontHeading }}>
                    <RichText text={headline} as="span" />
                </Heading>
                {body && (
                    <Body size="lg" style={{ color: CSS_VARS.muted }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </div>
        </AboutSection>
    )
}

function SplitVariant({ block, category }: { block: AboutConfig; category: string }) {
    const { headline, sectionLabel, layout = 'image-right' } = block
    const body = toPlainText(block.body)
    const imageUrl = block.image?.url || getAboutImage(category)
    const imageAlt = block.image?.alt || headline
    const isImageLeft = layout === 'image-left'

    return (
        <AboutSection className="relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
                {isImageLeft && (
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <img
                            src={imageUrl}
                            alt={imageAlt}
                            className="w-full h-auto object-cover max-h-[450px]"
                            style={{ borderRadius: CSS_VARS.radiusLg }}
                            loading="lazy"
                        />
                    </motion.div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                    <Heading level={2} className="mb-6 leading-tight" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        <RichText text={headline} as="span" />
                    </Heading>
                    {body && (
                        <Body size="lg" style={{ color: CSS_VARS.muted }}>
                            <RichText text={body} as="span" />
                        </Body>
                    )}
                </motion.div>

                {!isImageLeft && (
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                    >
                        <img
                            src={imageUrl}
                            alt={imageAlt}
                            className="w-full h-auto object-cover max-h-[450px]"
                            style={{ borderRadius: CSS_VARS.radiusLg }}
                            loading="lazy"
                        />
                    </motion.div>
                )}
            </div>
        </AboutSection>
    )
}

function StoryVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, timelineItems } = block
    const body = toPlainText(block.body)

    // Fallback: if no timelineItems, render simple
    if (!timelineItems?.length) {
        return <SimpleVariant block={block} />
    }

    return (
        <AboutSection narrow>
            <div className="text-center mb-12">
                {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                <Heading level={2} className="mb-4" style={{ fontFamily: CSS_VARS.fontHeading }}>
                    <RichText text={headline} as="span" />
                </Heading>
                {body && (
                    <Body size="lg" style={{ color: CSS_VARS.muted }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </div>

            <ol className="relative" aria-label="Company timeline">
                {/* Vertical line */}
                <div
                    className="absolute left-[23px] md:left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
                    style={{ background: 'rgba(var(--brand-primary-rgb), 0.2)' }}
                    aria-hidden="true"
                />

                <StaggerGrid className="flex flex-col gap-10">
                    {timelineItems.map((item, i) => (
                        <TimelineEntry key={i} item={item} index={i} isLast={i === timelineItems.length - 1} />
                    ))}
                </StaggerGrid>
            </ol>
        </AboutSection>
    )
}

function TimelineYear({ item }: { item: TimelineItem }) {
    return (
        <Caption className="font-bold" style={{ color: CSS_VARS.primary, fontFamily: CSS_VARS.fontHeading }}>
            {item.icon && <span className="mr-1">{item.icon}</span>}
            {item.year}
        </Caption>
    )
}

function TimelineEntry({ item, index }: { item: TimelineItem; index: number; isLast?: boolean }) {
    const isEven = index % 2 === 0
    return (
        <StaggerItem>
            <li className="relative flex flex-col md:flex-row items-start md:items-center gap-4" aria-label={`${item.year}: ${item.title}`}>
                {/* Desktop: alternating sides */}
                <div className={`hidden md:block md:w-1/2 ${isEven ? 'text-right pr-8' : 'order-2 pl-8'}`}>
                    {isEven ? <TimelineContent item={item} /> : <TimelineYear item={item} />}
                </div>

                {/* Dot */}
                <div
                    className="relative z-10 w-3 h-3 rounded-full flex-shrink-0 ring-4 ring-[var(--background)]"
                    style={{
                        background: CSS_VARS.primary,
                    }}
                    aria-hidden="true"
                />

                <div className={`hidden md:block md:w-1/2 ${isEven ? 'pl-8 order-2' : 'text-right pr-8'}`}>
                    {isEven ? <TimelineYear item={item} /> : <TimelineContent item={item} />}
                </div>

                {/* Mobile: always left-aligned */}
                <div className="md:hidden pl-4">
                    <span className="block mb-1">
                        <TimelineYear item={item} />
                    </span>
                    <TimelineContent item={item} />
                </div>
            </li>
        </StaggerItem>
    )
}

function TimelineContent({ item }: { item: TimelineItem }) {
    return (
        <div>
            <Heading level={4} style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                {item.title}
            </Heading>
            {item.description && (
                <Body size="small" className="mt-1" style={{ color: CSS_VARS.muted }}>
                    {item.description}
                </Body>
            )}
        </div>
    )
}

export function AboutBlock({ block, site }: BlockProps<AboutConfig>) {
    const { variant = 'simple' } = block
    const category = (site?.siteType as string) || 'business'

    switch (variant) {
        case 'split':
            return <SplitVariant block={block} category={category} />
        case 'story':
            return <StoryVariant block={block} />
        case 'simple':
        default:
            return <SimpleVariant block={block} />
    }
}
