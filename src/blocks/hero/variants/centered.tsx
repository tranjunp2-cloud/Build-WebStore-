'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { GradientBlob, DotGrid, SectionLabel } from '../../shared/decorative'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'

export function CenteredHero({ block }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge } = block

    return (
        <AnimatedSection
            className="relative min-h-[92vh] flex items-center overflow-hidden"
        >
            {/* Multi-layer background */}
            <div className="absolute inset-0" style={{
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(var(--brand-primary-rgb), 0.094) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(var(--brand-primary-rgb), 0.063) 0%, transparent 50%)
                `,
            }} />
            <DotGrid color={CSS_VARS.primary} />
            <GradientBlob color={CSS_VARS.primary} className="top-[-20%] left-[10%]" size={600} opacity={0.1} />
            <GradientBlob color={CSS_VARS.primary} className="bottom-[-10%] right-[5%]" size={400} opacity={0.08} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                    {badge?.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                        >
                            <SectionLabel color={CSS_VARS.primary}>{badge.text}</SectionLabel>
                        </motion.div>
                    )}

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6"
                    >
                        {headline}
                    </motion.h1>

                    {subheadline && (
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="text-xl opacity-60 mb-10 max-w-2xl mx-auto leading-relaxed"
                        >
                            {subheadline}
                        </motion.p>
                    )}

                    {ctaButtons.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="flex flex-wrap gap-4 justify-center"
                        >
                            <CTAButtons buttons={ctaButtons} />
                        </motion.div>
                    )}

                    {/* Hero image — only show if user uploaded an image */}
                    {image?.url && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="mt-16 relative max-w-4xl mx-auto group"
                        >
                            <img
                                src={image.url}
                                alt={image.alt || headline}
                                className="w-full rounded-2xl object-cover"
                            />
                            {/* Gradient overlay for polish */}
                            <div
                                className="absolute inset-0 rounded-2xl pointer-events-none"
                                style={{
                                    background: `linear-gradient(180deg, transparent 60%, rgba(var(--brand-primary-rgb), 0.082) 100%)`,
                                    boxShadow: `0 25px 60px rgba(var(--brand-primary-rgb), 0.125), 0 8px 24px rgba(0,0,0,0.3)`,
                                    borderRadius: 'inherit',
                                }}
                            />
                        </motion.div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
