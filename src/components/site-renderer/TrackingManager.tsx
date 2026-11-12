'use client'

import { useEffect, useRef } from 'react'
import { uuid } from '@/lib/uuid'

interface TrackingManagerProps {
    siteId: string
    isOwner?: boolean
    // F22: extensible — thêm trackingSettings khi implement GA4/FB/TikTok
    // trackingSettings?: {
    //     ga4?: { id: string; isEnabled: boolean }
    //     fbPixel?: { id: string; isEnabled: boolean }
    //     tiktokPixel?: { id: string; isEnabled: boolean }
    // }
}

export function TrackingManager({ siteId, isOwner }: TrackingManagerProps) {
    const tracked = useRef(false)

    // ── Internal pageview tracking ──
    useEffect(() => {
        if (isOwner || tracked.current || !siteId) return
        tracked.current = true

        let sessionId = ''
        try {
            sessionId = sessionStorage.getItem('pw-session') || ''
            if (!sessionId) {
                sessionId = uuid()
                sessionStorage.setItem('pw-session', sessionId)
            }
        } catch { /* private browsing */ }

        // Strip /sites/{slug} prefix so direct-access and subdomain URLs normalize to the same path
        const pageUrl = window.location.pathname.replace(/^\/sites\/[^/]+/, '') || '/'

        fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                event: 'pageview',
                pageUrl,
                referrer: document.referrer || '',
                sessionId,
            }),
        }).catch(() => {})
    }, [siteId, isOwner])

    // ── F22: External pixel scripts (future) ──
    // Khi implement F22, thêm logic ở đây:
    // if (trackingSettings?.ga4?.isEnabled) → render <GoogleAnalytics gaId={...} />
    // if (trackingSettings?.fbPixel?.isEnabled) → render <Script>fbq(...)</Script>
    // if (trackingSettings?.tiktokPixel?.isEnabled) → render <Script>ttq(...)</Script>

    return null
}
