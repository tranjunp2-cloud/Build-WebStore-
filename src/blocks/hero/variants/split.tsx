'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { GradientBlob, DotGrid, SectionLabel } from '../../shared/decorative'
import { CTAButtons, HERO_CONTAINER } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function SplitHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            {/* Background decorations */}
            <GradientBlob color={CSS_VARS.primary} className="top-[-10%] right-[-5%]" size={600} opacity={0.12} />
            <GradientBlob color={CSS_VARS.primary} className="bottom-[-15%] left-[-8%]" size={500} opacity={0.08} />
            <DotGrid color={CSS_VARS.primary} />

            <div className={`${HERO_CONTAINER} relative z-10`}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left — Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {badge?.show && (
                            <SectionLabel color={CSS_VARS.primary}>{badge.text}</SectionLabel>
                        )}
                        <RichText text={headline} as="h1" className="text-5xl lg:text-6xl font-bold font-heading leading-[1.1] mb-6" />
                        {subheadline && (
                            <RichText text={subheadline} as="p" className="text-xl opacity-60 mb-10 max-w-lg leading-relaxed" />
                        )}
                        <CTAButtons buttons={ctaButtons} />
                    </motion.div>

                    {/* Right — Image / Illustration placeholder */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative"
                    >
                        <img
                            src={image?.url || fallbackHeroUrl}
                            alt={image?.alt || headline}
                            className="w-full h-auto rounded-3xl object-cover aspect-auto max-h-[500px]"
                            style={{ boxShadow: `0 25px 50px rgba(var(--brand-primary-rgb), 0.082), 0 10px 20px rgba(0,0,0,0.2)` }}
                        />
                    </motion.div>
                </div>
            </div>
        </AnimatedSection>
    )
}
