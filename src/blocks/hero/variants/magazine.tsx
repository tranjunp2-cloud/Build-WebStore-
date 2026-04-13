'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { GradientBlob, DotGrid, SectionLabel } from '../../shared/decorative'
import { CTAButtons } from '../shared'
import { CSS_VARS } from '@/lib/theme/resolve'
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function MagazineHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="top-[-10%] left-[-5%]" size={500} opacity={0.08} />
            <DotGrid color={CSS_VARS.primary} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
                    {/* Left — Large image (60%) */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="md:col-span-3 relative"
                    >
                        <img
                            src={image?.url || fallbackHeroUrl}
                            alt={image?.alt || headline}
                            className="w-full h-auto rounded-2xl object-cover aspect-[4/3] max-h-[600px]"
                            style={{
                                border: `2px solid rgba(var(--brand-primary-rgb), 0.2)`,
                                boxShadow: `0 25px 60px rgba(var(--brand-primary-rgb), 0.1), 0 8px 24px rgba(0,0,0,0.2)`,
                            }}
                        />
                    </motion.div>

                    {/* Right — Content (40%) */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="md:col-span-2"
                    >
                        {badge?.show && (
                            <SectionLabel color={CSS_VARS.primary}>{badge.text}</SectionLabel>
                        )}
                        <RichText text={headline} as="h1" className="text-4xl lg:text-5xl font-bold font-heading leading-[1.1] mb-6" />
                        {subheadline && (
                            <RichText text={subheadline} as="p" className="text-lg opacity-60 mb-8 leading-relaxed" />
                        )}
                        <CTAButtons buttons={ctaButtons} />
                    </motion.div>
                </div>
            </div>
        </AnimatedSection>
    )
}
