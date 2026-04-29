'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { VideoShowcaseConfig, VideoItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

function getYoutubeThumbnail(videoUrl: string): string | null {
    const id = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function PlayIcon({ size = 48 }: { size?: number }) {
    return (
        <div
            className="rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110"
            style={{ width: size, height: size, background: 'var(--brand-primary)' }}
        >
            <svg className="text-white ml-1" width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
            </svg>
        </div>
    )
}

function VideoEmbed({ videoUrl, autoplay }: { videoUrl: string; autoplay: boolean }) {
    // Handle YouTube URLs
    const youtubeId = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    if (youtubeId) {
        return (
            <iframe
                src={`https://www.youtube.com/embed/${youtubeId}${autoplay ? '?autoplay=1' : ''}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video"
            />
        )
    }
    // Fallback to HTML5 video
    return (
        <video
            src={videoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay={autoplay}
            playsInline
        />
    )
}

export function VideoShowcaseBlock({ block }: BlockProps<VideoShowcaseConfig>) {
    const {
        headline,
        subheadline,
        videos = [],
        variant = 'grid',
        showCategories = true,
        autoplay = false,
    } = block

    const [activeCategory, setActiveCategory] = useState('All')
    const [playingIndex, setPlayingIndex] = useState<number | null>(null)
    const [featuredIndex, setFeaturedIndex] = useState(0)

    const categories = useMemo(() => {
        if (!showCategories) return []
        const cats = Array.from(new Set(videos.map((v) => v.category).filter(Boolean))) as string[]
        return ['All', ...cats]
    }, [videos, showCategories])

    const filtered = activeCategory === 'All'
        ? videos
        : videos.filter((v) => v.category === activeCategory)

    const VideoCard = ({ video, index, aspectClass = 'aspect-video' }: { video: VideoItem; index: number; aspectClass?: string }) => {
        const effectiveThumbnail = video.thumbnailUrl || getYoutubeThumbnail(video.videoUrl)
        return (
        <div
            className={`relative ${aspectClass} rounded-2xl overflow-hidden cursor-pointer group`}
            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
            onClick={() => setPlayingIndex(playingIndex === index ? null : index)}
        >
            {playingIndex === index ? (
                <VideoEmbed videoUrl={video.videoUrl} autoplay={true} />
            ) : (
                <>
                    {effectiveThumbnail ? (
                        <Image src={effectiveThumbnail} alt={video.title} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                            <PlayIcon />
                        </div>
                    )}
                    {effectiveThumbnail && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                            <PlayIcon />
                        </div>
                    )}
                    {video.duration && (
                        <span className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                            {video.duration}
                        </span>
                    )}
                </>
            )}
        </div>
    )
    }

    /* ── Grid variant ────────────────────────────────────────────────────────── */
    const renderGrid = () => (
        <>
            {showCategories && categories.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3 mb-10">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
                            style={activeCategory === cat
                                ? { background: 'var(--brand-primary)', color: '#fff' }
                                : { background: `rgba(var(--brand-primary-rgb), 0.063)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
                            }
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((video, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <VideoCard video={video} index={i} />
                        <div className="mt-3">
                            <RichText text={video.title} as="h4" className="font-bold font-heading" />
                            {video.description && <RichText text={video.description} as="p" className="text-sm opacity-50 mt-1" />}
                            {video.category && <span className="text-xs opacity-40">{video.category}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>
        </>
    )

    /* ── Featured variant ────────────────────────────────────────────────────── */
    const renderFeatured = () => {
        const featured = filtered[featuredIndex] ?? filtered[0]
        if (!featured) return null
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <VideoCard video={featured} index={featuredIndex} aspectClass="aspect-video" />
                    <div className="mt-4">
                        <RichText text={featured.title} as="h3" className="text-xl font-bold font-heading" />
                        {featured.description && <RichText text={featured.description} as="p" className="text-sm opacity-50 mt-2" />}
                    </div>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {filtered.map((video, i) => (
                        <button
                            key={i}
                            onClick={() => { setFeaturedIndex(i); setPlayingIndex(null) }}
                            className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200"
                            style={{
                                border: `1px solid rgba(var(--brand-primary-rgb), ${featuredIndex === i ? 0.25 : 0.082})`,
                                background: featuredIndex === i ? `rgba(var(--brand-primary-rgb), 0.04)` : 'transparent',
                            }}
                        >
                            <div className="w-24 aspect-video rounded-lg overflow-hidden shrink-0 relative">
                                {(video.thumbnailUrl || getYoutubeThumbnail(video.videoUrl)) ? (
                                    <Image src={(video.thumbnailUrl || getYoutubeThumbnail(video.videoUrl))!} alt={video.title} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                                        <PlayIcon size={20} />
                                    </div>
                                )}
                                {video.duration && (
                                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-[10px]">
                                        {video.duration}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm font-heading line-clamp-2">{video.title}</p>
                                {video.category && <p className="text-xs opacity-40 mt-1">{video.category}</p>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    /* ── Fullwidth variant ───────────────────────────────────────────────────── */
    const renderFullwidth = () => (
        <div className="space-y-16">
            {filtered.map((video, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                >
                    <VideoCard video={video} index={i} aspectClass="aspect-[21/9]" />
                    <div className="mt-4 max-w-2xl">
                        <RichText text={video.title} as="h3" className="text-2xl font-bold font-heading" />
                        {video.description && <RichText text={video.description} as="p" className="text-base opacity-50 mt-2" />}
                    </div>
                </motion.div>
            ))}
        </div>
    )

    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-50 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                {variant === 'grid' && renderGrid()}
                {variant === 'featured' && renderFeatured()}
                {variant === 'fullwidth' && renderFullwidth()}
            </div>
        </AnimatedSection>
    )
}
