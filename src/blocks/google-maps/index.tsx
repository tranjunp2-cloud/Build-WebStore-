'use client'

import type { BlockProps } from '../types'
import type { GoogleMapsConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

export function GoogleMapsBlock({ block, theme }: BlockProps<GoogleMapsConfig>) {
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
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    <div
                        className="max-w-4xl mx-auto rounded-2xl overflow-hidden border shadow-sm"
                        style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.125)` }}
                    >
                        {headline && (
                            <div className="p-6 pb-0">
                                <RichText text={headline} as="h2" className="text-2xl font-bold font-heading" />
                            </div>
                        )}
                        <div className="p-6">
                            {mapIframe}
                        </div>
                        {address && (
                            <div className="px-6 pb-6 flex items-start gap-3">
                                <span style={{ color: 'var(--brand-primary)' }} className="text-lg mt-0.5">📍</span>
                                <p className="text-sm opacity-70">{address}</p>
                            </div>
                        )}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // Full-width variant
    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <div className="text-center mb-10">
                        <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />
                        {address && <p className="text-lg opacity-70">{address}</p>}
                    </div>
                )}
                <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.125)` }}>
                    {mapIframe}
                </div>
                {!headline && address && (
                    <p className="text-center text-sm opacity-70 mt-4">{address}</p>
                )}
            </div>
        </AnimatedSection>
    )
}
