'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { AnimatedSection } from '../../shared/animations'
import { CTAButtons, HERO_CONTAINER, HeroBadge, VideoControlButton, safeAltText } from '../shared'
import { HeroMediaOverlay } from '../hero-media-overlay'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'

void _CSS_VARS
import { getHeroImage } from '@/lib/images/industry-images'
import { RichText } from '../../shared/RichText'

export function VideoHero({ block, site }: BlockProps<HeroConfig>) {
    const { headline, subheadline, ctaButtons = [], badge, videoUrl: initialVideoUrl, image } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category, 0, site?.imageLibraryS3 as Record<string, string> | undefined)

    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(true)
    const [videoUrl, setVideoUrl] = useState(initialVideoUrl)
    const prevVideoUrlRef = useRef(initialVideoUrl)

    // Respect prefers-reduced-motion
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        const handler = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches && videoRef.current) {
                videoRef.current.pause()
                setIsPlaying(false)
            }
        }
        handler(mq)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    // Explicit play() after first-upload React render — autoPlay alone may not fire on dynamic mount
    useEffect(() => {
        if (videoUrl && videoUrl !== prevVideoUrlRef.current) {
            prevVideoUrlRef.current = videoUrl
            videoRef.current?.play().catch(() => {})
        }
    }, [videoUrl])

    const togglePlayback = () => {
        if (!videoRef.current) return
        if (isPlaying) {
            videoRef.current.pause()
        } else {
            videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }

    return (
        <AnimatedSection className="relative min-h-[75vh] md:min-h-[92vh] flex items-center overflow-hidden">
            {/* Full-bleed background video — muted + playsInline satisfies mobile autoplay policy */}
            <HeroMediaOverlay
                field="image.url"
                altText={safeAltText(image?.alt, headline)}
                positionClass="absolute inset-0"
                showImageButton={false}
                showVideoButton={true}
                videoField="videoUrl"
                onVideoUploaded={(url) => { setVideoUrl(url); setIsPlaying(true) }}
            >
                {videoUrl ? (
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={image?.url || fallbackHeroUrl}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${image?.url || fallbackHeroUrl})` }}
                    />
                )}
            </HeroMediaOverlay>

            {/* Dark overlay for text readability — pointer-events-none lets HeroMediaOverlay hover fire */}
            <div className="absolute inset-0 bg-black/50 pointer-events-none" />

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

            {/* Play/Pause button in corner — only when video is active */}
            {videoUrl && (
                <VideoControlButton
                    isPlaying={isPlaying}
                    onClick={togglePlayback}
                    iconSize={16}
                    className="absolute bottom-6 right-6 z-20"
                />
            )}
        </AnimatedSection>
    )
}
