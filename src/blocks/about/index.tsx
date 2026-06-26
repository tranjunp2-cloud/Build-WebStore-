'use client'

import { useMemo, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { AboutConfig, TimelineItem } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import { motion } from 'framer-motion'
import { getAboutImage } from '@/lib/images/industry-images'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'
import {
    SectionLabel,
    DiagonalStripe,
    LayeredShapes,
    TypographicMark,
    GridLines,
    MeshGradient,
    DuotoneOverlay,
} from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { SectionWrapper } from '../shared/SectionWrapper'

// ── Local helpers (Plan 260415 about-bugfix) ────────────────────────────────

type AboutSectionProps = {
    children: ReactNode
    narrow?: boolean
    className?: string
    decorative?: ReactNode
}

/**
 * Outer wrapper for all variants. AnimatedSection + SectionWrapper container.
 * Phase A4 (260417) — `decorative` slot adds visual vocabulary per variant.
 * When decorative is provided, ensures `relative overflow-hidden` is on the
 * outer tag so absolute-positioned primitives are constrained.
 */
function AboutSection({ children, narrow = false, className = '', decorative }: AboutSectionProps) {
    const wrapperClass = decorative
        ? `relative overflow-hidden ${className}`.trim()
        : className
    return (
        <AnimatedSection
            className={wrapperClass}
            style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
        >
            {decorative}
            <SectionWrapper
                as="div"
                padding="default"
                container={narrow ? 'narrow' : 'default'}
                background="transparent"
                innerClassName={decorative ? 'relative z-10' : ''}
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
            <MediaUploadOverlay field="image" altText={alt}>
                <img
                    src={imageUrl}
                    alt={alt}
                    className="w-full h-auto object-cover aspect-[4/3] max-h-[500px]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                    loading="lazy"
                />
            </MediaUploadOverlay>
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
        <AboutSection narrow decorative={<DiagonalStripe color={CSS_VARS.primary} opacity={0.06} />}>
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
function SplitVariant({ block, category, s3Map }: { block: AboutConfig; category: string; s3Map?: Record<string, string> }) {
    const { headline, sectionLabel, body, layout = 'image-right' } = block
    const imageUrl = useMemo(() => block.image?.url || getAboutImage(category, s3Map), [block.image?.url, category, s3Map])
    const imageAlt = block.image?.alt || `About ${headline || 'us'}`
    const isImageLeft = layout === 'image-left'

    return (
        <AboutSection decorative={<LayeredShapes color={CSS_VARS.primary} opacity={0.1} />}>
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
        <AboutSection narrow decorative={<TypographicMark text="STORY" color={CSS_VARS.primary} opacity={0.04} size="lg" />}>
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

// ── A5 (260417) — 4 new about variants for pool diversity ────────────────────

/**
 * two-column: editorial newspaper-like CSS columns layout for body. Best when
 * body is long-form. A4 vocab: GridLines (architectural backdrop).
 */
function TwoColumnVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, body } = block
    if (!headline && !body && !sectionLabel) return null
    return (
        <AboutSection narrow decorative={<GridLines color={CSS_VARS.primary} spacing={56} opacity={0.04} />}>
            <div className="text-center mb-8">
                {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
                {headline && (
                    <Heading level={2} className="mb-4" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
            </div>
            {body && (
                <div className="md:columns-2 md:gap-10 max-w-4xl mx-auto" style={{ color: CSS_VARS.muted }}>
                    <Body size="lg" className="leading-relaxed">
                        <RichText text={body} as="span" />
                    </Body>
                </div>
            )}
        </AboutSection>
    )
}

/**
 * founder-quote: body rendered as a pulled quote with large opening "; the
 * sectionLabel becomes the attribution underneath. Personal/founder voice.
 * A4 vocab: TypographicMark — giant quotation mark watermark.
 */
function FounderQuoteVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, body } = block
    if (!body && !headline) return null
    return (
        <AboutSection narrow decorative={<TypographicMark text="“" color={CSS_VARS.primary} opacity={0.06} size="xl" />}>
            <div className="text-center max-w-3xl mx-auto">
                {headline && (
                    <Heading level={2} className="mb-8" style={{ fontFamily: CSS_VARS.fontHeading }}>
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {body && (
                    <blockquote
                        className="text-xl md:text-2xl italic leading-relaxed mb-6"
                        style={{ color: CSS_VARS.text }}
                    >
                        <RichText text={body} as="span" />
                    </blockquote>
                )}
                {sectionLabel && (
                    <Caption className="opacity-70" style={{ color: CSS_VARS.muted }}>
                        — {sectionLabel}
                    </Caption>
                )}
            </div>
        </AboutSection>
    )
}

/**
 * centered-large: oversized hero-like simple variant. Bigger sectionLabel,
 * larger headline, more padding. Use when about is the page focal point.
 * A4 vocab: MeshGradient (focal effect).
 */
function CenteredLargeVariant({ block }: { block: AboutConfig }) {
    const { headline, sectionLabel, body } = block
    if (!headline && !body && !sectionLabel) return null
    return (
        <AboutSection
            narrow
            className="!py-24 md:!py-32"
            decorative={<MeshGradient color={CSS_VARS.primary} accentColor={CSS_VARS.secondary} opacity={0.25} />}
        >
            <div className="text-center max-w-3xl mx-auto">
                {sectionLabel && (
                    <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>
                )}
                {headline && (
                    <Heading
                        level={1}
                        className="mb-8 text-4xl md:text-6xl font-bold leading-tight"
                        style={{ fontFamily: CSS_VARS.fontHeading }}
                    >
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {body && (
                    <Body size="lg" className="leading-relaxed" style={{ color: CSS_VARS.muted }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </div>
        </AboutSection>
    )
}

/**
 * image-overlay: full-bleed image (when provided) with text overlaid + tinted
 * DuotoneOverlay for legibility. Falls back to centered-large when no image.
 */
function ImageOverlayVariant({ block, category, s3Map }: { block: AboutConfig; category: string; s3Map?: Record<string, string> }) {
    const { headline, sectionLabel, body } = block
    const imageUrl = block.image?.url || getAboutImage(category, s3Map)
    if (!imageUrl) return <CenteredLargeVariant block={block} />
    return (
        <AnimatedSection
            className="relative overflow-hidden"
            style={{ color: '#ffffff', minHeight: 480 }}
        >
            <img
                src={imageUrl}
                alt={block.image?.alt || `About ${headline || 'us'}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
            />
            <DuotoneOverlay color1="#0a0a0a" color2={CSS_VARS.primary} opacity={0.65} blendMode="multiply" />
            <SectionWrapper
                as="div"
                padding="relaxed"
                container="default"
                background="transparent"
                innerClassName="relative z-10 text-center max-w-3xl"
            >
                {sectionLabel && (
                    <p
                        className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}
                    >
                        {sectionLabel}
                    </p>
                )}
                {headline && (
                    <Heading
                        level={2}
                        className="mb-6 text-3xl md:text-5xl font-bold leading-tight"
                        style={{ color: '#ffffff', fontFamily: CSS_VARS.fontHeading }}
                    >
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {body && (
                    <Body size="lg" className="opacity-90 leading-relaxed" style={{ color: '#ffffff' }}>
                        <RichText text={body} as="span" />
                    </Body>
                )}
            </SectionWrapper>
        </AnimatedSection>
    )
}

export function AboutBlock({ block, site }: BlockProps<AboutConfig>) {
    const { variant = 'simple' } = block
    // Plan 260415 Lỗi 8A — category fallback chain: siteType → category → business
    const category = (site?.siteType as string) || (site?.category as string) || 'business'
    const s3Map = site?.imageLibraryS3 as Record<string, string> | undefined

    switch (variant) {
        case 'split':
            return <SplitVariant block={block} category={category} s3Map={s3Map} />
        case 'story':
            return <StoryVariant block={block} />
        case 'two-column':
            return <TwoColumnVariant block={block} />
        case 'founder-quote':
            return <FounderQuoteVariant block={block} />
        case 'centered-large':
            return <CenteredLargeVariant block={block} />
        case 'image-overlay':
            return <ImageOverlayVariant block={block} category={category} s3Map={s3Map} />
        case 'simple':
        default:
            return <SimpleVariant block={block} />
    }
}
