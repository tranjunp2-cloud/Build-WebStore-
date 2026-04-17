'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion, useInView } from 'framer-motion'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import type { BlockProps } from '../types'
import type { StatsConfig, StatItem } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

const FALLBACK_STATS: StatsConfig['stats'] = [
    { value: '500+', label: 'Happy Customers' },
    { value: '10+', label: 'Years Experience' },
    { value: '4.9', label: 'Average Rating', suffix: '★' },
]

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

type StatsSectionProps = {
    children: ReactNode
    narrow?: boolean
    style?: React.CSSProperties
}

function StatsSection({ children, narrow = false, style }: StatsSectionProps) {
    return (
        <AnimatedSection style={style}>
            <SectionWrapper
                as="div"
                padding="compact"
                container={narrow ? 'narrow' : 'default'}
                background="transparent"
            >
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

function StatsHeadline({ headline }: { headline?: string }) {
    if (!headline) return null
    return (
        <Heading level={2} className="text-center mb-10" style={{ fontFamily: CSS_VARS.fontHeading }}>
            <RichText text={headline} as="span" />
        </Heading>
    )
}

function CountUp({ value, duration = 1200 }: { value: string; duration?: number }) {
    const ref = useRef<HTMLSpanElement>(null)
    const isInView = useInView(ref, { once: true })
    const shouldReduce = useReducedMotion()
    // Plan 260415 Lỗi E — treat value as animatable when it has a single
    // numeric portion. Support:
    //   "500+", "98%", "10+" (single int)
    //   "4.5★", "4.9" (single decimal) — Lỗi F parseFloat
    //   "$1,000,000", "1.000.000" (comma/dot thousand separator) — strip first
    // Multi-distinct values like "24/7" still render static (2 digit runs).
    const stripped = value.replace(/[,_]/g, '') // thousand separators
    const numericMatch = stripped.match(/-?\d+\.?\d*/g) ?? []
    const isSingleNumeric = numericMatch.length === 1
    const numericValue = isSingleNumeric ? parseFloat(numericMatch[0]!) : NaN
    const hasDecimal = isSingleNumeric && numericMatch[0]!.includes('.')
    const decimals = hasDecimal ? numericMatch[0]!.split('.')[1]!.length : 0
    const isNumeric = isSingleNumeric && !isNaN(numericValue)
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!isInView || !isNumeric || shouldReduce) {
            if (isNumeric) setCount(numericValue)
            return
        }
        let start = 0
        const step = numericValue / (duration / 16)
        const timer = setInterval(() => {
            start += step
            if (start >= numericValue) {
                setCount(numericValue)
                clearInterval(timer)
            } else {
                setCount(start)
            }
        }, 16)
        return () => clearInterval(timer)
    }, [isInView, isNumeric, numericValue, duration, shouldReduce])

    if (!isNumeric) return <span ref={ref}>{value}</span>

    // Plan 260415 Lỗi E — format count với số thập phân + preserve thousand separators.
    // Dùng `toLocaleString()` không tham số để browser tự detect locale — hỗ trợ
    // tiếng Việt (1.234) và English (1,234) tự động theo user setting.
    const formattedCount = hasDecimal
        ? count.toFixed(decimals)
        : Math.floor(count).toLocaleString()
    const formatted = value.replace(/-?[\d.,]+/, formattedCount)
    return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatted}</span>
}

function StatValue({ stat }: { stat: StatItem }) {
    return (
        <>
            {stat.prefix && <span>{stat.prefix}</span>}
            <CountUp value={stat.value} />
            {stat.suffix && <span>{stat.suffix}</span>}
        </>
    )
}

/* Plan 260415 Lỗi D — aria-label nên đi trên wrapper element, không phải <p>.
   Dùng <div role="group" aria-label> để wrap cả number + label semantic group. */
function RowVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <StatsSection style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}>
            <StatsHeadline headline={headline} />
            <StaggerGrid className="flex flex-col sm:flex-row flex-wrap justify-center gap-8 md:gap-12">
                {stats.map((stat, i) => (
                    <StaggerItem
                        /* Plan 260415 Lỗi B — stable key */
                        key={`${stat.label}-${i}`}
                        className="flex-1 min-w-[140px] text-center"
                    >
                        <div role="group" aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}>
                            <p
                                className="text-4xl md:text-5xl font-bold mb-2"
                                style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary, fontVariantNumeric: 'tabular-nums' }}
                            >
                                <StatValue stat={stat} />
                            </p>
                            <Body size="small" style={{ color: CSS_VARS.muted }}>{stat.label}</Body>
                        </div>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </StatsSection>
    )
}

function GridVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <StatsSection style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <StatsHeadline headline={headline} />
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <StaggerItem
                        key={`${stat.label}-${i}`}
                        className={`text-center ${CARD_PADDING.md} transition-shadow hover:shadow-md`}
                        style={{
                            background: CSS_VARS.surface,
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <div role="group" aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}>
                            <p
                                className="text-4xl font-bold mb-2"
                                style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary, fontVariantNumeric: 'tabular-nums' }}
                            >
                                <StatValue stat={stat} />
                            </p>
                            <Body size="small" style={{ color: CSS_VARS.muted }}>{stat.label}</Body>
                        </div>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </StatsSection>
    )
}

function HighlightVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <StatsSection
            narrow
            style={{ color: CSS_VARS.text, background: 'rgba(var(--brand-primary-rgb), 0.05)' }}
        >
            <StatsHeadline headline={headline} />
            <StaggerGrid className="flex flex-col gap-6">
                {stats.map((stat, i) => {
                    /* Plan 260415 Lỗi F — parseFloat thay vì parseInt strip non-digit.
                       "4.5" parse đúng decimal, "98" vẫn work. */
                    const stripped = stat.value.replace(/[,_]/g, '').match(/-?\d+\.?\d*/)?.[0] || ''
                    const numericValue = parseFloat(stripped)
                    const percentage = !isNaN(numericValue) && numericValue >= 0 && numericValue <= 100 ? numericValue : null

                    return (
                        <StaggerItem
                            /* Plan 260415 Lỗi B — stable key */
                            key={`${stat.label}-${i}`}
                            className="w-full"
                        >
                            <div
                                role="group"
                                aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Caption className="font-medium" style={{ color: CSS_VARS.text }}>
                                        {stat.label}
                                    </Caption>
                                    <span
                                        className="text-lg font-bold"
                                        style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary, fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        <StatValue stat={stat} />
                                    </span>
                                </div>
                                {/* Plan 260415 Lỗi G — chỉ render progress bar khi numeric percentage,
                                    không hard-code 75% arbitrary cho non-percent values */}
                                {percentage !== null && (
                                    <div
                                        className="w-full h-2 overflow-hidden"
                                        style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)', borderRadius: 'var(--radius-full)' }}
                                        role="progressbar"
                                        aria-valuenow={percentage}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                    >
                                        <div
                                            className="h-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${percentage}%`,
                                                background: CSS_VARS.primary,
                                                borderRadius: 'var(--radius-full)',
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </StaggerItem>
                    )
                })}
            </StaggerGrid>
        </StatsSection>
    )
}

export function StatsBlock({ block }: BlockProps<StatsConfig>) {
    const { headline, stats: rawStats = [], variant = 'row' } = block
    const stats = rawStats.length > 0 ? rawStats : FALLBACK_STATS

    /* Plan 260415 Lỗi C — empty state dev warn */
    if (!stats.length) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[stats] stats array empty — block rendered nothing')
        }
        return null
    }

    switch (variant) {
        case 'grid':
            return <GridVariant headline={headline} stats={stats} />
        case 'highlight':
            return <HighlightVariant headline={headline} stats={stats} />
        case 'row':
        default:
            return <RowVariant headline={headline} stats={stats} />
    }
}
