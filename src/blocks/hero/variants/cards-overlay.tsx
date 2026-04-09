'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { getHeroImage } from '@/lib/images/industry-images'

export function CardsOverlayHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            {/* Full-width background image */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${image?.url || fallbackHeroUrl})`,
                }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/60" />

            <div className="container mx-auto px-6 relative z-10 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-2xl w-full text-center p-10 md:p-14 rounded-3xl"
                    style={{
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                    }}
                >
                    {badge?.show && (
                        <div
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {badge.text}
                        </div>
                    )}
                    <h1 className="text-4xl md:text-5xl font-bold font-heading leading-[1.1] mb-6 text-white">
                        {headline}
                    </h1>
                    {subheadline && (
                        <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
                            {subheadline}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-4 justify-center">
                        <CTAButtons buttons={ctaButtons} variant="glass" />
                    </div>
                </motion.div>
            </div>
        </AnimatedSection>
    )
}
