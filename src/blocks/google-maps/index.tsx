'use client'

import type { BlockProps } from '../types'
import type { GoogleMapsConfig } from './config'

export function GoogleMapsBlock({ block, theme }: BlockProps<GoogleMapsConfig>) {
    const { variant = 'full-width', embedUrl, headline, address, height = 400 } = block
    const pc = theme.primaryColor

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
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div
                        className="max-w-4xl mx-auto rounded-2xl overflow-hidden border shadow-sm"
                        style={{ borderColor: `${pc}20` }}
                    >
                        {headline && (
                            <div className="p-6 pb-0">
                                <h2 className="text-2xl font-bold font-heading">{headline}</h2>
                            </div>
                        )}
                        <div className="p-6">
                            {mapIframe}
                        </div>
                        {address && (
                            <div className="px-6 pb-6 flex items-start gap-3">
                                <span style={{ color: pc }} className="text-lg mt-0.5">📍</span>
                                <p className="text-sm opacity-70">{address}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        )
    }

    // Full-width variant
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <div className="text-center mb-10">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline}</h2>
                        {address && <p className="text-lg opacity-70">{address}</p>}
                    </div>
                )}
                <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: `${pc}20` }}>
                    {mapIframe}
                </div>
                {!headline && address && (
                    <p className="text-center text-sm opacity-70 mt-4">{address}</p>
                )}
            </div>
        </section>
    )
}
