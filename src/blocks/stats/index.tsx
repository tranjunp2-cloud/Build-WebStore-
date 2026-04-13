'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useInView } from 'framer-motion'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import type { BlockProps } from '../types'
import type { StatsConfig, StatItem } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'

function CountUp({ value, duration = 1200 }: { value: string; duration?: number }) {
    const ref = useRef<HTMLSpanElement>(null)
    const isInView = useInView(ref, { once: true })
    const shouldReduce = useReducedMotion()
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10)
    const isNumeric = !isNaN(numericValue) && /\d/.test(value)
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
                setCount(Math.floor(start))
            }
        }, 16)
        return () => clearInterval(timer)
    }, [isInView, isNumeric, numericValue, duration, shouldReduce])

    if (!isNumeric) return <span ref={ref}>{value}</span>

    const formatted = value.replace(/\d+/, String(count))
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

function RowVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}>
            <div className="container mx-auto px-6">
                {headline && (
                    <RichText text={headline} as="h2" className="text-3xl font-bold text-center mb-10" style={{ fontFamily: CSS_VARS.fontHeading }} />
                )}
                <StaggerGrid className="flex flex-col sm:flex-row flex-wrap justify-center gap-8 md:gap-12">
                    {stats.map((stat, i) => (
                        <StaggerItem key={i} className="flex-1 min-w-[140px] text-center">
                            <p
                                className="text-4xl md:text-5xl font-bold mb-2"
                                style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary }}
                                aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}
                            >
                                <StatValue stat={stat} />
                            </p>
                            <p className="text-sm" style={{ color: CSS_VARS.muted }}>{stat.label}</p>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}

function GridVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className="container mx-auto px-6">
                {headline && (
                    <RichText text={headline} as="h2" className="text-3xl font-bold text-center mb-10" style={{ fontFamily: CSS_VARS.fontHeading }} />
                )}
                <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <StaggerItem
                            key={i}
                            className="text-center p-6 transition-shadow hover:shadow-md"
                            style={{
                                background: CSS_VARS.surface,
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                        >
                            <p
                                className="text-4xl font-bold mb-2"
                                style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary }}
                                aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}
                            >
                                <StatValue stat={stat} />
                            </p>
                            <p className="text-sm" style={{ color: CSS_VARS.muted }}>{stat.label}</p>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}

function HighlightVariant({ headline, stats }: { headline?: string; stats: StatItem[] }) {
    return (
        <AnimatedSection
            className="py-16 md:py-20"
            style={{ color: CSS_VARS.text, background: 'rgba(var(--brand-primary-rgb), 0.05)' }}
        >
            <div className="container mx-auto px-6 max-w-3xl">
                {headline && (
                    <RichText text={headline} as="h2" className="text-3xl font-bold text-center mb-10" style={{ fontFamily: CSS_VARS.fontHeading }} />
                )}
                <StaggerGrid className="flex flex-col gap-6">
                    {stats.map((stat, i) => {
                        const numericValue = parseInt(stat.value.replace(/[^0-9]/g, ''), 10)
                        const percentage = !isNaN(numericValue) && numericValue <= 100 ? numericValue : null

                        return (
                            <StaggerItem key={i} className="w-full">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium" style={{ color: CSS_VARS.text }}>
                                        {stat.label}
                                    </span>
                                    <span
                                        className="text-lg font-bold"
                                        style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.primary, fontVariantNumeric: 'tabular-nums' }}
                                        aria-label={`${stat.prefix || ''}${stat.value}${stat.suffix || ''} ${stat.label}`}
                                    >
                                        <StatValue stat={stat} />
                                    </span>
                                </div>
                                <div
                                    className="w-full h-3 overflow-hidden"
                                    style={{ background: 'rgba(var(--brand-primary-rgb), 0.15)', borderRadius: 'var(--radius-full)' }}
                                >
                                    <div
                                        className="h-full transition-all duration-1000 ease-out"
                                        style={{
                                            width: percentage !== null ? `${percentage}%` : '75%',
                                            background: CSS_VARS.primary,
                                            borderRadius: 'var(--radius-full)',
                                        }}
                                    />
                                </div>
                            </StaggerItem>
                        )
                    })}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}

export function StatsBlock({ block }: BlockProps<StatsConfig>) {
    const { headline, stats = [], variant = 'row' } = block

    if (!stats.length) return null

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
