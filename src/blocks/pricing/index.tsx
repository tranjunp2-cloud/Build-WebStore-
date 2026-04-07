'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { PricingConfig } from './config'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard, staggerContainer, staggerItem } from '../shared/animations'
import { GradientBlob } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'

export function PricingBlock({ block, theme }: BlockProps<PricingConfig>) {
    const { headline, subheadline, plans = [], variant = 'cards' } = block

    // ── horizontal variant ────────────────────────────────────────────────
    if (variant === 'horizontal') {
        return (
            <AnimatedSection className="py-24 relative overflow-hidden">
                <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    <SectionHeader headline={headline} subheadline={subheadline} />
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-50px' }}
                        variants={staggerContainer}
                        className="flex flex-col gap-4 max-w-5xl mx-auto"
                    >
                        {plans.map((plan, i) => (
                            <motion.div
                                key={i}
                                variants={staggerItem}
                                className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl transition-shadow duration-300 hover:shadow-lg"
                                style={{
                                    border: plan.highlighted
                                        ? '2px solid var(--brand-primary)'
                                        : '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                    borderLeftWidth: plan.highlighted ? 4 : undefined,
                                    background: plan.highlighted
                                        ? 'rgba(var(--brand-primary-rgb), 0.03)'
                                        : 'transparent',
                                }}
                            >
                                {/* Name */}
                                <div className="flex-1 min-w-[120px]">
                                    <h3 className="text-lg font-bold font-heading">{plan.name}</h3>
                                    {plan.description && <p className="text-sm opacity-50 mt-1">{plan.description}</p>}
                                </div>
                                {/* Price */}
                                <div className="text-center md:text-left flex-shrink-0">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    {plan.period && <span className="opacity-50 text-sm">/{plan.period}</span>}
                                </div>
                                {/* Features as chips */}
                                <div className="flex flex-wrap gap-2 flex-1 justify-center md:justify-start">
                                    {plan.features.slice(0, 4).map((f, j) => (
                                        <span
                                            key={j}
                                            className="px-3 py-1 rounded-full text-xs"
                                            style={{
                                                background: 'rgba(var(--brand-primary-rgb), 0.08)',
                                                color: 'var(--brand-primary)',
                                            }}
                                        >
                                            {typeof f === 'string' ? f : f.text}
                                        </span>
                                    ))}
                                    {plan.features.length > 4 && (
                                        <span className="px-3 py-1 rounded-full text-xs opacity-50">+{plan.features.length - 4} more</span>
                                    )}
                                </div>
                                {/* CTA */}
                                <a
                                    href={plan.ctaUrl}
                                    className={`flex-shrink-0 px-6 py-2.5 rounded-xl font-semibold text-sm text-center transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : ''}`}
                                    style={plan.highlighted
                                        ? { background: 'var(--brand-primary)' }
                                        : { border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }
                                    }
                                >
                                    {plan.ctaLabel}
                                </a>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </AnimatedSection>
        )
    }

    // ── toggle variant ────────────────────────────────────────────────────
    if (variant === 'toggle') {
        return <PricingToggle block={block} theme={theme} />
    }

    // ── tiered variant ────────────────────────────────────────────────────
    if (variant === 'tiered') {
        return (
            <AnimatedSection className="py-24 relative overflow-hidden">
                <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    <SectionHeader headline={headline} subheadline={subheadline} />
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-50px' }}
                        variants={staggerContainer}
                        className="flex flex-col gap-6 max-w-3xl mx-auto"
                    >
                        {plans.map((plan, i) => {
                            // Increasing prominence: first=minimal, middle=elevated, last=max
                            const isTop = i === plans.length - 1 || plan.highlighted
                            const isMid = !isTop && i > 0
                            return (
                                <motion.div
                                    key={i}
                                    variants={staggerItem}
                                    className={`rounded-2xl transition-shadow duration-300 ${isTop ? 'p-10 shadow-xl' : isMid ? 'p-8 shadow-md' : 'p-6'}`}
                                    style={{
                                        border: isTop
                                            ? '2px solid var(--brand-primary)'
                                            : '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                        background: isTop
                                            ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.08), rgba(var(--brand-primary-rgb), 0.02))'
                                            : isMid
                                                ? 'rgba(var(--brand-primary-rgb), 0.02)'
                                                : 'transparent',
                                    }}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div>
                                            <h3 className={`font-bold font-heading ${isTop ? 'text-2xl' : isMid ? 'text-xl' : 'text-lg'}`}>{plan.name}</h3>
                                            {plan.description && <p className="text-sm opacity-50 mt-1">{plan.description}</p>}
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`font-bold ${isTop ? 'text-4xl' : isMid ? 'text-3xl' : 'text-2xl'}`}>{plan.price}</span>
                                            {plan.period && <span className="opacity-50 text-sm">/{plan.period}</span>}
                                        </div>
                                    </div>
                                    <ul className={`mt-4 space-y-2 ${isTop ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : ''}`}>
                                        {plan.features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm">
                                                <span style={{ color: 'var(--brand-primary)' }}>&#10003;</span> {typeof f === 'string' ? f : f.text}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-6">
                                        <a
                                            href={plan.ctaUrl}
                                            className={`inline-block px-8 py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${isTop ? 'text-white' : ''}`}
                                            style={isTop
                                                ? { background: 'var(--brand-primary)' }
                                                : { border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }
                                            }
                                        >
                                            {plan.ctaLabel}
                                        </a>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                </div>
            </AnimatedSection>
        )
    }

    // ── comparison variant ────────────────────────────────────────────────
    if (variant === 'comparison') {
        // Collect all unique features across plans
        const allFeatures = Array.from(new Set(plans.flatMap(p => p.features)))
        return (
            <AnimatedSection className="py-24 relative overflow-hidden">
                <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    <SectionHeader headline={headline} subheadline={subheadline} />
                    <div className="overflow-x-auto max-w-5xl mx-auto">
                        <table className="w-full border-collapse min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="text-left p-4 text-sm font-medium opacity-50">Features</th>
                                    {plans.map((plan, i) => (
                                        <th
                                            key={i}
                                            className="p-4 text-center min-w-[140px]"
                                            style={plan.highlighted ? {
                                                background: 'rgba(var(--brand-primary-rgb), 0.08)',
                                                borderTopLeftRadius: 12,
                                                borderTopRightRadius: 12,
                                            } : {}}
                                        >
                                            <div className="font-bold font-heading text-lg">{plan.name}</div>
                                            <div className="mt-1">
                                                <span className="text-2xl font-bold">{plan.price}</span>
                                                {plan.period && <span className="opacity-50 text-xs">/{plan.period}</span>}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {allFeatures.map((feature, fi) => (
                                    <tr
                                        key={fi}
                                        className="border-t"
                                        style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.06)' }}
                                    >
                                        <td className="p-4 text-sm">{typeof feature === 'string' ? feature : feature.text}</td>
                                        {plans.map((plan, pi) => (
                                            <td
                                                key={pi}
                                                className="p-4 text-center"
                                                style={plan.highlighted ? { background: 'rgba(var(--brand-primary-rgb), 0.04)' } : {}}
                                            >
                                                {plan.features.includes(feature) ? (
                                                    <span className="text-lg" style={{ color: 'var(--brand-primary)' }}>&#10003;</span>
                                                ) : (
                                                    <span className="opacity-20">&mdash;</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="p-4" />
                                    {plans.map((plan, i) => (
                                        <td key={i} className="p-4 text-center"
                                            style={plan.highlighted ? {
                                                background: 'rgba(var(--brand-primary-rgb), 0.04)',
                                                borderBottomLeftRadius: 12,
                                                borderBottomRightRadius: 12,
                                            } : {}}
                                        >
                                            <a
                                                href={plan.ctaUrl}
                                                className={`inline-block px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : ''}`}
                                                style={plan.highlighted
                                                    ? { background: 'var(--brand-primary)' }
                                                    : { border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }
                                                }
                                            >
                                                {plan.ctaLabel}
                                            </a>
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // ── minimal variant ───────────────────────────────────────────────────
    if (variant === 'minimal') {
        return <PricingMinimal block={block} theme={theme} />
    }

    // ── slider variant ────────────────────────────────────────────────────
    if (variant === 'slider') {
        return <PricingSlider block={block} theme={theme} />
    }

    // ── Default: cards variant ────────────────────────────────────────────
    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                <SectionHeader headline={headline} subheadline={subheadline} />
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(plans.length, 3)} gap-8 max-w-5xl mx-auto`}>
                    {plans.map((plan, i) => (
                        <div key={i} className={`p-8 rounded-2xl border ${plan.highlighted ? 'ring-2 scale-105' : ''}`}
                            style={{ borderColor: plan.highlighted ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.12)', ...(plan.highlighted ? { boxShadow: `0 0 0 2px var(--brand-primary)` } : {}) }}>
                            <h3 className="text-xl font-bold font-heading mb-2">{plan.name}</h3>
                            {plan.description && <p className="opacity-60 text-sm mb-4">{plan.description}</p>}
                            <div className="mb-6">
                                <span className="text-4xl font-bold">{plan.price}</span>
                                {plan.period && <span className="opacity-60 text-sm">/{plan.period}</span>}
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-sm">
                                        <span style={{ color: 'var(--brand-primary)' }}>&#10003;</span> {typeof f === 'string' ? f : f.text}
                                    </li>
                                ))}
                            </ul>
                            <a href={plan.ctaUrl}
                                className={`block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : 'border'}`}
                                style={plan.highlighted
                                    ? { background: 'var(--brand-primary)' }
                                    : { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }
                                }>
                                {plan.ctaLabel}
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Section Header helper ─────────────────────────────────────────────────
function SectionHeader({ headline, subheadline }: { headline?: string; subheadline?: string }) {
    return (
        <div className="text-center max-w-2xl mx-auto mb-16">
            {headline && <h2 className="text-4xl font-bold font-heading mb-4">{headline}</h2>}
            {subheadline && <p className="text-lg opacity-70">{subheadline}</p>}
        </div>
    )
}

// ── Toggle sub-component ──────────────────────────────────────────────────
function PricingToggle({ block, theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    const { headline, subheadline, plans = [], yearlyDiscount = 20 } = block
    const [isYearly, setIsYearly] = useState(false)

    const getPrice = useCallback((priceStr: string) => {
        // Try to parse numeric value to apply discount
        const match = priceStr.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/)
        if (!match || !isYearly) return priceStr
        const prefix = match[1]
        const num = parseFloat(match[2])
        const suffix = match[3]
        const discounted = Math.round(num * (1 - yearlyDiscount / 100))
        return `${prefix}${discounted}${suffix}`
    }, [isYearly, yearlyDiscount])

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader headline={headline} subheadline={subheadline} />

                {/* Toggle switch */}
                <div className="flex items-center justify-center gap-4 mb-12">
                    <span className={`text-sm font-medium transition-opacity ${!isYearly ? 'opacity-100' : 'opacity-50'}`}>Monthly</span>
                    <button
                        role="switch"
                        aria-checked={isYearly}
                        onClick={() => setIsYearly(!isYearly)}
                        className="relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                            background: isYearly ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                        }}
                    >
                        <motion.div
                            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow"
                            animate={{ x: isYearly ? 28 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </button>
                    <span className={`text-sm font-medium transition-opacity ${isYearly ? 'opacity-100' : 'opacity-50'}`}>
                        Yearly
                        {yearlyDiscount > 0 && (
                            <span
                                className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: 'rgba(var(--brand-primary-rgb), 0.12)', color: 'var(--brand-primary)' }}
                            >
                                -{yearlyDiscount}%
                            </span>
                        )}
                    </span>
                </div>

                {/* Plan cards */}
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(plans.length, 3)} gap-8 max-w-5xl mx-auto`}>
                    {plans.map((plan, i) => (
                        <motion.div
                            key={i}
                            layout
                            className={`p-8 rounded-2xl border ${plan.highlighted ? 'scale-105' : ''}`}
                            style={{
                                borderColor: plan.highlighted ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.12)',
                                ...(plan.highlighted ? { boxShadow: '0 0 0 2px var(--brand-primary)' } : {}),
                            }}
                        >
                            <h3 className="text-xl font-bold font-heading mb-2">{plan.name}</h3>
                            {plan.description && <p className="opacity-60 text-sm mb-4">{plan.description}</p>}
                            <div className="mb-6">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={isYearly ? 'yearly' : 'monthly'}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-4xl font-bold inline-block"
                                    >
                                        {getPrice(plan.price)}
                                    </motion.span>
                                </AnimatePresence>
                                <span className="opacity-60 text-sm">/{isYearly ? 'year' : plan.period || 'month'}</span>
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-sm">
                                        <span style={{ color: 'var(--brand-primary)' }}>&#10003;</span> {typeof f === 'string' ? f : f.text}
                                    </li>
                                ))}
                            </ul>
                            <a
                                href={plan.ctaUrl}
                                className={`block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : 'border'}`}
                                style={plan.highlighted
                                    ? { background: 'var(--brand-primary)' }
                                    : { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }
                                }
                            >
                                {plan.ctaLabel}
                            </a>
                        </motion.div>
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Minimal sub-component (expandable accordion) ──────────────────────────
function PricingMinimal({ block, theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    const { headline, subheadline, plans = [] } = block
    const [expandedPlan, setExpandedPlan] = useState<number | null>(null)

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader headline={headline} subheadline={subheadline} />
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(plans.length, 3)} gap-10 max-w-5xl mx-auto`}>
                    {plans.map((plan, i) => (
                        <div
                            key={i}
                            className="text-center"
                        >
                            <h3 className="text-xl font-bold font-heading mb-2">{plan.name}</h3>
                            <div className="mb-4">
                                <span className="text-5xl font-bold">{plan.price}</span>
                                {plan.period && <span className="opacity-50 text-sm">/{plan.period}</span>}
                            </div>
                            {plan.description && <p className="opacity-50 text-sm mb-6 leading-relaxed">{plan.description}</p>}

                            <a
                                href={plan.ctaUrl}
                                className={`inline-block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 mb-4 ${plan.highlighted ? 'text-white' : 'border'}`}
                                style={plan.highlighted
                                    ? { background: 'var(--brand-primary)' }
                                    : { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }
                                }
                            >
                                {plan.ctaLabel}
                            </a>

                            {/* Expandable features */}
                            <button
                                onClick={() => setExpandedPlan(expandedPlan === i ? null : i)}
                                className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--brand-primary)' }}
                            >
                                {expandedPlan === i ? 'Hide features' : 'View features'}
                                <span className="ml-1 inline-block transition-transform" style={{ transform: expandedPlan === i ? 'rotate(180deg)' : '' }}>
                                    &#9660;
                                </span>
                            </button>

                            <AnimatePresence>
                                {expandedPlan === i && (
                                    <motion.ul
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden mt-4 space-y-2 text-left"
                                    >
                                        {plan.features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm py-1">
                                                <span style={{ color: 'var(--brand-primary)' }}>&#10003;</span> {typeof f === 'string' ? f : f.text}
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Slider sub-component ──────────────────────────────────────────────────
function PricingSlider({ block, theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    const { headline, subheadline, plans = [] } = block
    const [currentIndex, setCurrentIndex] = useState(0)

    const goTo = useCallback((idx: number) => {
        if (idx < 0) setCurrentIndex(plans.length - 1)
        else if (idx >= plans.length) setCurrentIndex(0)
        else setCurrentIndex(idx)
    }, [plans.length])

    if (plans.length === 0) return null
    const plan = plans[currentIndex]

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader headline={headline} subheadline={subheadline} />

                <div className="relative max-w-lg mx-auto">
                    {/* Nav arrows */}
                    {plans.length > 1 && (
                        <>
                            <button
                                onClick={() => goTo(currentIndex - 1)}
                                className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border transition-opacity duration-200 hover:opacity-80"
                                style={{
                                    background: 'var(--surface)',
                                    borderColor: 'rgba(var(--brand-primary-rgb), 0.2)',
                                    color: 'var(--brand-primary)',
                                }}
                                aria-label="Previous plan"
                            >
                                &#8592;
                            </button>
                            <button
                                onClick={() => goTo(currentIndex + 1)}
                                className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border transition-opacity duration-200 hover:opacity-80"
                                style={{
                                    background: 'var(--surface)',
                                    borderColor: 'rgba(var(--brand-primary-rgb), 0.2)',
                                    color: 'var(--brand-primary)',
                                }}
                                aria-label="Next plan"
                            >
                                &#8594;
                            </button>
                        </>
                    )}

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -60 }}
                            transition={{ duration: 0.3 }}
                            className="p-10 rounded-2xl text-center"
                            style={{
                                border: plan.highlighted
                                    ? '2px solid var(--brand-primary)'
                                    : '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                                background: plan.highlighted
                                    ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.06), transparent)'
                                    : 'transparent',
                            }}
                        >
                            <h3 className="text-2xl font-bold font-heading mb-2">{plan.name}</h3>
                            {plan.description && <p className="opacity-50 text-sm mb-4">{plan.description}</p>}
                            <div className="mb-6">
                                <span className="text-5xl font-bold">{plan.price}</span>
                                {plan.period && <span className="opacity-50 text-sm">/{plan.period}</span>}
                            </div>
                            <ul className="space-y-3 mb-8 text-left max-w-xs mx-auto">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-sm">
                                        <span style={{ color: 'var(--brand-primary)' }}>&#10003;</span> {typeof f === 'string' ? f : f.text}
                                    </li>
                                ))}
                            </ul>
                            <a
                                href={plan.ctaUrl}
                                className={`inline-block w-full max-w-xs py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : 'border'}`}
                                style={plan.highlighted
                                    ? { background: 'var(--brand-primary)' }
                                    : { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }
                                }
                            >
                                {plan.ctaLabel}
                            </a>
                        </motion.div>
                    </AnimatePresence>

                    {/* Dot indicators */}
                    {plans.length > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            {plans.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentIndex(i)}
                                    className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                                    style={{
                                        background: i === currentIndex ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                                    }}
                                    aria-label={`View plan ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
