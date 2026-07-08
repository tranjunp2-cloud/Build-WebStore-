'use client'

import { cn } from '@/lib/utils'

interface MapsEmbedPreviewProps {
    latitude?: number
    longitude?: number
    fullWidth?: boolean
    title: string
}

/** F37 US-01: read-only Google Maps embed (no API key needed, `output=embed`).
 *  Net-new — intentionally NOT reusing `src/blocks/google-maps/` (storefront
 *  block, different concern). Renders only when both coordinates are valid
 *  numbers (Key Insights, phase-03 plan). */
export function MapsEmbedPreview({ latitude, longitude, fullWidth, title }: MapsEmbedPreviewProps) {
    const hasValidCoords = typeof latitude === 'number' && typeof longitude === 'number'
        && Number.isFinite(latitude) && Number.isFinite(longitude)

    if (!hasValidCoords) return null

    return (
        <div className={cn('overflow-hidden rounded-lg border border-white/10', fullWidth ? 'h-[140px]' : 'h-[160px]')}>
            <iframe
                title={title}
                src={`https://www.google.com/maps?q=${latitude},${longitude}&output=embed`}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
            />
        </div>
    )
}
