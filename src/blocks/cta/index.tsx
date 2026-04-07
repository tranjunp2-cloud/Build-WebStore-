'use client'

import type { BlockProps } from '../types'
import type { CTAConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion, useReducedMotion } from 'framer-motion'

function CTAButton({ label, url, style, variant }: { label: string; url: string; style: 'primary' | 'outline'; variant: string }) {
    const shouldReduce = useReducedMotion()
    const isPrimary = style === 'primary'

    const buttonStyle = isPrimary
        ? variant === 'banner'
            ? { background: '#ffffff', color: 'var(--brand-primary)', borderRadius: 'var(--radius-md)' }
            : { background: 'var(--brand-primary)', color: '#ffffff', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb), 0.25)' }
        : { border: '2px solid rgba(var(--brand-primary-rgb), 0.3)', color: 'var(--brand-primary)', background: 'transparent', borderRadius: 'var(--radius-md)' }

    if (shouldReduce) {
        return (
            <a href={url} rel="noopener noreferrer" className="inline-block px-8 py-3.5 font-semibold text-sm transition-colors hover:opacity-90" style={buttonStyle}>
                {label}
            </a>
        )
    }

    return (
        <motion.a
            href={url}
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-block px-8 py-3.5 font-semibold text-sm transition-colors"
            style={buttonStyle}
        >
            {label}
        </motion.a>
    )
}

function BannerVariant({ block }: { block: CTAConfig }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection
            className="py-16 md:py-20"
            style={{
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                color: '#ffffff',
            }}
        >
            <div className="container mx-auto px-6 text-center max-w-3xl">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                    {headline}
                </h2>
                {subheadline && (
                    <p className="text-lg opacity-85 mb-8 max-w-xl mx-auto">{subheadline}</p>
                )}
                <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="banner" />
            </div>
        </AnimatedSection>
    )
}

function InlineVariant({ block }: { block: CTAConfig }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection className="py-12 md:py-16" style={{ color: 'var(--text)', background: 'var(--surface)' }}>
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                            {headline}
                        </h2>
                        {subheadline && <p style={{ color: 'var(--muted)' }}>{subheadline}</p>}
                    </div>
                    <div className="flex-shrink-0">
                        <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="inline" />
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

function FloatingVariant({ block }: { block: CTAConfig }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: 'var(--text)', background: 'var(--background)' }}>
            <div className="container mx-auto px-6">
                <div
                    className="max-w-xl mx-auto text-center p-10 md:p-12"
                    style={{
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-lg)',
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                    }}
                >
                    <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
                        {headline}
                    </h2>
                    {subheadline && (
                        <p className="mb-8" style={{ color: 'var(--muted)' }}>{subheadline}</p>
                    )}
                    <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="floating" />
                </div>
            </div>
        </AnimatedSection>
    )
}

export function CTABlock({ block }: BlockProps<CTAConfig>) {
    const { variant = 'banner' } = block

    switch (variant) {
        case 'inline':
            return <InlineVariant block={block} />
        case 'floating':
            return <FloatingVariant block={block} />
        case 'banner':
        default:
            return <BannerVariant block={block} />
    }
}
