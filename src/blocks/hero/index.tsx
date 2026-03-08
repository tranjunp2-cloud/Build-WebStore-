'use client'

import type { BlockProps } from '../types'
import type { HeroConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion } from 'framer-motion'
import { GradientBlob, DotGrid, SectionLabel } from '../shared/decorative'

export function HeroBlock({ block, theme }: BlockProps<HeroConfig>) {
    const { variant = 'centered', headline, subheadline, ctaButtons = [], image, badge } = block
    const pc = theme.primaryColor

    // ── Split Variant ──────────────────────────────────────────────────────
    if (variant === 'split') {
        return (
            <AnimatedSection className="relative min-h-[92vh] flex items-center overflow-hidden">
                {/* Background decorations */}
                <GradientBlob color={pc} className="top-[-10%] right-[-5%]" size={600} opacity={0.12} />
                <GradientBlob color={pc} className="bottom-[-15%] left-[-8%]" size={500} opacity={0.08} />
                <DotGrid color={pc} />

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
                                <SectionLabel color={pc}>{badge.text}</SectionLabel>
                            )}
                            <h1 className="text-5xl lg:text-6xl font-bold font-heading leading-[1.1] mb-6">
                                {headline}
                            </h1>
                            {subheadline && (
                                <p className="text-xl opacity-60 mb-10 max-w-lg leading-relaxed">{subheadline}</p>
                            )}
                            <div className="flex flex-wrap gap-4">
                                {ctaButtons.map((btn, i) => (
                                    <motion.a
                                        key={i}
                                        href={btn.url}
                                        whileHover={{ scale: 1.03, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                                        style={btn.style === 'outline'
                                            ? {
                                                border: `2px solid ${pc}50`,
                                                color: pc,
                                                background: `${pc}08`,
                                            }
                                            : {
                                                background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
                                                color: '#fff',
                                                boxShadow: `0 8px 30px ${pc}35`,
                                            }}
                                    >
                                        {btn.label}
                                    </motion.a>
                                ))}
                            </div>
                        </motion.div>

                        {/* Right — Image / Illustration placeholder */}
                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative"
                        >
                            {image?.url ? (
                                <img src={image.url} alt={image.alt || headline}
                                    className="w-full h-auto rounded-3xl shadow-2xl" />
                            ) : (
                                /* Decorative placeholder — abstract shapes */
                                <div
                                    className="aspect-[4/3] rounded-3xl flex items-center justify-center overflow-hidden relative"
                                    style={{
                                        background: `linear-gradient(135deg, ${pc}12, ${pc}05)`,
                                        border: `1px solid ${pc}15`,
                                    }}
                                >
                                    <div className="absolute inset-0" style={{
                                        background: `
                                            radial-gradient(circle at 30% 40%, ${pc}20 0%, transparent 50%),
                                            radial-gradient(circle at 70% 60%, ${pc}15 0%, transparent 40%)
                                        `,
                                    }} />
                                    <div className="relative text-center p-8">
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                            style={{ background: `${pc}15`, border: `1px solid ${pc}25` }}>
                                            <span className="text-3xl">✨</span>
                                        </div>
                                        <p className="text-sm opacity-40">Business image</p>
                                    </div>
                                </div>
                            )}
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
                <GradientBlob color={pc} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={500} opacity={0.06} />
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
                                        ? { border: `2px solid ${pc}50`, color: pc }
                                        : { background: pc, color: '#fff', boxShadow: `0 4px 20px ${pc}30` }}
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

    // ── Default: Centered Variant ────────────────────────────────────────────
    return (
        <AnimatedSection
            className="relative min-h-[92vh] flex items-center overflow-hidden"
        >
            {/* Multi-layer background */}
            <div className="absolute inset-0" style={{
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, ${pc}18 0%, transparent 60%),
                    radial-gradient(ellipse 60% 40% at 80% 80%, ${pc}10 0%, transparent 50%)
                `,
            }} />
            <DotGrid color={pc} />
            <GradientBlob color={pc} className="top-[-20%] left-[10%]" size={600} opacity={0.1} />
            <GradientBlob color={pc} className="bottom-[-10%] right-[5%]" size={400} opacity={0.08} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                    {badge?.show && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                        >
                            <SectionLabel color={pc}>{badge.text}</SectionLabel>
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
                            {ctaButtons.map((btn, i) => (
                                <motion.a
                                    key={i}
                                    href={btn.url}
                                    whileHover={{ scale: 1.04, y: -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                                    style={btn.style === 'outline'
                                        ? {
                                            border: `2px solid ${pc}50`,
                                            color: pc,
                                            background: `${pc}08`,
                                        }
                                        : {
                                            background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
                                            color: '#fff',
                                            boxShadow: `0 8px 30px ${pc}35`,
                                        }}
                                >
                                    {btn.label}
                                </motion.a>
                            ))}
                        </motion.div>
                    )}

                    {/* Decorative image placeholder or real image */}
                    {image?.url && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="mt-16"
                        >
                            <img src={image.url} alt={image.alt || headline}
                                className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl" />
                        </motion.div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
