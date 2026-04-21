'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons, HERO_CONTAINER, HeroBadge, safeAltText } from '../shared'
import { HeroMediaOverlay } from '../hero-media-overlay'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'

void _CSS_VARS
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function ParallaxHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    return (
        <AnimatedSection className="relative min-h-[75vh] md:min-h-[92vh] flex items-center overflow-hidden">
            {/* Full-bleed bg with parallax on desktop */}
            <HeroMediaOverlay
                field="image.url"
                altText={safeAltText(image?.alt, headline)}
                positionClass="absolute inset-0"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center parallax-hero-bg"
                    style={{
                        backgroundImage: `url(${image?.url || fallbackHeroUrl})`,
                        backgroundAttachment: 'fixed',
                    }}
                />
            </HeroMediaOverlay>
            {/* Disable fixed attachment on mobile via CSS */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media (max-width: 768px) {
                    .parallax-hero-bg { background-attachment: scroll !important; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .parallax-hero-bg { background-attachment: scroll !important; }
                }
            `}} />
            {/* Dark gradient overlay from bottom */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.15) 100%)',
                }}
            />

            <div className={`${HERO_CONTAINER} relative z-10 text-center max-w-3xl`}>
                {badge?.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
                        <HeroBadge text={badge.text} />
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
                    <CTAButtons buttons={ctaButtons} variant="glass" siteId={site?.id ? String(site.id) : undefined} />
                </motion.div>
            </div>
        </AnimatedSection>
    )
}
