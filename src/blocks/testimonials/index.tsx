'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { TestimonialsConfig, TestimonialItem } from './config'
import { StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { AvatarRing, GradientBlob } from '../shared/decorative'
import { getTeamAvatar } from '@/lib/images/industry-images'

export function TestimonialsBlock({ block, theme, site }: BlockProps<TestimonialsConfig>) {
    const { headline, testimonials = [] } = block
    const variant = block.variant || 'cards'
    const category = (site?.siteType as string) || 'business'

    // ── masonry variant ───────────────────────────────────────────────────
    if (variant === 'masonry') {
        return (
            <section className="py-24 relative overflow-hidden">
                <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'What Our Clients Say'}</h2>
                        <p className="text-lg opacity-40">Genuine reviews from our customers</p>
                    </div>
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                        {testimonials.map((t, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08, duration: 0.4 }}
                                className="break-inside-avoid p-6 rounded-2xl transition-shadow duration-300 hover:shadow-xl"
                                style={{
                                    background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)',
                                    border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                                }}
                            >
                                {/* Star rating */}
                                <div className="flex gap-0.5 mb-4">
                                    {Array.from({ length: t.rating || 5 }).map((_, j) => (
                                        <span key={j} className="text-sm" style={{ color: 'var(--brand-primary)' }}>&#9733;</span>
                                    ))}
                                </div>
                                <p className="opacity-70 mb-6 leading-relaxed text-[15px] italic">
                                    &ldquo;{t.quote}&rdquo;
                                </p>
                                <div className="flex items-center gap-3">
                                    <AvatarRing color={theme.primaryColor} src={t.avatar?.url || getTeamAvatar(category, i)} name={t.name} size={40} />
                                    <div>
                                        <p className="font-semibold text-sm">{t.name}</p>
                                        {(t.title || t.company) && (
                                            <p className="text-xs opacity-45">{[t.title, t.company].filter(Boolean).join(' \u2022 ')}</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        )
    }

    // ── spotlight variant ─────────────────────────────────────────────────
    if (variant === 'spotlight') {
        return <TestimonialsSpotlight headline={headline} testimonials={testimonials} theme={theme} category={category} />
    }

    // ── minimal-quote variant ─────────────────────────────────────────────
    if (variant === 'minimal-quote') {
        return <TestimonialsMinimalQuote headline={headline} testimonials={testimonials} theme={theme} category={category} />
    }

    // ── avatar-row variant ────────────────────────────────────────────────
    if (variant === 'avatar-row') {
        return <TestimonialsAvatarRow headline={headline} testimonials={testimonials} theme={theme} category={category} />
    }

    // ── video-text variant ────────────────────────────────────────────────
    if (variant === 'video-text') {
        return (
            <section className="py-24 relative overflow-hidden">
                <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'What Our Clients Say'}</h2>
                    </div>
                    <StaggerGrid className="flex flex-col gap-12 max-w-5xl mx-auto">
                        {testimonials.map((t, i) => {
                            const videoUrl = (t as TestimonialItem & { videoUrl?: string }).videoUrl
                            return (
                                <StaggerItem key={i}>
                                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:direction-rtl' : ''}`}>
                                        {/* Video / avatar side */}
                                        <div
                                            className={`aspect-video rounded-2xl overflow-hidden flex items-center justify-center relative ${i % 2 === 1 ? 'md:order-2' : ''}`}
                                            style={{
                                                background: 'rgba(var(--brand-primary-rgb), 0.05)',
                                                border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                            }}
                                        >
                                            {videoUrl ? (
                                                <>
                                                    <div className="absolute inset-0 bg-black/20" />
                                                    <div
                                                        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                                                        style={{ background: 'var(--brand-primary)', color: '#fff' }}
                                                    >
                                                        <span className="text-2xl ml-1">&#9654;</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <AvatarRing color={theme.primaryColor} src={t.avatar?.url || getTeamAvatar(category, i)} name={t.name} size={120} />
                                            )}
                                        </div>
                                        {/* Text side */}
                                        <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                                            <div className="flex gap-0.5 mb-4">
                                                {Array.from({ length: t.rating || 5 }).map((_, j) => (
                                                    <span key={j} className="text-sm" style={{ color: 'var(--brand-primary)' }}>&#9733;</span>
                                                ))}
                                            </div>
                                            <p className="text-lg opacity-70 mb-6 leading-relaxed italic">
                                                &ldquo;{t.quote}&rdquo;
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <AvatarRing color={theme.primaryColor} src={t.avatar?.url || getTeamAvatar(category, i)} name={t.name} size={44} />
                                                <div>
                                                    <p className="font-semibold text-sm">{t.name}</p>
                                                    {(t.title || t.company) && (
                                                        <p className="text-xs opacity-45">{[t.title, t.company].filter(Boolean).join(' \u2022 ')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </StaggerItem>
                            )
                        })}
                    </StaggerGrid>
                </div>
            </section>
        )
    }

    // ── Default: cards variant ────────────────────────────────────────────
    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">
                        {headline || 'What Our Clients Say'}
                    </h2>
                    <p className="text-lg opacity-40">Genuine reviews from our customers</p>
                </div>

                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <StaggerItem key={i}>
                            <HoverCard
                                className="p-8 rounded-2xl h-full relative group transition-shadow duration-300 hover:shadow-xl"
                                style={{
                                    background: `linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)`,
                                    border: `1px solid rgba(var(--brand-primary-rgb), 0.063)`,
                                }}
                            >
                                {/* Decorative quote mark */}
                                <div
                                    className="absolute top-4 right-6 text-6xl font-serif leading-none opacity-[0.06] select-none"
                                    style={{ color: 'var(--brand-primary)' }}
                                >
                                    &ldquo;
                                </div>

                                {/* Star rating */}
                                <div className="flex gap-0.5 mb-5">
                                    {Array.from({ length: t.rating || 5 }).map((_, j) => (
                                        <span key={j} className="text-sm" style={{ color: 'var(--brand-primary)' }}>&#9733;</span>
                                    ))}
                                </div>

                                {/* Quote */}
                                <p className="opacity-70 mb-8 leading-relaxed text-[15px] italic relative z-10">
                                    &ldquo;{t.quote}&rdquo;
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-3 mt-auto">
                                    <AvatarRing color={theme.primaryColor} src={t.avatar?.url || getTeamAvatar(category, i)} name={t.name} size={44} />
                                    <div>
                                        <p className="font-semibold text-sm">{t.name}</p>
                                        {(t.title || t.company) && (
                                            <p className="text-xs opacity-45">
                                                {[t.title, t.company].filter(Boolean).join(' \u2022 ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    )
}

// ── Spotlight sub-component ───────────────────────────────────────────────
function TestimonialsSpotlight({
    headline,
    testimonials,
    theme,
    category,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
}) {
    const [centerIdx, setCenterIdx] = useState(0)

    if (testimonials.length === 0) return null
    const center = testimonials[centerIdx]
    const sides = testimonials.filter((_, i) => i !== centerIdx)

    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'What Our Clients Say'}</h2>
                </div>
                <div className="flex flex-col lg:flex-row items-center gap-8 max-w-5xl mx-auto">
                    {/* Flanking — left */}
                    <div className="hidden lg:flex flex-col gap-4 flex-1">
                        {sides.filter((_, i) => i % 2 === 0).map((t, i) => {
                            const origIdx = testimonials.indexOf(t)
                            return (
                                <motion.div
                                    key={origIdx}
                                    layoutId={`testimonial-${origIdx}`}
                                    onClick={() => setCenterIdx(origIdx)}
                                    className="p-5 rounded-xl cursor-pointer transition-shadow duration-200 hover:shadow-lg"
                                    style={{
                                        background: 'rgba(var(--brand-primary-rgb), 0.02)',
                                        border: '1px solid rgba(var(--brand-primary-rgb), 0.06)',
                                    }}
                                >
                                    <p className="text-sm opacity-60 italic line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
                                    <p className="text-xs font-semibold mt-2 opacity-70">{t.name}</p>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Center spotlight */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={centerIdx}
                            layoutId={`testimonial-${centerIdx}`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="p-10 rounded-2xl text-center flex-shrink-0 w-full lg:w-[400px]"
                            style={{
                                background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.05), transparent 60%)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                                boxShadow: '0 8px 32px rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                        >
                            <div className="flex justify-center mb-6">
                                <AvatarRing color={theme.primaryColor} src={center.avatar?.url || getTeamAvatar(category, centerIdx)} name={center.name} size={72} />
                            </div>
                            <div className="flex justify-center gap-0.5 mb-4">
                                {Array.from({ length: center.rating || 5 }).map((_, j) => (
                                    <span key={j} className="text-lg" style={{ color: 'var(--brand-primary)' }}>&#9733;</span>
                                ))}
                            </div>
                            <p className="text-lg opacity-70 mb-6 leading-relaxed italic">
                                &ldquo;{center.quote}&rdquo;
                            </p>
                            <p className="font-bold">{center.name}</p>
                            {(center.title || center.company) && (
                                <p className="text-sm opacity-45 mt-1">{[center.title, center.company].filter(Boolean).join(' \u2022 ')}</p>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Flanking — right */}
                    <div className="hidden lg:flex flex-col gap-4 flex-1">
                        {sides.filter((_, i) => i % 2 === 1).map((t) => {
                            const origIdx = testimonials.indexOf(t)
                            return (
                                <motion.div
                                    key={origIdx}
                                    layoutId={`testimonial-${origIdx}`}
                                    onClick={() => setCenterIdx(origIdx)}
                                    className="p-5 rounded-xl cursor-pointer transition-shadow duration-200 hover:shadow-lg"
                                    style={{
                                        background: 'rgba(var(--brand-primary-rgb), 0.02)',
                                        border: '1px solid rgba(var(--brand-primary-rgb), 0.06)',
                                    }}
                                >
                                    <p className="text-sm opacity-60 italic line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
                                    <p className="text-xs font-semibold mt-2 opacity-70">{t.name}</p>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Mobile: dot indicators */}
                    <div className="flex lg:hidden gap-2 mt-4">
                        {testimonials.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCenterIdx(i)}
                                className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                                style={{
                                    background: i === centerIdx ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                                }}
                                aria-label={`View testimonial ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

// ── Minimal Quote sub-component (auto-rotate) ────────────────────────────
function TestimonialsMinimalQuote({
    headline,
    testimonials,
    theme,
    category,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
}) {
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (testimonials.length <= 1) return
        // Respect prefers-reduced-motion
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        if (mq.matches) return

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % testimonials.length)
        }, 6000)
        return () => clearInterval(timer)
    }, [testimonials.length])

    if (testimonials.length === 0) return null
    const t = testimonials[currentIndex]

    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'What Our Clients Say'}</h2>
                </div>
                <div className="max-w-3xl mx-auto text-center relative">
                    {/* Large decorative quote mark */}
                    <div
                        className="text-[12rem] font-serif leading-none select-none absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{ color: 'rgba(var(--brand-primary-rgb), 0.08)' }}
                    >
                        &ldquo;
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative z-10"
                        >
                            <p className="text-2xl md:text-3xl italic opacity-70 leading-relaxed mb-8">
                                &ldquo;{t.quote}&rdquo;
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <AvatarRing color={theme.primaryColor} src={t.avatar?.url || getTeamAvatar(category, currentIndex)} name={t.name} size={48} />
                                <div className="text-left">
                                    <p className="font-bold">{t.name}</p>
                                    {(t.title || t.company) && (
                                        <p className="text-sm opacity-45">{[t.title, t.company].filter(Boolean).join(' \u2022 ')}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Dot indicators */}
                    {testimonials.length > 1 && (
                        <div className="flex justify-center gap-2 mt-10">
                            {testimonials.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentIndex(i)}
                                    className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                                    style={{
                                        background: i === currentIndex ? 'var(--brand-primary)' : 'rgba(var(--brand-primary-rgb), 0.2)',
                                    }}
                                    aria-label={`View testimonial ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

// ── Avatar Row sub-component ──────────────────────────────────────────────
function TestimonialsAvatarRow({
    headline,
    testimonials,
    theme,
    category,
}: {
    headline?: string
    testimonials: TestimonialItem[]
    theme: BlockProps<TestimonialsConfig>['theme']
    category: string
}) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    if (testimonials.length === 0) return null
    const selected = testimonials[selectedIndex]

    return (
        <section className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="bottom-[0%] left-[-5%]" size={400} opacity={0.06} />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'What Our Clients Say'}</h2>
                </div>

                {/* Avatar row */}
                <div className="flex justify-center gap-4 mb-10 flex-wrap">
                    {testimonials.map((t, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedIndex(i)}
                            className="rounded-full transition-all duration-200 focus:outline-none"
                            style={{
                                boxShadow: i === selectedIndex
                                    ? `0 0 0 3px var(--brand-primary)`
                                    : '0 0 0 2px rgba(var(--brand-primary-rgb), 0.15)',
                                transform: i === selectedIndex ? 'scale(1.1)' : 'scale(1)',
                            }}
                            aria-label={`View ${t.name}'s testimonial`}
                        >
                            <AvatarRing
                                color={theme.primaryColor}
                                src={t.avatar?.url || getTeamAvatar(category, i)}
                                name={t.name}
                                size={56}
                            />
                        </button>
                    ))}
                </div>

                {/* Selected testimonial */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedIndex}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-2xl mx-auto text-center p-8 rounded-2xl"
                        style={{
                            background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb), 0.031), transparent 60%)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.063)',
                        }}
                    >
                        <div className="flex justify-center gap-0.5 mb-4">
                            {Array.from({ length: selected.rating || 5 }).map((_, j) => (
                                <span key={j} className="text-lg" style={{ color: 'var(--brand-primary)' }}>&#9733;</span>
                            ))}
                        </div>
                        <p className="text-lg opacity-70 mb-6 leading-relaxed italic">
                            &ldquo;{selected.quote}&rdquo;
                        </p>
                        <p className="font-bold">{selected.name}</p>
                        {(selected.title || selected.company) && (
                            <p className="text-sm opacity-45 mt-1">{[selected.title, selected.company].filter(Boolean).join(' \u2022 ')}</p>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    )
}
