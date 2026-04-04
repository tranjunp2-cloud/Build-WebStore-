'use client'

import type { BlockProps } from '../types'
import type { StepProcessConfig } from './config'

export function StepProcessBlock({ block, theme }: BlockProps<StepProcessConfig>) {
    const { headline, subheadline, steps = [], variant = 'vertical' } = block
    const pc = theme.primaryColor

    if (variant === 'horizontal') {
        return (
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                        {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                        {/* Connecting line */}
                        <div
                            className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5"
                            style={{ background: `linear-gradient(90deg, ${pc}40, ${pc}20)` }}
                        />
                        {steps.map((step, i) => (
                            <div key={i} className="relative text-center">
                                <div
                                    className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-xl font-bold relative z-10"
                                    style={{ background: `${pc}15`, border: `2px solid ${pc}40`, color: pc }}
                                >
                                    {step.icon || i + 1}
                                </div>
                                <h3 className="text-lg font-bold font-heading mb-2">{step.title}</h3>
                                <p className="text-sm opacity-50 leading-relaxed">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        )
    }

    if (variant === 'alternating') {
        return (
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                        {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                    </div>
                    <div className="relative max-w-3xl mx-auto">
                        {/* Center line */}
                        <div
                            className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
                            style={{ background: `linear-gradient(180deg, ${pc}40, ${pc}10)` }}
                        />
                        {steps.map((step, i) => {
                            const isLeft = i % 2 === 0
                            return (
                                <div key={i} className={`relative flex items-start mb-12 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                    {/* Content */}
                                    <div className={`flex-1 ${isLeft ? 'md:pr-12 md:text-right' : 'md:pl-12 md:text-left'} pl-16 md:pl-0`}>
                                        <h3 className="text-xl font-bold font-heading mb-2">{step.title}</h3>
                                        <p className="text-sm opacity-50 leading-relaxed">{step.description}</p>
                                    </div>
                                    {/* Number circle */}
                                    <div
                                        className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold z-10 shrink-0"
                                        style={{ background: `${pc}15`, border: `2px solid ${pc}40`, color: pc }}
                                    >
                                        {step.icon || i + 1}
                                    </div>
                                    {/* Spacer for opposite side */}
                                    <div className="hidden md:block flex-1" />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>
        )
    }

    // Default: vertical
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                </div>
                <div className="relative max-w-2xl mx-auto">
                    {/* Vertical line */}
                    <div
                        className="absolute left-6 top-0 bottom-0 w-0.5"
                        style={{ background: `linear-gradient(180deg, ${pc}40, ${pc}10)` }}
                    />
                    {steps.map((step, i) => (
                        <div key={i} className="relative flex items-start gap-8 mb-12 last:mb-0">
                            {/* Number circle */}
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 relative z-10"
                                style={{ background: `${pc}15`, border: `2px solid ${pc}40`, color: pc }}
                            >
                                {step.icon || i + 1}
                            </div>
                            {/* Content */}
                            <div className="pt-2">
                                <h3 className="text-xl font-bold font-heading mb-2">{step.title}</h3>
                                <p className="text-sm opacity-50 leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
