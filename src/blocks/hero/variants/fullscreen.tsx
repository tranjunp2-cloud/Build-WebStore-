'use client'

import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import { SmartLink } from '@/blocks/_shared/smart-link'

const MotionSmartLink = motion.create(SmartLink)
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { GradientBlob } from '../../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../../shared/RichText'
import { HERO_CONTAINER, HERO_MIN_HEIGHT } from '../shared'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { useLocalHref } from '@/lib/hooks/use-local-href'

export function FullscreenHero({ block }: BlockProps<HeroConfig>) {
    const resolveHref = useLocalHref()
    const { headline, subheadline, ctaButtons = [] } = block

    return (
        <AnimatedSection className={`relative ${HERO_MIN_HEIGHT} flex items-center overflow-hidden`}>
            <GradientBlob color={CSS_VARS.primary} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={500} opacity={0.06} />
            <div className={`${HERO_CONTAINER} text-center max-w-3xl relative z-10`}>
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl md:text-6xl font-bold font-heading leading-tight mb-6"
                >
                    <RichText text={headline} as="span" />
                </motion.h1>
                {subheadline && <RichText text={subheadline} as="p" className="text-lg opacity-60 mb-8 max-w-xl mx-auto" />}
                {ctaButtons.length > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center">
                        {ctaButtons.map((btn, i) => (
                            <MotionSmartLink key={i} href={resolveHref(btn?.url)}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${TOUCH_TARGET.min} inline-flex items-center justify-center`}
                                style={btn.style === 'outline'
                                    ? { border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`, color: 'var(--brand-primary)' }
                                    : { background: 'var(--brand-primary)', color: '#fff', boxShadow: `0 4px 20px rgba(var(--brand-primary-rgb), 0.188)` }}
                            >
                                <RichText text={btn.label} as="span" />
                            </MotionSmartLink>
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}
