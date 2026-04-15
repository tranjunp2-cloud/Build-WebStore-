'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../../shared/RichText'
import { HERO_CONTAINER } from '../shared'
import { TOUCH_TARGET } from '@/lib/design-tokens'

void _CSS_VARS

export function MinimalHero({ block }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [] } = block

    return (
        <AnimatedSection className="relative py-32 flex items-center overflow-hidden">
            {/* Subtle radial gradient */}
            <div className="absolute inset-0" style={{
                background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(var(--brand-primary-rgb), 0.05) 0%, transparent 70%)`,
            }} />

            <div className={`${HERO_CONTAINER} text-center max-w-4xl relative z-10`}>
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="text-6xl md:text-8xl font-bold font-heading leading-[1.05] mb-8"
                >
                    <RichText text={headline} as="span" />
                </motion.h1>
                {subheadline && (
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-xl opacity-50 mb-12 max-w-2xl mx-auto leading-relaxed"
                    >
                        <RichText text={subheadline} as="span" />
                    </motion.p>
                )}
                {ctaButtons.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                        className="flex justify-center"
                    >
                        {/* Single CTA — take only the first button */}
                        <motion.a
                            href={ctaButtons[0].url}
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            className={`px-10 py-4 rounded-xl font-semibold text-sm transition-all duration-300 ${TOUCH_TARGET.min} inline-flex items-center justify-center`}
                            style={{
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                color: '#fff',
                                boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)`,
                            }}
                        >
                            {ctaButtons[0].label}
                        </motion.a>
                    </motion.div>
                )}
            </div>
        </AnimatedSection>
    )
}
