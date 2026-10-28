import { uuid } from '@/lib/uuid'

/**
 * Fire-and-forget analytics event from storefront client components.
 * Reuses the same session + endpoint as TrackingManager (pageview).
 */
export function trackEvent(params: {
    siteId: string
    event: 'click' | 'add_to_cart' | 'checkout' | 'purchase' | 'local_business_data_saved'
    pageUrl?: string
    metadata?: Record<string, unknown>
    isOwner?: boolean
}) {
    // Skip tracking for owner visits and editor/preview mode
    if (params.isOwner) return
    const path = window.location.pathname
    if (path.startsWith('/preview/') || path.startsWith('/builder/')) return

    const sessionId = (() => {
        try {
            let id = sessionStorage.getItem('pw-session') || ''
            if (!id) {
                id = uuid()
                sessionStorage.setItem('pw-session', id)
            }
            return id
        } catch { return '' }
    })()

    fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            siteId: params.siteId,
            event: params.event,
            pageUrl: params.pageUrl || window.location.pathname,
            referrer: document.referrer || '',
            sessionId,
            metadata: params.metadata,
        }),
    }).catch(() => {})
}
