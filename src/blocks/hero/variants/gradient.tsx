'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../../shared/RichText'

export function GradientHero({ block }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, gradientPreset = 'aurora' } = block

    const presets: Record<string, [string, string, string]> = {
        aurora: ['var(--brand-primary)', 'rgba(var(--brand-primary-rgb), 0.7)', 'rgba(var(--brand-primary-rgb), 0.4)'],
        sunset: ['var(--brand-primary)', '#f97316', '#ec4899'],
        ocean: ['var(--brand-primary)', '#06b6d4', '#3b82f6'],
        forest: ['var(--brand-primary)', '#22c55e', '#14b8a6'],
    }
    const [c1, c2, c3] = presets[gradientPreset] || presets.aurora

    const gradientKeyframes = `
        @keyframes heroGradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
    `

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: gradientKeyframes }} />
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(-45deg, ${c1}, ${c2}, ${c3}, ${c1})`,
                    backgroundSize: '400% 400%',
                    animation: 'heroGradientShift 8s ease infinite',
                }}
            />
            {/* prefers-reduced-motion: stop animation */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media (prefers-reduced-motion: reduce) {
                    [data-hero-gradient-bg] { animation: none !important; }
                }
            `}} />
            <div className="absolute inset-0" data-hero-gradient-bg style={{
                background: `linear-gradient(-45deg, ${c1}, ${c2}, ${c3}, ${c1})`,
                backgroundSize: '400% 400%',
                animation: 'heroGradientShift 8s ease infinite',
            }} />

            <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
                {badge?.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
                        <div
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.25)',
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {badge.text}
                        </div>
                    </motion.div>
                )}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6 text-white"
                >
                    <RichText text={headline} as="span" />
                </motion.h1>
                {subheadline && (
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        <RichText text={subheadline} as="span" />
                    </motion.p>
                )}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.25 }}
                    className="flex flex-wrap gap-4 justify-center"
                >
                    <CTAButtons buttons={ctaButtons} variant="glass" />
                </motion.div>
            </div>
        </AnimatedSection>
    )
}
