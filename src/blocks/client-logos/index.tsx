'use client'

import type { BlockProps } from '../types'
import type { ClientLogosConfig, LogoItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, CARD_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

const CL_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function LogoImage({ logo, className }: { logo: LogoItem; className?: string }) {
    const img = (
        <img
            src={logo?.url}
            alt={logo?.alt}
            className={`h-10 md:h-12 w-auto object-contain ${className || ''}`}
            loading="lazy"
        />
    )
    if (logo.linkUrl) {
        return (
            <a href={logo.linkUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                {img}
            </a>
        )
    }
    return <span className="flex-shrink-0">{img}</span>
}

function CLHeadline({ text }: { text?: string }) {
    if (!text) return null
    return (
        <Heading level={4} className="text-center mb-12 opacity-60">
            <RichText text={text} as="span" />
        </Heading>
    )
}

export function ClientLogosBlock({ block, theme: _theme }: BlockProps<ClientLogosConfig>) {
    void _theme
    const { headline, logos = [], variant = 'scroll' } = block

    if (variant === 'grid') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={CL_CONTAINER}>
                    <CLHeadline text={headline} />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-items-center max-w-5xl mx-auto">
                        {logos.map((logo, i) => (
                            <div key={i} className={`${CARD_PADDING.sm} rounded-xl border flex items-center justify-center w-full`} style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                                <LogoImage logo={logo} />
                            </div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    if (variant === 'fade') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={CL_CONTAINER}>
                    <CLHeadline text={headline} />
                    <div className="flex flex-wrap items-center justify-center gap-10 max-w-5xl mx-auto">
                        {logos.map((logo, i) => (
                            <div key={i} className="opacity-40 hover:opacity-100 transition-opacity duration-300">
                                <LogoImage logo={logo} />
                            </div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // Default: scroll (infinite marquee)
    const duplicatedLogos = [...logos, ...logos]
    return (
        <AnimatedSection className={`${SECTION_PADDING.default} overflow-hidden`}>
            <div className={CL_CONTAINER}>
                <CLHeadline text={headline} />
            </div>
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-24 z-10" style={{ background: 'linear-gradient(to right, var(--background, #09090b), transparent)' }} />
                <div className="absolute right-0 top-0 bottom-0 w-24 z-10" style={{ background: 'linear-gradient(to left, var(--background, #09090b), transparent)' }} />
                <div className="flex items-center gap-12 animate-marquee">
                    {duplicatedLogos.map((logo, i) => (
                        <div key={i} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                            <LogoImage logo={logo} />
                        </div>
                    ))}
                </div>
            </div>
            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 30s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </AnimatedSection>
    )
}
