'use client'

import { useMemo, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { AboutConfig, TimelineItem } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import { motion } from 'framer-motion'
import { getAboutImage } from '@/lib/images/industry-images'
import { SectionLabel } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { SectionWrapper } from '../shared/SectionWrapper'

// ── Local helpers (Plan 260415 about-bugfix) ────────────────────────────────

type AboutSectionProps = {
    children: ReactNode
    narrow?: boolean
    className?: string
}

/** Outer wrapper for all variants. AnimatedSection + SectionWrapper container. */
function AboutSection({ children, narrow = false, className = '' }: AboutSectionProps) {
    return (
        <AnimatedSection
            className={className}
            style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
        >
            <SectionWrapper
                as="div"
                padding="default"
                container={narrow ? 'narrow' : 'default'}
                background="transparent"
            >
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

/**
 * Plan 260415 Lỗi E — shared AboutImage component thay vì duplicate 2 motion.div
 * trong Split variant. CSS order swap thay vì render 2 copies.
 * Thêm `aspect-[4/3]` guard CLS khi image load.
 * Plan 260415 Lỗi 9A — alt text fallback tốt hơn ("about image" vs headline).
 */
function AboutImage({
    imageUrl,
    alt,
    slideFrom = 'right',
}: {
    imageUrl: string
    alt: string
    slideFrom?: 'left' | 'right'
}) {
    const x = slideFrom === 'left' ? -30 : 30
    return (
        <motion.div
            initial={{ opacity: 0, x }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
        >
            <img
                src={imageUrl}
                alt={alt}
                className="w-full h-auto object-cover aspect-[4/3] max-h-[500px]"
                style={{ borderRadius: 'var(--radius-lg)' }}
                loading="lazy"
            />
        </motion.div>
    )
}

/**
 * Plan 260415 Lỗi G (P1 CRITICAL) — toPlainText strip Lexical formatting.
 * Trước kia dùng `toPlainText(block.body)` → mất hết list/link/bold từ rich text.
 * Giờ dùng `<RichText text={body} />` trực tiếp cho Lexical JSON hoặc string.
 * `RichText` component handle cả 2 types (string + Lexical) qua runtime check.
 */
function SimpleVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, body } = block
    // Plan 260415 Lỗi 13A — early return nếu rỗng toàn bộ content
    if (!headline && !body && !sectionLabel) return null

    return (
        <AboutSection narrow>
            <div className="text-center">
                {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                {headline && (
                    <Heading level={2} className="mb-6" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {body && (
                    <Body size="lg" style={{ color: CSS_VARS.muted }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </div>
        </AboutSection>
    )
}

/**
 * Plan 260415 Lỗi E — Split variant giờ dùng shared AboutImage + CSS grid order
 * thay vì duplicate motion.div. 30 dòng code giảm còn 1 render. Lỗi B — memoize
 * getAboutImage per category để không gọi lại mỗi render.
 */
function SplitVariant({ block, category }: { block: AboutConfig; category: string }) {
    const { headline, sectionLabel, body, layout = 'image-right' } = block
    const imageUrl = useMemo(() => block.image?.url || getAboutImage(category), [block.image?.url, category])
    const imageAlt = block.image?.alt || `About ${headline || 'us'}`
    const isImageLeft = layout === 'image-left'

    return (
        <AboutSection className="relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
                <AboutImage
                    imageUrl={imageUrl}
                    alt={imageAlt}
                    slideFrom={isImageLeft ? 'left' : 'right'}
                />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className={isImageLeft ? 'lg:order-last' : 'lg:order-first'}
                >
                    {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                    {headline && (
                        <Heading level={2} className="mb-6 leading-tight" style={{ fontFamily: CSS_VARS.fontHeading }}>
                            <RichText text={headline} as="span" />
                        </Heading>
                    )}
                    {body && (
                        <Body size="lg" style={{ color: CSS_VARS.muted }}>
                            <RichText text={body} as="span" />
                        </Body>
                    )}
                </motion.div>
            </div>
        </AboutSection>
    )
}

/**
 * Plan 260415 Lỗi C — Story variant silent fallback → dev warning.
 * Plan 260415 Lỗi G — dùng RichText cho body.
 * Plan 260415 Lỗi F — Timeline layout refactor sang grid-cols-[1fr_auto_1fr]
 * để dot luôn center, không còn fragile order swap.
 * Plan 260415 Lỗi A — magic number left-[23px] → pl-6 + left-6 spacing token.
 */
function StoryVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, body, timelineItems } = block

    // Plan 260415 Lỗi C — dev warning khi story variant thiếu timeline
    if (!timelineItems?.length) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[about.story] missing timelineItems — falling back to simple variant')
        }
        return <SimpleVariant block={block} />
    }

    return (
        <AboutSection narrow>
            <div className="text-center mb-12">
                {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                {headline && (
                    <Heading level={2} className="mb-4" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {body && (
                    <Body size="lg" style={{ color: CSS_VARS.muted }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </div>

            <ol className="relative pl-6 md:pl-0" aria-label="Company timeline">
                {/* Plan 260415 Lỗi A — vertical line căn với dot center.
                    Mobile: left-6 (24px padding parent) − 3 (dot radius) = 21px rounded.
                    Use left-[calc(1.5rem+1px)] OR simpler: left-6 với translate-x (dot + line align). */}
                <div
                    className="absolute left-[calc(1.5rem-0.5px)] md:left-1/2 top-0 bottom-0 w-px md:-translate-x-1/2"
                    style={{ background: 'rgba(var(--brand-primary-rgb), 0.2)' }}
                    aria-hidden="true"
                />

                <StaggerGrid className="flex flex-col gap-10">
                    {timelineItems.map((item, i) => (
                        <TimelineEntry
                            key={`${item.year}-${i}`}
                            item={item}
                            index={i}
                        />
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

/**
 * Plan 260415 Lỗi F — refactor từ flex-row order swap fragile sang
 * CSS grid-cols-[1fr_auto_1fr]. Dot cột giữa luôn center không phụ thuộc
 * flex order. Content + year swap qua col-start.
 */
function TimelineEntry({ item, index }: { item: TimelineItem; index: number }) {
    const isEven = index % 2 === 0
    return (
        <StaggerItem>
            <li
                className="relative md:grid md:grid-cols-[1fr_auto_1fr] md:gap-8 md:items-center"
                aria-label={`${item.year}: ${item.title}`}
            >
                {/* Desktop left side */}
                <div className={`hidden md:block ${isEven ? 'md:col-start-1 md:text-right' : 'md:col-start-1 md:text-right md:invisible'}`}>
                    {isEven ? <TimelineContent item={item} /> : <TimelineYear item={item} />}
                </div>

                {/* Dot — always middle column on desktop */}
                <div
                    className="relative md:col-start-2 flex-shrink-0 w-3 h-3 rounded-full ring-4 ring-[var(--background)] z-10"
                    style={{ background: CSS_VARS.primary }}
                    aria-hidden="true"
                />

                {/* Desktop right side */}
                <div className={`hidden md:block ${isEven ? 'md:col-start-3' : 'md:col-start-3'}`}>
                    {isEven ? <TimelineYear item={item} /> : <TimelineContent item={item} />}
                </div>

                {/* Mobile: always left-aligned vertical stack */}
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

export function AboutBlock({ block, site }: BlockProps<AboutConfig>) {
    const { variant = 'simple' } = block
    // Plan 260415 Lỗi 8A — category fallback chain: siteType → category → business
    const category = (site?.siteType as string) || (site?.category as string) || 'business'

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
