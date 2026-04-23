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

export function CardsOverlayHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], image, badge, overlayOpacity = 0.4 } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    return (
        <AnimatedSection className="relative min-h-[75vh] md:min-h-[92vh] flex items-center overflow-hidden">
            {/* Full-width background image */}
            <HeroMediaOverlay
                field="image.url"
                altText={safeAltText(image?.alt, headline)}
                positionClass="absolute inset-0"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${image?.url || fallbackHeroUrl})` }}
                />
            </HeroMediaOverlay>
            {/* Dark overlay — opacity from config */}
            <div className="absolute inset-0 bg-transparent" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />

            <div className={`${HERO_CONTAINER} relative z-10 flex items-center justify-center`}>
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
                    {badge?.show && <HeroBadge text={badge.text} />}
                    <RichText text={headline} as="h1" className="text-4xl md:text-5xl font-bold font-heading leading-[1.1] mb-6 text-white" />
                    {subheadline && (
                        <RichText text={subheadline} as="p" className="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed" />
                    )}
                    <div className="flex flex-wrap gap-4 justify-center">
                        <CTAButtons buttons={ctaButtons} variant="glass" siteId={site?.id ? String(site.id) : undefined} />
                    </div>
                </motion.div>
            </div>
        </AnimatedSection>
    )
}
