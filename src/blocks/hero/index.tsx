'use client'

import { useState, useEffect, useRef } from 'react'
import type { BlockProps } from '../types'
import type { HeroConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion } from 'framer-motion'
import { GradientBlob, DotGrid, SectionLabel } from '../shared/decorative'
import { getHeroImage } from '@/lib/images/industry-images'

// ── Shared CTA renderer ──────────────────────────────────────────────────────
function CTAButtons({ buttons, variant = 'default' }: { buttons: HeroConfig['ctaButtons']; variant?: 'default' | 'glass' }) {
    if (!buttons || buttons.length === 0) return null

    return (
        <div className="flex flex-wrap gap-4">
            {buttons.map((btn, i) => (
                <motion.a
                    key={i}
                    href={btn.url}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                    style={btn.style === 'outline'
                        ? variant === 'glass'
                            ? {
                                border: '2px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(8px)',
                            }
                            : {
                                border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`,
                                color: 'var(--brand-primary)',
                                background: `rgba(var(--brand-primary-rgb), 0.031)`,
                            }
                        : variant === 'glass'
                            ? {
                                background: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(12px)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                            }
                            : {
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                color: '#fff',
                                boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)`,
                            }}
                >
                    {btn.label}
                </motion.a>
            ))}
        </div>
    )
}

