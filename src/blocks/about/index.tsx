'use client'

import type { BlockProps } from '../types'
import type { AboutConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion } from 'framer-motion'
import { GradientBlob, SectionLabel } from '../shared/decorative'
import { getAboutImage } from '@/lib/images/industry-images'

export function AboutBlock({ block, theme, site }: BlockProps<AboutConfig>) {
    const { headline, sectionLabel, layout = 'image-right' } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackAboutUrl = getAboutImage(category)

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="bottom-[0%] right-[-10%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                {sectionLabel && (
                    <div className={layout === 'centered' ? 'text-center' : ''}>
                        <SectionLabel color={theme.primaryColor}>{sectionLabel}</SectionLabel>
                    </div>
                )}

                <div className={`grid grid-cols-1 ${layout !== 'centered' ? 'lg:grid-cols-2' : ''} gap-14 items-center`}>
                    {/* Image Left */}
                    {layout === 'image-left' && (
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <img
                                src={block.image?.url || fallbackAboutUrl}
                                alt={block.image?.alt || headline}
                                className="w-full h-auto rounded-3xl shadow-xl object-cover aspect-auto max-h-[450px]"
                            />
                        </motion.div>
                    )}

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={layout === 'centered' ? 'text-center max-w-3xl mx-auto' : ''}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-6 leading-tight">{headline}</h2>
                        {block.body && (
                            <div className="opacity-60 leading-relaxed text-lg space-y-4">
                                <p>{typeof block.body === 'string' ? block.body : 'About Us'}</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Image Right */}
                    {(layout === 'image-right' || !layout) && (
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                        >
                            <img
                                src={block.image?.url || fallbackAboutUrl}
                                alt={block.image?.alt || headline}
                                className="w-full h-auto rounded-3xl shadow-xl object-cover aspect-auto max-h-[450px]"
                            />
                        </motion.div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
