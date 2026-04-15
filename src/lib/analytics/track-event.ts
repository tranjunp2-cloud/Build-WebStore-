/**
 * Fire-and-forget analytics event from storefront client components.
 * Reuses the same session + endpoint as TrackingManager (pageview).
 */
export function trackEvent(params: {
    siteId: string
    event: 'click' | 'add_to_cart' | 'checkout' | 'purchase'
    pageUrl?: string
    metadata?: Record<string, unknown>
}) {
    // Skip tracking in editor/preview mode
    const path = window.location.pathname
    if (path.startsWith('/preview/') || path.startsWith('/builder/')) return

    const sessionId = (() => {
        try {
            let id = sessionStorage.getItem('pw-session') || ''
            if (!id) {
                id = crypto.randomUUID()
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
