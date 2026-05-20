'use client'

import { useState, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { PricingTableConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'

const PT_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function PricingTableSection({ children }: { children: ReactNode }) {
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={PT_CONTAINER}>{children}</div>
        </AnimatedSection>
    )
}

type BillingToggleProps = {
    billing: 'monthly' | 'yearly'
    onChange: (b: 'monthly' | 'yearly') => void
}

function BillingToggle({ billing, onChange }: BillingToggleProps) {
    return (
        <div className="flex items-center justify-center gap-3 mb-14">
            <Caption className={`font-medium ${billing === 'monthly' ? 'opacity-100' : 'opacity-50'}`}>Monthly</Caption>
            <button
                type="button"
                onClick={() => onChange(billing === 'monthly' ? 'yearly' : 'monthly')}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${TOUCH_TARGET.min} min-w-[44px]`}
                style={{ backgroundColor: billing === 'yearly' ? CSS_VARS.primary : `rgba(var(--brand-primary-rgb), 0.251)` }}
                aria-label="Toggle billing period"
            >
                <span
                    className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
                    style={{ transform: billing === 'yearly' ? 'translateX(28px)' : 'translateX(0)' }}
                />
            </button>
            <Caption className={`font-medium ${billing === 'yearly' ? 'opacity-100' : 'opacity-50'}`}>Yearly</Caption>
        </div>
    )
}

type PlanCTAProps = {
    href: string
    label: string
    highlighted?: boolean
    fullWidth?: boolean
    extraClassName?: string
}

function PlanCTA({ href, label, highlighted = false, fullWidth = false, extraClassName = '' }: PlanCTAProps) {
    const widthCls = fullWidth ? 'block w-full' : 'inline-flex'
    return (
        <a
            href={href}
            className={`${widthCls} items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm text-center transition-all duration-200 hover:opacity-90 whitespace-nowrap ${TOUCH_TARGET.min} ${highlighted ? 'text-white' : ''} ${extraClassName}`.trim()}
            style={highlighted ? { backgroundColor: 'var(--brand-primary)' } : { border: `2px solid var(--brand-primary)`, color: 'var(--brand-primary)' }}
        >
            {label}
        </a>
    )
}

// Payload stores features as textarea (comma or newline-separated); AI path provides string[]. Normalize both.
const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? v.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []

export function PricingTableBlock({ block }: BlockProps<PricingTableConfig>) {
    const { variant = 'columns', headline, subheadline, billingToggle = 'monthly', plans = [] } = block
    const [billing, setBilling] = useState<'monthly' | 'yearly'>(billingToggle)

    const isHorizontal = variant === 'horizontal'

    return (
        <PricingTableSection>
            <div className="text-center max-w-2xl mx-auto mb-12">
                {headline && <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />}
                {subheadline && <RichText text={subheadline} as="p" className="text-lg opacity-70" />}
            </div>

            <BillingToggle billing={billing} onChange={setBilling} />

            {/* Plans */}
            <div className={isHorizontal ? 'space-y-6 max-w-4xl mx-auto' : `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(plans.length, 3)} gap-8 max-w-6xl mx-auto`}>
                {plans.map((plan, i) => {
                    const displayPrice = billing === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : plan.price
                    const currency = plan.currency || '$'

                    if (isHorizontal) {
                        return (
                            <div
                                key={i}
                                className={`flex flex-col md:flex-row items-start md:items-center gap-6 ${CARD_PADDING.lg} rounded-2xl border transition-shadow duration-200 ${plan.popular ? 'shadow-lg' : ''}`}
                                style={{ borderColor: plan.popular ? CSS_VARS.primary : `rgba(var(--brand-primary-rgb), 0.125)` }}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Heading level={3}>{plan.name}</Heading>
                                        {plan.popular && (
                                            <Caption className="font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>Popular</Caption>
                                        )}
                                    </div>
                                    {plan.description && <Body size="small" className="opacity-60 mb-3">{plan.description}</Body>}
                                    <div className="flex flex-wrap gap-3">
                                        {toStringArray(plan.features).map((f, j) => (
                                            <Caption key={j} className="px-3 py-1 rounded-full" style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>{f}</Caption>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="text-right">
                                        <span className="text-3xl font-bold">{currency}{displayPrice}</span>
                                        <span className="text-sm opacity-60">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                                    </div>
                                    <PlanCTA href={plan.cta?.url ?? '#'} label={plan.cta?.label ?? 'Get Started'} highlighted={plan.popular} />
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div
                            key={i}
                            className={`relative ${CARD_PADDING.lg} rounded-2xl border transition-all duration-200 ${plan.popular ? 'shadow-xl scale-105 z-10' : 'hover:shadow-md'}`}
                            style={{ borderColor: plan.popular ? CSS_VARS.primary : `rgba(var(--brand-primary-rgb), 0.125)` }}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <Caption className="font-bold px-4 py-1.5 rounded-full text-white shadow-md" style={{ backgroundColor: 'var(--brand-primary)' }}>Most Popular</Caption>
                                </div>
                            )}
                            <Heading level={3} className="mb-2">{plan.name}</Heading>
                            {plan.description && <Body size="small" className="opacity-60 mb-4">{plan.description}</Body>}
                            <div className="mb-6">
                                <span className="text-4xl font-bold">{currency}{displayPrice}</span>
                                <span className="text-sm opacity-60">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                            </div>
                            <ul className="space-y-3 mb-8">
                                {toStringArray(plan.features).map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-sm">
                                        <span style={{ color: 'var(--brand-primary)' }}>✓</span>
                                        <RichText text={f} as="span" />
                                    </li>
                                ))}
                            </ul>
                            <PlanCTA href={plan.cta?.url ?? '#'} label={plan.cta?.label ?? 'Get Started'} highlighted={plan.popular} fullWidth />
                        </div>
                    )
                })}
            </div>
        </PricingTableSection>
    )
}
