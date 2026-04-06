'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { PricingTableConfig } from './config'

export function PricingTableBlock({ block, theme }: BlockProps<PricingTableConfig>) {
    const { variant = 'columns', headline, subheadline, billingToggle = 'monthly', plans = [] } = block
    const [billing, setBilling] = useState<'monthly' | 'yearly'>(billingToggle)

    const isHorizontal = variant === 'horizontal'

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    {headline && <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline}</h2>}
                    {subheadline && <p className="text-lg opacity-70">{subheadline}</p>}
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-3 mb-14">
                    <span className={`text-sm font-medium ${billing === 'monthly' ? 'opacity-100' : 'opacity-50'}`}>Monthly</span>
                    <button
                        type="button"
                        onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
                        className="relative w-14 h-7 rounded-full transition-colors duration-200"
                        style={{ backgroundColor: billing === 'yearly' ? theme.primaryColor : `rgba(var(--brand-primary-rgb), 0.251)` }}
                        aria-label="Toggle billing period"
                    >
                        <span
                            className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
                            style={{ transform: billing === 'yearly' ? 'translateX(28px)' : 'translateX(0)' }}
                        />
                    </button>
                    <span className={`text-sm font-medium ${billing === 'yearly' ? 'opacity-100' : 'opacity-50'}`}>Yearly</span>
                </div>

                {/* Plans */}
                <div className={isHorizontal ? 'space-y-6 max-w-4xl mx-auto' : `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(plans.length, 3)} gap-8 max-w-6xl mx-auto`}>
                    {plans.map((plan, i) => {
                        const displayPrice = billing === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : plan.price
                        const currency = plan.currency || '$'

                        if (isHorizontal) {
                            return (
                                <div
                                    key={i}
                                    className={`flex flex-col md:flex-row items-start md:items-center gap-6 p-8 rounded-2xl border transition-shadow duration-200 ${plan.popular ? 'shadow-lg' : ''}`}
                                    style={{ borderColor: plan.popular ? theme.primaryColor : `rgba(var(--brand-primary-rgb), 0.125)` }}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold font-heading">{plan.name}</h3>
                                            {plan.popular && (
                                                <span className="text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>Popular</span>
                                            )}
                                        </div>
                                        {plan.description && <p className="opacity-60 text-sm mb-3">{plan.description}</p>}
                                        <div className="flex flex-wrap gap-3">
                                            {plan.features.map((f, j) => (
                                                <span key={j} className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 shrink-0">
                                        <div className="text-right">
                                            <span className="text-3xl font-bold">{currency}{displayPrice}</span>
                                            <span className="text-sm opacity-60">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                                        </div>
                                        <a
                                            href={plan.cta.url}
                                            className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 whitespace-nowrap"
                                            style={plan.popular ? { backgroundColor: 'var(--brand-primary)', color: '#fff' } : { border: `2px solid var(--brand-primary)`, color: 'var(--brand-primary)' }}
                                        >
                                            {plan.cta.label}
                                        </a>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div
                                key={i}
                                className={`relative p-8 rounded-2xl border transition-all duration-200 ${plan.popular ? 'shadow-xl scale-105 z-10' : 'hover:shadow-md'}`}
                                style={{ borderColor: plan.popular ? theme.primaryColor : `rgba(var(--brand-primary-rgb), 0.125)` }}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <span className="text-xs font-bold px-4 py-1.5 rounded-full text-white shadow-md" style={{ backgroundColor: 'var(--brand-primary)' }}>Most Popular</span>
                                    </div>
                                )}
                                <h3 className="text-xl font-bold font-heading mb-2">{plan.name}</h3>
                                {plan.description && <p className="opacity-60 text-sm mb-4">{plan.description}</p>}
                                <div className="mb-6">
                                    <span className="text-4xl font-bold">{currency}{displayPrice}</span>
                                    <span className="text-sm opacity-60">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2 text-sm">
                                            <span style={{ color: 'var(--brand-primary)' }}>✓</span> {f}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={plan.cta.url}
                                    className={`block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${plan.popular ? 'text-white' : 'border'}`}
                                    style={plan.popular ? { backgroundColor: 'var(--brand-primary)' } : { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                                >
                                    {plan.cta.label}
                                </a>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
