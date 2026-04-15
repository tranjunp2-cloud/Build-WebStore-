'use client'

import type { BlockProps } from '../types'
import type { CTAConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { motion, useReducedMotion } from 'framer-motion'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { trackEvent } from '@/lib/analytics/track-event'

const CTA_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function CTAButton({ label, url, style, variant, siteId }: { label: string; url: string; style: 'primary' | 'outline'; variant: string; siteId?: string }) {
    const shouldReduce = useReducedMotion()
    const isPrimary = style === 'primary'

    const buttonStyle = isPrimary
        ? variant === 'banner'
            ? { background: '#ffffff', color: CSS_VARS.primary, borderRadius: CSS_VARS.radiusMd }
            : { background: CSS_VARS.primary, color: '#ffffff', borderRadius: CSS_VARS.radiusMd, boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb), 0.25)' }
        : { border: '2px solid rgba(var(--brand-primary-rgb), 0.3)', color: CSS_VARS.primary, background: 'transparent', borderRadius: CSS_VARS.radiusMd }

    const btnCls = `inline-flex items-center justify-center px-8 py-3.5 font-semibold text-sm transition-colors ${TOUCH_TARGET.min}`

    const handleClick = () => {
        if (siteId) trackEvent({ siteId, event: 'click', metadata: { label, url, variant } })
    }

    if (shouldReduce) {
        return (
            <a href={url} rel="noopener noreferrer" onClick={handleClick} className={`${btnCls} hover:opacity-90`} style={buttonStyle}>
                <RichText text={label} as="span" />
            </a>
        )
    }

    return (
        <motion.a
            href={url}
            rel="noopener noreferrer"
            onClick={handleClick}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className={btnCls}
            style={buttonStyle}
        >
            {label}
        </motion.a>
    )
}

function BannerVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection
            className="py-16 md:py-20"
            style={{
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                color: '#ffffff',
            }}
        >
            <div className={`${CTA_CONTAINER} text-center max-w-3xl`}>
                <Heading level={2} className="mb-4 leading-tight">
                    <RichText text={headline} as="span" />
                </Heading>
                {subheadline && (
                    <Body size="lg" className="opacity-85 mb-8 max-w-xl mx-auto">
                        <RichText text={subheadline} as="span" />
                    </Body>
                )}
                <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="banner" siteId={siteId} />
            </div>
        </AnimatedSection>
    )
}

function InlineVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection className="py-12 md:py-16" style={{ color: CSS_VARS.text, background: CSS_VARS.surface }}>
            <div className={CTA_CONTAINER}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
                    <div className="flex-1 text-center md:text-left">
                        <Heading level={3} className="mb-2">
                            <RichText text={headline} as="span" />
                        </Heading>
                        {subheadline && (
                            <Body style={{ color: CSS_VARS.muted }}>
                                <RichText text={subheadline} as="span" />
                            </Body>
                        )}
                    </div>
                    <div className="flex-shrink-0">
                        <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="inline" siteId={siteId} />
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}

function FloatingVariant({ block, siteId }: { block: CTAConfig; siteId?: string }) {
    const { headline, subheadline, ctaLabel, ctaUrl, ctaStyle = 'primary' } = block
    return (
        <AnimatedSection className="py-16 md:py-20" style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className={CTA_CONTAINER}>
                <div
                    className="max-w-xl mx-auto text-center p-10 md:p-12"
                    style={{
                        background: CSS_VARS.surface,
                        borderRadius: CSS_VARS.radiusLg,
                        boxShadow: CSS_VARS.shadowLg,
                        border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                    }}
                >
                    <Heading level={3} className="mb-3">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body className="mb-8" style={{ color: CSS_VARS.muted }}>
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                    <CTAButton label={ctaLabel} url={ctaUrl} style={ctaStyle} variant="floating" siteId={siteId} />
                </div>
            </div>
        </AnimatedSection>
    )
}

export function CTABlock({ block, site }: BlockProps<CTAConfig>) {
    const { variant = 'banner' } = block
    const siteId = site?.id ? String(site.id) : undefined

    switch (variant) {
        case 'inline':
            return <InlineVariant block={block} siteId={siteId} />
        case 'floating':
            return <FloatingVariant block={block} siteId={siteId} />
        case 'banner':
        default:
            return <BannerVariant block={block} siteId={siteId} />
    }
}
