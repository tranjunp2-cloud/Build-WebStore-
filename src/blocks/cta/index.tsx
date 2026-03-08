'use client'

import type { BlockProps } from '../types'
import type { CTAConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion } from 'framer-motion'
import { GradientBlob, DotGrid } from '../shared/decorative'

export function CTABlock({ block, theme }: BlockProps<CTAConfig>) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    const pc = theme.primaryColor

    return (
        <AnimatedSection className="py-20">
            <div className="container mx-auto px-6">
                <div
                    className="rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${pc}18 0%, ${pc}06 100%)`,
                        border: `1px solid ${pc}20`,
                    }}
                >
                    <GradientBlob color={pc} className="top-[-30%] right-[-10%]" size={400} opacity={0.15} />
                    <GradientBlob color={pc} className="bottom-[-20%] left-[-5%]" size={300} opacity={0.1} />
                    <DotGrid color={pc} spacing={28} />

                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                        {subheadline && (
                            <p className="text-lg opacity-50 mb-10 max-w-xl mx-auto leading-relaxed">{subheadline}</p>
                        )}
                        <motion.a
                            href={ctaUrl}
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-block px-10 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                            style={ctaStyle === 'primary'
                                ? {
                                    background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
                                    color: '#fff',
                                    boxShadow: `0 8px 30px ${pc}35`,
                                }
                                : {
                                    border: `2px solid ${pc}50`,
                                    color: pc,
                                    background: `${pc}08`,
                                }}
                        >
                            {ctaLabel}
                        </motion.a>
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}
