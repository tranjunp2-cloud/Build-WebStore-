'use client'

import { useState, useCallback, useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { PricingConfig } from './config'
import { AnimatedSection, StaggerGrid as _StaggerGrid, StaggerItem as _StaggerItem, HoverCard as _HoverCard, staggerContainer, staggerItem } from '../shared/animations'
import { GradientBlob, GridLines } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'
import { useLocalHref } from '@/lib/hooks/use-local-href'

const FALLBACK_PLANS: PricingConfig['plans'] = [
    { name: 'Starter', price: 'RM 99', period: 'mo', features: [{ text: 'Core features', included: true }, { text: 'Email support', included: true }], ctaLabel: 'Get Started', ctaUrl: '/contact' },
    { name: 'Pro', price: 'RM 299', period: 'mo', features: [{ text: 'All Starter features', included: true }, { text: 'Priority support', included: true }, { text: 'Advanced tools', included: true }], ctaLabel: 'Choose Pro', ctaUrl: '/contact', highlighted: true },
    { name: 'Enterprise', price: 'Custom', features: [{ text: 'All Pro features', included: true }, { text: 'Dedicated manager', included: true }], ctaLabel: 'Contact Sales', ctaUrl: '/contact' },
]

void _StaggerGrid
void _StaggerItem
void _HoverCard

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

const GRID_COLS_MD: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
}

function gridColsFor(count: number): string {
    const clamped = Math.min(Math.max(count, 1), 4)
    return GRID_COLS_MD[clamped] || GRID_COLS_MD[3]!
}

type PricingSectionProps = {
    showBlob?: boolean
    children: ReactNode
    decorative?: ReactNode
}

function PricingSection({ showBlob = true, children, decorative }: PricingSectionProps) {
    return (
        <AnimatedSection className="relative overflow-hidden">
            {showBlob && (decorative ?? (
                <GradientBlob color={CSS_VARS.primary} className="top-[10%] right-[-5%]" size={400} opacity={0.06} />
            ))}
            <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="relative z-10">
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

type PriceDisplayProps = {
    price: ReactNode
    period?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
}

const PRICE_SIZE = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
} as const

/** Large price + small period suffix. Used 8 times across variants. */
function PriceDisplay({ price, period, size = 'lg', className = '' }: PriceDisplayProps) {
    return (
        <div className={className}>
            {typeof price === 'string'
                ? <RichText text={price} as="span" className={`${PRICE_SIZE[size]} font-bold`} />
                : <span className={`${PRICE_SIZE[size]} font-bold`}>{price}</span>
            }
            {period && <span className="opacity-50 text-sm">/{period}</span>}
        </div>
    )
}

type PlanCTAProps = {
    href: string
    label: string
    highlighted?: boolean
    fullWidth?: boolean
    className?: string
}

/**
 * Plan CTA button — highlighted (filled brand) vs outline. Used 8+ times.
 * TOUCH_TARGET.min (44px) ensures WCAG 2.5.5 compliance.
 */
function PlanCTA({ href: rawHref, label, highlighted = false, fullWidth = false, className = '' }: PlanCTAProps) {
    const resolveHref = useLocalHref()
    const href = resolveHref(rawHref)
    const widthCls = fullWidth ? 'block w-full' : 'inline-block'
    const baseStyle: CSSProperties = highlighted
        ? { background: 'var(--brand-primary)' }
        : { border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }
    return (
        <a
            href={href}
            className={`${widthCls} px-6 py-3 rounded-xl font-semibold text-sm text-center transition-all duration-200 hover:opacity-90 ${TOUCH_TARGET.min} flex items-center justify-center ${highlighted ? 'text-white' : ''} ${className}`.trim()}
            style={baseStyle}
        >
            <RichText text={label} />
        </a>
    )
}

type FeatureListProps = {
    features: Array<string | { text: string }>
    className?: string
}

/** Checkmark feature list — used in 6 variants. */
function FeatureList({ features, className = 'space-y-3' }: FeatureListProps) {
    return (
        <ul className={className}>
            {features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--brand-primary)' }} aria-hidden="true">&#10003;</span>
                    <RichText text={typeof f === 'string' ? f : f.text} as="span" />
                </li>
            ))}
        </ul>
    )
}