export function HeroBlock({ block, theme, site }: BlockProps<HeroConfig>) {
    const {
        variant = 'centered', headline, subheadline, ctaButtons = [],
        image, badge, videoUrl, gradientPreset = 'aurora', images = [],
    } = block
    const category = (site?.siteType as string) || 'business'
    const fallbackHeroUrl = getHeroImage(category)

    // ── Split Variant ──────────────────────────────────────────────────────
    if (variant === 'split-left' || variant === 'split-right') {
        return (
            <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
                {/* Background decorations */}
                <GradientBlob color={theme.primaryColor} className="top-[-10%] right-[-5%]" size={600} opacity={0.12} />
                <GradientBlob color={theme.primaryColor} className="bottom-[-15%] left-[-8%]" size={500} opacity={0.08} />
                <DotGrid color={theme.primaryColor} />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        {/* Left — Content */}
                        <motion.div
                            initial={{ opacity: 0, x: -40 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {badge?.show && (
                                <SectionLabel color={theme.primaryColor}>{badge.text}</SectionLabel>
                            )}
                            <h1 className="text-5xl lg:text-6xl font-bold font-heading leading-[1.1] mb-6">
                                {headline}
                            </h1>
                            {subheadline && (
                                <p className="text-xl opacity-60 mb-10 max-w-lg leading-relaxed">{subheadline}</p>
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

    // ── Fullscreen Variant ─────────────────────────────────────────────────
    if (variant === 'fullscreen') {
        return (
            <AnimatedSection className="relative py-32 flex items-center overflow-hidden">
                <GradientBlob color={theme.primaryColor} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={500} opacity={0.06} />
                <div className="container mx-auto px-6 text-center max-w-3xl relative z-10">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-5xl md:text-6xl font-bold font-heading leading-tight mb-6"
                    >
                        {headline}
                    </motion.h1>
                    {subheadline && <p className="text-lg opacity-60 mb-8 max-w-xl mx-auto">{subheadline}</p>}
                    {ctaButtons.length > 0 && (
                        <div className="flex flex-wrap gap-4 justify-center">
                            {ctaButtons.map((btn, i) => (
                                <motion.a key={i} href={btn.url}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="px-6 py-3 rounded-lg font-semibold text-sm transition-all"
                                    style={btn.style === 'outline'
                                        ? { border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`, color: 'var(--brand-primary)' }
                                        : { background: 'var(--brand-primary)', color: '#fff', boxShadow: `0 4px 20px rgba(var(--brand-primary-rgb), 0.188)` }}
                                >
                                    {btn.label}
                                </motion.a>
                            ))}
                        </div>
                    )}
                </div>
            </AnimatedSection>
        )
    }

    // ── Magazine Variant ────────────────────────────────────────────────────
    if (variant === 'magazine') {
        return (
            <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
                <GradientBlob color={theme.primaryColor} className="top-[-10%] left-[-5%]" size={500} opacity={0.08} />
                <DotGrid color={theme.primaryColor} />

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
                                <SectionLabel color={theme.primaryColor}>{badge.text}</SectionLabel>
                            )}
                            <h1 className="text-4xl lg:text-5xl font-bold font-heading leading-[1.1] mb-6">
                                {headline}
                            </h1>
                            {subheadline && (
                                <p className="text-lg opacity-60 mb-8 leading-relaxed">{subheadline}</p>
                            )}
                            <CTAButtons buttons={ctaButtons} />
                        </motion.div>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Minimal Variant ─────────────────────────────────────────────────────
    if (variant === 'minimal') {
        return (
            <AnimatedSection className="relative py-32 flex items-center overflow-hidden">
                {/* Subtle radial gradient */}
                <div className="absolute inset-0" style={{
                    background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(var(--brand-primary-rgb), 0.05) 0%, transparent 70%)`,
                }} />

                <div className="container mx-auto px-6 text-center max-w-4xl relative z-10">
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="text-6xl md:text-8xl font-bold font-heading leading-[1.05] mb-8"
                    >
                        {headline}
                    </motion.h1>
                    {subheadline && (
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="text-xl opacity-50 mb-12 max-w-2xl mx-auto leading-relaxed"
                        >
                            {subheadline}
                        </motion.p>
                    )}
                    {ctaButtons.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="flex justify-center"
                        >
                            {/* Single CTA — take only the first button */}
                            <motion.a
                                href={ctaButtons[0].url}
                                whileHover={{ scale: 1.04, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                className="px-10 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                                style={{
                                    background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                    color: '#fff',
                                    boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)`,
                                }}
                            >
                                {ctaButtons[0].label}
                            </motion.a>
                        </motion.div>
                    )}
                </div>
            </AnimatedSection>
        )
    }

    // ── Cards Overlay Variant ───────────────────────────────────────────────
    if (variant === 'cards-overlay') {
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

    // ── Gradient Variant ────────────────────────────────────────────────────
    if (variant === 'gradient') {
        const presets: Record<string, [string, string, string]> = {
            aurora: ['var(--brand-primary)', 'rgba(var(--brand-primary-rgb), 0.7)', 'rgba(var(--brand-primary-rgb), 0.4)'],
            sunset: ['var(--brand-primary)', '#f97316', '#ec4899'],
            ocean: ['var(--brand-primary)', '#06b6d4', '#3b82f6'],
            forest: ['var(--brand-primary)', '#22c55e', '#14b8a6'],
        }
        const [c1, c2, c3] = presets[gradientPreset] || presets.aurora

        const gradientKeyframes = `
            @keyframes heroGradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
        `

        return (
            <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
                <style dangerouslySetInnerHTML={{ __html: gradientKeyframes }} />
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(-45deg, ${c1}, ${c2}, ${c3}, ${c1})`,
                        backgroundSize: '400% 400%',
                        animation: 'heroGradientShift 8s ease infinite',
                    }}
                />
                {/* prefers-reduced-motion: stop animation */}
                <style dangerouslySetInnerHTML={{ __html: `
                    @media (prefers-reduced-motion: reduce) {
                        [data-hero-gradient-bg] { animation: none !important; }
                    }
                `}} />
                <div className="absolute inset-0" data-hero-gradient-bg style={{
                    background: `linear-gradient(-45deg, ${c1}, ${c2}, ${c3}, ${c1})`,
                    backgroundSize: '400% 400%',
                    animation: 'heroGradientShift 8s ease infinite',
                }} />

                <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
                    {badge?.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                        >
                            <div
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                {badge.text}
                            </div>
                        </motion.div>
                    )}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6 text-white"
                    >
                        {headline}
                    </motion.h1>
                    {subheadline && (
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
                        >
                            {subheadline}
                        </motion.p>
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                        className="flex flex-wrap gap-4 justify-center"
                    >
                        <CTAButtons buttons={ctaButtons} variant="glass" />
                    </motion.div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Parallax Variant ────────────────────────────────────────────────────
    if (variant === 'parallax') {
        return (
            <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
                {/* Full-bleed bg with parallax on desktop */}
                <div
                    className="absolute inset-0 bg-cover bg-center parallax-hero-bg"
                    style={{
                        backgroundImage: `url(${image?.url || fallbackHeroUrl})`,
                        backgroundAttachment: 'fixed',
                    }}
                />
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

                <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
                    {badge?.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                        >
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
                        </motion.div>
                    )}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6 text-white"
                    >
                        {headline}
                    </motion.h1>
                    {subheadline && (
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
                        >
                            {subheadline}
                        </motion.p>
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.25 }}
                        className="flex flex-wrap gap-4 justify-center"
                    >
                        <CTAButtons buttons={ctaButtons} variant="glass" />
                    </motion.div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Slideshow Variant ───────────────────────────────────────────────────
    if (variant === 'slideshow') {
        return <SlideshowHero
            headline={headline}
            subheadline={subheadline}
            ctaButtons={ctaButtons}
            badge={badge}
            image={image}
            images={images}
            fallbackHeroUrl={fallbackHeroUrl}
        />
    }

    // ── Split Video Variant ─────────────────────────────────────────────────
    if (variant === 'split-video') {
        return <SplitVideoHero
            headline={headline}
            subheadline={subheadline}
            ctaButtons={ctaButtons}
            badge={badge}
            videoUrl={videoUrl}
            primaryColor={theme.primaryColor}
        />
    }

    // ── Default: Centered Variant ────────────────────────────────────────────
    return (
        <AnimatedSection
            className="relative min-h-[92vh] flex items-center overflow-hidden"
        >
            {/* Multi-layer background */}
            <div className="absolute inset-0" style={{
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(var(--brand-primary-rgb), 0.094) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(var(--brand-primary-rgb), 0.063) 0%, transparent 50%)
                `,
            }} />
            <DotGrid color={theme.primaryColor} />
            <GradientBlob color={theme.primaryColor} className="top-[-20%] left-[10%]" size={600} opacity={0.1} />
            <GradientBlob color={theme.primaryColor} className="bottom-[-10%] right-[5%]" size={400} opacity={0.08} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                    {badge?.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                        >
                            <SectionLabel color={theme.primaryColor}>{badge.text}</SectionLabel>
                        </motion.div>
                    )}

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6"
                    >
                        {headline}
                    </motion.h1>

                    {subheadline && (
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.15 }}
                            className="text-xl opacity-60 mb-10 max-w-2xl mx-auto leading-relaxed"
                        >
                            {subheadline}
                        </motion.p>
                    )}

                    {ctaButtons.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="flex flex-wrap gap-4 justify-center"
                        >
                            <CTAButtons buttons={ctaButtons} />
                        </motion.div>
                    )}

                    {/* Hero image — only show if user uploaded an image */}
                    {image?.url && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="mt-16 relative max-w-4xl mx-auto group"
                        >
                            <img
                                src={image.url}
                                alt={image.alt || headline}
                                className="w-full rounded-2xl object-cover"
                            />
                            {/* Gradient overlay for polish */}
                            <div
                                className="absolute inset-0 rounded-2xl pointer-events-none"
                                style={{
                                    background: `linear-gradient(180deg, transparent 60%, rgba(var(--brand-primary-rgb), 0.082) 100%)`,
                                    boxShadow: `0 25px 60px rgba(var(--brand-primary-rgb), 0.125), 0 8px 24px rgba(0,0,0,0.3)`,
                                    borderRadius: 'inherit',
                                }}
                            />
                        </motion.div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}

// ── Slideshow Sub-component (needs hooks) ────────────────────────────────────
function SlideshowHero({
    headline, subheadline, ctaButtons = [], badge, image, images = [], fallbackHeroUrl,
}: {
    headline: string
    subheadline?: string
    ctaButtons?: HeroConfig['ctaButtons']
    badge?: HeroConfig['badge']
    image?: HeroConfig['image']
    images?: HeroConfig['images']
    fallbackHeroUrl: string
}) {
    // Build slides array: use images[] if available, fall back to single image
    const slides = (images && images.length > 0)
        ? images
        : image?.url
            ? [image]
            : [{ url: fallbackHeroUrl, alt: headline }]

    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (slides.length <= 1) return
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [slides.length])

    return (
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            {/* Image layers with crossfade */}
            {slides.map((slide, i) => (
                <div
                    key={i}
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                    style={{
                        backgroundImage: `url(${slide.url})`,
                        opacity: i === currentIndex ? 1 : 0,
                    }}
                />
            ))}
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/50" />

            <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
                {badge?.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
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
                    </motion.div>
                )}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="text-5xl md:text-7xl font-bold font-heading leading-[1.05] mb-6 text-white"
                >
                    {headline}
                </motion.h1>
                {subheadline && (
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        {subheadline}
                    </motion.p>
                )}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.25 }}
                    className="flex flex-wrap gap-4 justify-center"
                >
                    <CTAButtons buttons={ctaButtons} variant="glass" />
                </motion.div>

                {/* Dot indicators */}
                {slides.length > 1 && (
                    <div className="flex gap-2 justify-center mt-10">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    background: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                                    transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                                }}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AnimatedSection>
    )
}

// ── Split Video Sub-component (needs hooks) ──────────────────────────────────
function SplitVideoHero({
    headline, subheadline, ctaButtons = [], badge, videoUrl, primaryColor,
}: {
    headline: string
    subheadline?: string
    ctaButtons?: HeroConfig['ctaButtons']
    badge?: HeroConfig['badge']
    videoUrl?: string
    primaryColor: string
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(true)

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
        <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
            <GradientBlob color={primaryColor} className="top-[-10%] right-[-5%]" size={600} opacity={0.12} />
            <GradientBlob color={primaryColor} className="bottom-[-15%] left-[-8%]" size={500} opacity={0.08} />
            <DotGrid color={primaryColor} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    {/* Left — Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {badge?.show && (
                            <SectionLabel color={primaryColor}>{badge.text}</SectionLabel>
                        )}
                        <h1 className="text-5xl lg:text-6xl font-bold font-heading leading-[1.1] mb-6">
                            {headline}
                        </h1>
                        {subheadline && (
                            <p className="text-xl opacity-60 mb-10 max-w-lg leading-relaxed">{subheadline}</p>
                        )}
                        <CTAButtons buttons={ctaButtons} />
                    </motion.div>

                    {/* Right — Video */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative"
                    >
                        {videoUrl ? (
                            <div className="relative rounded-2xl overflow-hidden"
                                style={{
                                    boxShadow: `0 25px 50px rgba(var(--brand-primary-rgb), 0.082), 0 10px 20px rgba(0,0,0,0.2)`,
                                }}
                            >
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    className="w-full h-auto aspect-video object-cover"
                                />
                                {/* Play/Pause toggle */}
                                <button
                                    onClick={togglePlayback}
                                    className="absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                        background: 'rgba(0,0,0,0.5)',
                                        backdropFilter: 'blur(8px)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                    }}
                                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                                >
                                    {isPlaying ? (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                            <rect x="2" y="1" width="3.5" height="12" rx="1" />
                                            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                            <path d="M3 1.5v11l9-5.5L3 1.5z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div
                                className="w-full aspect-video rounded-2xl flex items-center justify-center"
                                style={{
                                    background: `rgba(var(--brand-primary-rgb), 0.05)`,
                                    border: `2px dashed rgba(var(--brand-primary-rgb), 0.2)`,
                                }}
                            >
                                <p className="opacity-40 text-sm">No video URL provided</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </AnimatedSection>
    )
}
