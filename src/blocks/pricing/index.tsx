import type { BlockProps } from '../types'
import type { PricingConfig } from './config'

export function PricingBlock({ block, theme }: BlockProps<PricingConfig>) {
    const { headline, subheadline, plans = [] } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {headline && <h2 className="text-4xl font-bold font-heading mb-4">{headline}</h2>}
                    {subheadline && <p className="text-lg opacity-70">{subheadline}</p>}
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(plans.length, 3)} gap-8 max-w-5xl mx-auto`}>
                    {plans.map((plan, i) => (
                        <div key={i} className={`p-8 rounded-2xl border ${plan.highlighted ? 'ring-2 scale-105' : ''}`}
                            style={{ borderColor: `${theme.primaryColor}${plan.highlighted ? '' : '20'}`, ...(plan.highlighted ? { ringColor: theme.primaryColor } : {}) }}>
                            <h3 className="text-xl font-bold font-heading mb-2">{plan.name}</h3>
                            {plan.description && <p className="opacity-60 text-sm mb-4">{plan.description}</p>}
                            <div className="mb-6">
                                <span className="text-4xl font-bold">{plan.price}</span>
                                {plan.period && <span className="opacity-60 text-sm">/{plan.period}</span>}
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-sm">
                                        <span style={{ color: theme.primaryColor }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                            <a href={plan.ctaUrl}
                                className={`block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 hover:opacity-90 ${plan.highlighted ? 'text-white' : 'border'}`}
                                style={plan.highlighted ? { background: theme.primaryColor } : { borderColor: theme.primaryColor, color: theme.primaryColor }}>
                                {plan.ctaLabel}
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