export function PricingBlock({ block, theme }: BlockProps<PricingConfig>) {
    const { headline, subheadline, plans: rawPlans = [], variant = 'cards' } = block
    const plans = rawPlans.length > 0 ? rawPlans : FALLBACK_PLANS

    // ── horizontal variant ────────────────────────────────────────────────
    if (variant === 'horizontal') {
        return (
            <PricingSection>
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
                            className={`flex flex-col md:flex-row items-center gap-6 ${CARD_PADDING.md} rounded-2xl transition-shadow duration-300 hover:shadow-lg`}
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
                                <Heading level={4} className="text-lg">{plan.name}</Heading>
                                {plan.description && <Body size="small" className="opacity-50 mt-1">{plan.description}</Body>}
                            </div>
                            {/* Price */}
                            <PriceDisplay
                                price={plan.price}
                                period={plan.period}
                                size="md"
                                className="text-center md:text-left flex-shrink-0"
                            />
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
                                        <RichText text={typeof f === 'string' ? f : f.text} as="span" />
                                    </span>
                                ))}
                                {plan.features.length > 4 && (
                                    <span className="px-3 py-1 rounded-full text-xs opacity-50">+{plan.features.length - 4} more</span>
                                )}
                            </div>
                            <PlanCTA
                                href={plan.ctaUrl}
                                label={plan.ctaLabel}
                                highlighted={plan.highlighted}
                                className="flex-shrink-0"
                            />
                        </motion.div>
                    ))}
                </motion.div>
            </PricingSection>
        )
    }

    // ── toggle variant ────────────────────────────────────────────────────
    if (variant === 'toggle') {
        return <PricingToggle block={block} theme={theme} />
    }

    // ── tiered variant ────────────────────────────────────────────────────
    if (variant === 'tiered') {
        return (
            <PricingSection>
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
                        const cardPadding = isTop ? 'p-10 shadow-xl' : isMid ? CARD_PADDING.lg + ' shadow-md' : CARD_PADDING.md
                        const headingLevel: 2 | 3 | 4 = isTop ? 2 : isMid ? 3 : 4
                        const priceSize: 'sm' | 'md' | 'xl' = isTop ? 'xl' : isMid ? 'md' : 'sm'
                        return (
                            <motion.div
                                key={i}
                                variants={staggerItem}
                                className={`rounded-2xl transition-shadow duration-300 ${cardPadding}`}
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
                                        <Heading level={headingLevel}>{plan.name}</Heading>
                                        {plan.description && <Body size="small" className="opacity-50 mt-1">{plan.description}</Body>}
                                    </div>
                                    <PriceDisplay
                                        price={plan.price}
                                        period={plan.period}
                                        size={priceSize}
                                        className="flex items-baseline gap-1"
                                    />
                                </div>
                                <FeatureList
                                    features={plan.features}
                                    className={`mt-4 space-y-2 ${isTop ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : ''}`}
                                />
                                <div className="mt-6">
                                    <PlanCTA
                                        href={plan.ctaUrl}
                                        label={plan.ctaLabel}
                                        highlighted={isTop}
                                    />
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            </PricingSection>
        )
    }

    // ── comparison variant ────────────────────────────────────────────────
    if (variant === 'comparison') {
        // Collect all unique features across plans
        // Plan 260415 Lỗi F (P1 SILENT) — features là mix string | { text } object.
        // Trước: Set dedupe by reference + .includes() reference compare → comparison
        // table luôn hiện "—" vì features references khác nhau giữa plans. Fix:
        // normalize to plain string (feature text) rồi dedupe + compare by string.
        const allFeatures = Array.from(
            new Set(
                plans.flatMap(p => p.features.map(f => (typeof f === 'string' ? f : f.text))),
            ),
        )
        return (
            <PricingSection>
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
                                            <div className="font-bold font-heading text-lg"><RichText text={plan.name} as="span" /></div>
                                            <div className="mt-1">
                                                <RichText text={plan.price} as="span" className="text-2xl font-bold" />
                                                {plan.period && <span className="opacity-50 text-xs">/{plan.period}</span>}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Prefer featureMatrix when available; fall back to aggregated plan features */}
                                {(() => {
                                    const rows = block.featureMatrix?.length ? block.featureMatrix : allFeatures.map(text => ({
                                        featureName: text,
                                        values: plans.map(plan => ({ included: plan.features.some(f => (typeof f === 'string' ? f : f.text) === text) })),
                                    }))
                                    if (rows.length === 0) return (
                                        <tr>
                                            <td colSpan={plans.length + 1} className="p-8 text-center text-sm opacity-40">
                                                Add a plan to get started
                                            </td>
                                        </tr>
                                    )
                                    return rows.map((row, fi) => (
                                        <tr
                                            key={fi}
                                            className="border-t"
                                            style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.06)' }}
                                        >
                                            <td className="p-4 text-sm"><RichText text={row.featureName} as="span" /></td>
                                            {plans.map((plan, pi) => (
                                                <td
                                                    key={pi}
                                                    className="p-4 text-center"
                                                    style={plan.highlighted ? { background: 'rgba(var(--brand-primary-rgb), 0.04)' } : {}}
                                                >
                                                    {row.values[pi]?.included ? (
                                                        <span className="text-lg" style={{ color: 'var(--brand-primary)' }}>&#10003;</span>
                                                    ) : (
                                                        <span className="opacity-40" aria-label="not included">&mdash;</span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                })()}
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
                                            <PlanCTA
                                                href={plan.ctaUrl}
                                                label={plan.ctaLabel}
                                                highlighted={plan.highlighted}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
            </PricingSection>
        )
    }

    // ── table variant ────────────────────────────────────────────────────
    if (variant === 'table') {
        // Collect all unique feature texts across plans
        const allFeatureTexts = Array.from(new Set(
            plans.flatMap(p => p.features.map(f => typeof f === 'string' ? f : f.text))
        ))
        const planHasFeature = (plan: typeof plans[number], featureText: string) =>
            plan.features.some(f => (typeof f === 'string' ? f : f.text) === featureText)

        return (
            <PricingSection>
                <SectionHeader headline={headline} subheadline={subheadline} />
                    <div className="overflow-x-auto max-w-5xl mx-auto">
                        <div className="min-w-[600px]">
                            {/* Header row — plan names + prices */}
                            <div
                                className="grid items-end gap-px mb-px"
                                style={{ gridTemplateColumns: `minmax(180px, 1.5fr) repeat(${plans.length}, 1fr)` }}
                            >
                                {/* Corner cell */}
                                <div className="p-4" />
                                {plans.map((plan, i) => (
                                    <div
                                        key={i}
                                        className="p-5 text-center rounded-t-xl"
                                        style={{
                                            background: plan.highlighted
                                                ? 'var(--brand-primary)'
                                                : 'rgba(var(--brand-primary-rgb), 0.06)',
                                            color: plan.highlighted ? '#fff' : 'inherit',
                                        }}
                                    >
                                        {plan.highlighted && (
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-widest mb-2 px-2 py-0.5 rounded-full bg-white/20">
                                                Popular
                                            </span>
                                        )}
                                        <h3 className="text-lg font-bold font-heading"><RichText text={plan.name} as="span" /></h3>
                                        <div className="mt-1">
                                            <RichText text={plan.price} as="span" className="text-2xl font-bold" />
                                            {plan.period && (
                                                <span className={`text-xs ${plan.highlighted ? 'opacity-70' : 'opacity-50'}`}>/{plan.period}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Feature rows — prefer featureMatrix when available; fall back to plan features */}
                            {(() => {
                                const rows = block.featureMatrix?.length ? block.featureMatrix : allFeatureTexts.map(text => ({
                                    featureName: text,
                                    values: plans.map(plan => ({ included: planHasFeature(plan, text) })),
                                }))
                                if (rows.length === 0) return (
                                    <div
                                        className="p-8 text-center text-sm opacity-40"
                                        style={{ borderTop: '1px solid rgba(var(--brand-primary-rgb), 0.06)' }}
                                    >
                                        Add a plan to get started
                                    </div>
                                )
                                return rows.map((row, fi) => (
                                    <div
                                        key={fi}
                                        className="grid items-center gap-px"
                                        style={{
                                            gridTemplateColumns: `minmax(180px, 1.5fr) repeat(${plans.length}, 1fr)`,
                                            borderTop: '1px solid rgba(var(--brand-primary-rgb), 0.06)',
                                        }}
                                    >
                                        <div className="p-4 text-sm opacity-80"><RichText text={row.featureName} as="span" /></div>
                                        {plans.map((plan, pi) => (
                                            <div
                                                key={pi}
                                                className="p-4 text-center"
                                                style={{
                                                    background: plan.highlighted
                                                        ? 'rgba(var(--brand-primary-rgb), 0.04)'
                                                        : 'transparent',
                                                }}
                                            >
                                                {row.values[pi]?.included ? (
                                                    <span className="text-lg" style={{ color: 'var(--brand-primary)' }}>&#10003;</span>
                                                ) : (
                                                    <span className="opacity-20">&times;</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))
                            })()}

                            {/* CTA row */}
                            <div
                                className="grid items-center gap-px mt-px"
                                style={{
                                    gridTemplateColumns: `minmax(180px, 1.5fr) repeat(${plans.length}, 1fr)`,
                                    borderTop: '1px solid rgba(var(--brand-primary-rgb), 0.06)',
                                }}
                            >
                                <div className="p-4" />
                                {plans.map((plan, i) => (
                                    <div
                                        key={i}
                                        className="p-5 text-center rounded-b-xl"
                                        style={{
                                            background: plan.highlighted
                                                ? 'rgba(var(--brand-primary-rgb), 0.04)'
                                                : 'transparent',
                                        }}
                                    >
                                        <PlanCTA
                                            href={plan.ctaUrl}
                                            label={plan.ctaLabel}
                                            highlighted={plan.highlighted}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
            </PricingSection>
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
        <PricingSection decorative={<GridLines color={CSS_VARS.primary} spacing={56} opacity={0.04} />}>
            <SectionHeader headline={headline} subheadline={subheadline} />
            <div className={`grid grid-cols-1 ${gridColsFor(Math.min(plans.length, 3))} gap-8 max-w-5xl mx-auto`}>
                {plans.map((plan, i) => (
                    /* Plan 260415 Lỗi L — scale-105 mobile overlap. md:scale-105 chỉ desktop */
                    <div key={i} className={`${CARD_PADDING.lg} rounded-2xl border transition-transform ${plan.highlighted ? 'ring-2 md:scale-105' : ''}`}
                        style={{ borderColor: plan.highlighted ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.12)', ...(plan.highlighted ? { boxShadow: `0 0 0 2px var(--brand-primary)` } : {}) }}>
                        <Heading level={3} className="mb-2">{plan.name}</Heading>
                        {plan.description && <Body size="small" className="opacity-60 mb-4">{plan.description}</Body>}
                        <PriceDisplay
                            price={plan.price}
                            period={plan.period}
                            size="lg"
                            className="mb-6"
                        />
                        <FeatureList features={plan.features} className="space-y-3 mb-8" />
                        <PlanCTA
                            href={plan.ctaUrl}
                            label={plan.ctaLabel}
                            highlighted={plan.highlighted}
                            fullWidth
                        />
                    </div>
                ))}
            </div>
        </PricingSection>
    )
}

// ── Section Header helper ─────────────────────────────────────────────────
// Uses RichText for headline (inline HTML support) wrapped in Heading classes.
// Plain Body for subheadline.
function SectionHeader({ headline, subheadline }: { headline?: string; subheadline?: string }) {
    return (
        <div className="text-center max-w-2xl mx-auto mb-16">
            {headline && (
                <Heading level={2} className="mb-4">
                    <RichText text={headline} as="span" />
                </Heading>
            )}
            {subheadline && (
                <Body size="lg" className="opacity-70">
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
        </div>
    )
}

// ── Toggle sub-component ──────────────────────────────────────────────────
function PricingToggle({ block, theme: _theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    void _theme
    const { headline, subheadline, plans = [], yearlyDiscount = 0, billingCycle1 = 'Monthly', billingCycle2 = 'Yearly' } = block
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
        <PricingSection>
            <SectionHeader headline={headline} subheadline={subheadline} />

            {/* Toggle switch — visual 28px wrapped in 44px hit area for WCAG */}
            <div className="flex items-center justify-center gap-4 mb-12">
                <span className={`text-sm font-medium transition-opacity ${!isYearly ? 'opacity-100' : 'opacity-50'}`}>{billingCycle1}</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isYearly}
                    onClick={() => setIsYearly(!isYearly)}
                    className={`${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
                >
                    <span
                        className="relative w-14 h-7 rounded-full transition-colors duration-200 block"
                        style={{ background: isYearly ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)' }}
                    >
                        <motion.div
                            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow"
                            animate={{ x: isYearly ? 28 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </span>
                </button>
                    <span className={`text-sm font-medium transition-opacity ${isYearly ? 'opacity-100' : 'opacity-50'}`}>
                        {billingCycle2}
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
            <div className={`grid grid-cols-1 ${gridColsFor(Math.min(plans.length, 3))} gap-8 max-w-5xl mx-auto`}>
                {plans.map((plan, i) => (
                    <motion.div
                        key={i}
                        layout
                        className={`${CARD_PADDING.lg} rounded-2xl border transition-transform ${plan.highlighted ? 'md:scale-105' : ''}`}
                        style={{
                            borderColor: plan.highlighted ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.12)',
                            ...(plan.highlighted ? { boxShadow: '0 0 0 2px var(--brand-primary)' } : {}),
                        }}
                    >
                        <Heading level={3} className="mb-2">{plan.name}</Heading>
                        {plan.description && <Body size="small" className="opacity-60 mb-4">{plan.description}</Body>}
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
                                    <RichText text={getPrice(plan.price)} as="span" />
                                </motion.span>
                            </AnimatePresence>
                            <span className="opacity-60 text-sm">/{isYearly ? 'year' : plan.period || 'month'}</span>
                        </div>
                        <FeatureList features={plan.features} className="space-y-3 mb-8" />
                        <PlanCTA
                            href={plan.ctaUrl}
                            label={plan.ctaLabel}
                            highlighted={plan.highlighted}
                            fullWidth
                        />
                    </motion.div>
                ))}
            </div>
        </PricingSection>
    )
}

// ── Minimal sub-component (expandable accordion) ──────────────────────────
function PricingMinimal({ block, theme: _theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    void _theme
    const { headline, subheadline, plans = [] } = block
    const [expandedPlan, setExpandedPlan] = useState<number | null>(null)

    return (
        <PricingSection>
            <SectionHeader headline={headline} subheadline={subheadline} />
            <div className={`grid grid-cols-1 ${gridColsFor(Math.min(plans.length, 3))} gap-10 max-w-5xl mx-auto`}>
                {plans.map((plan, i) => (
                    <div
                        key={i}
                        className="text-center"
                    >
                        <Heading level={3} className="mb-2">{plan.name}</Heading>
                        <PriceDisplay
                            price={plan.price}
                            period={plan.period}
                            size="xl"
                            className="mb-4"
                        />
                        {plan.description && <Body size="small" className="opacity-50 mb-6 leading-relaxed">{plan.description}</Body>}

                        <PlanCTA
                            href={plan.ctaUrl}
                            label={plan.ctaLabel}
                            highlighted={plan.highlighted}
                            fullWidth
                            className="mb-4"
                        />

                        {/* Expandable features — has 44px touch target via TOUCH_TARGET.min */}
                        <button
                            type="button"
                            onClick={() => setExpandedPlan(expandedPlan === i ? null : i)}
                            className={`text-sm font-medium opacity-60 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} inline-flex items-center justify-center px-3`}
                            style={{ color: 'var(--brand-primary)' }}
                            aria-expanded={expandedPlan === i}
                        >
                            {expandedPlan === i ? 'Hide features' : 'View features'}
                            <span className="ml-1 inline-block transition-transform" style={{ transform: expandedPlan === i ? 'rotate(180deg)' : '' }} aria-hidden="true">
                                &#9660;
                            </span>
                        </button>

                        <AnimatePresence>
                            {expandedPlan === i && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden mt-4 text-left"
                                >
                                    <FeatureList features={plan.features} className="space-y-2" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </PricingSection>
    )
}

// ── Slider sub-component ──────────────────────────────────────────────────
function PricingSlider({ block, theme: _theme }: { block: BlockProps<PricingConfig>['block']; theme: BlockProps<PricingConfig>['theme'] }) {
    void _theme
    const { headline, subheadline, plans = [] } = block
    const [slider, setSlider] = useState<{ index: number; direction: 1 | -1 }>({ index: 0, direction: 1 })
    const { index: currentIndex, direction } = slider
    const touchStartX = useRef<number | null>(null)

    const goTo = useCallback((idx: number, dir: 1 | -1 = 1) => {
        const newIndex = idx < 0 ? plans.length - 1 : idx >= plans.length ? 0 : idx
        setSlider({ index: newIndex, direction: dir })
    }, [plans.length])

    if (plans.length === 0) return null
    const plan = plans[currentIndex]

    return (
        <PricingSection>
            <SectionHeader headline={headline} subheadline={subheadline} />

            <div className="relative max-w-lg mx-auto">
                {/* Nav arrows — TOUCH_TARGET.min (was 40px ❌, now 44px ✅) */}
                {plans.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => goTo(currentIndex - 1, -1)}
                            className={`absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-20 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full border transition-opacity duration-200 hover:opacity-80`}
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
                            type="button"
                            onClick={() => goTo(currentIndex + 1, 1)}
                            className={`absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-20 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full border transition-opacity duration-200 hover:opacity-80`}
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
                        initial={{ opacity: 0, x: direction * 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -60 }}
                        transition={{ duration: 0.3 }}
                        className="p-10 rounded-2xl text-center"
                        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
                        onTouchEnd={(e) => {
                            if (touchStartX.current === null) return
                            const delta = touchStartX.current - e.changedTouches[0].clientX
                            if (Math.abs(delta) > 50) {
                                const dir = delta > 0 ? 1 : -1
                                goTo(currentIndex + dir, dir)
                            }
                            touchStartX.current = null
                        }}
                        style={{
                            border: plan.highlighted
                                ? '2px solid var(--brand-primary)'
                                : '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                            background: plan.highlighted
                                ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.06), transparent)'
                                : 'transparent',
                        }}
                    >
                        <Heading level={3} className="mb-2">{plan.name}</Heading>
                        {plan.description && <Body size="small" className="opacity-50 mb-4">{plan.description}</Body>}
                        <PriceDisplay
                            price={plan.price}
                            period={plan.period}
                            size="xl"
                            className="mb-6"
                        />
                        <FeatureList features={plan.features} className="space-y-3 mb-8 text-left max-w-xs mx-auto" />
                        <PlanCTA
                            href={plan.ctaUrl}
                            label={plan.ctaLabel}
                            highlighted={plan.highlighted}
                            fullWidth
                            className="max-w-xs mx-auto"
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Dot indicators — 10px visual in 44px hit area */}
                {plans.length > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        {plans.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => { if (i !== currentIndex) goTo(i, i > currentIndex ? 1 : -1) }}
                                className={`${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center rounded-full transition-all duration-200`}
                                aria-label={`View plan ${i + 1}`}
                                aria-current={i === currentIndex}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                                    style={{
                                        background: i === currentIndex ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </PricingSection>
    )
}
