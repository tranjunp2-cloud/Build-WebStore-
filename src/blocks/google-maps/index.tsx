'use client'

import type { BlockProps } from '../types'
import type { GoogleMapsConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

void _CSS_VARS

export function GoogleMapsBlock({ block, theme: _theme }: BlockProps<GoogleMapsConfig>) {
    void _theme
    const { variant = 'full-width', embedUrl, headline, address, height = 400 } = block

    const mapIframe = (
        <iframe
            src={embedUrl}
            width="100%"
            height={height}
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="rounded-2xl"
            title={headline || 'Google Maps'}
        />
    )

    if (variant === 'card') {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent">
                <div
                    className="max-w-4xl mx-auto rounded-2xl overflow-hidden border shadow-sm"
                    style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.125)` }}
                >
                    {headline && (
                        <div className="p-6 pb-0">
                            <Heading level={3}>
                                <RichText text={headline} as="span" />
                            </Heading>
                        </div>
                    )}
                    <div className="p-6">
                        {mapIframe}
                    </div>
                    {address && (
                        <div className="px-6 pb-6 flex items-start gap-3">
                            <span style={{ color: 'var(--brand-primary)' }} className="text-lg mt-0.5" aria-hidden="true">📍</span>
                            <Body size="small" className="opacity-70">{address}</Body>
                        </div>
                    )}
                </div>
            </SectionWrapper>
        )
    }

    // Full-width variant
    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent">
            {headline && (
                <div className="text-center mb-10">
                    <Heading level={2} className="mb-4">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {address && <Body size="lg" className="opacity-70">{address}</Body>}
                </div>
            )}
            <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.125)` }}>
                {mapIframe}
            </div>
            {!headline && address && (
                <Body size="small" className="text-center opacity-70 mt-4">{address}</Body>
            )}
        </SectionWrapper>
    )
}
