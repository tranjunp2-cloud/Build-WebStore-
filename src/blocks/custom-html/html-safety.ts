import createDOMPurify from 'dompurify'

export function mediaEmbedUrl(value: string): string | null {
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:') return null
        const host = url.hostname.toLowerCase()
        if (host === 'youtu.be') return `https://www.youtube.com/embed/${encodeURIComponent(url.pathname.slice(1))}`
        if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
            const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
            return id && /^[\w-]+$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
        }
        if (host === 'vimeo.com' && /^\/\d+$/.test(url.pathname)) return `https://player.vimeo.com/video${url.pathname}`
        if (host === 'player.vimeo.com' && /^\/video\/\d+/.test(url.pathname)) return url.href
        if (host === 'w.soundcloud.com' && url.pathname === '/player/') return url.href
        if (host === 'www.dailymotion.com' && url.pathname.startsWith('/embed/video/')) return url.href
        if (host === 'open.spotify.com' && url.pathname.startsWith('/embed/')) return url.href
    } catch { return null }
    return null
}

/** Shared editor/public boundary: preserve trusted media, never arbitrary active HTML. */
export function sanitizeRichHtml(html: string): string {
    const purifier = createDOMPurify(window)
    purifier.addHook('afterSanitizeAttributes', node => {
        if (node.nodeName !== 'IFRAME') return
        const el = node as Element
        const url = mediaEmbedUrl(el.getAttribute('src') || '')
        if (!url) { el.remove(); return }
        el.setAttribute('src', url)
        el.removeAttribute('srcdoc')
        el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
        el.setAttribute('loading', 'lazy')
        el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
        el.setAttribute('allowfullscreen', '')
    })
    return purifier.sanitize(html, { ADD_TAGS: ['iframe', 'oembed'], ADD_ATTR: ['url', 'allowfullscreen', 'sandbox', 'loading', 'referrerpolicy'] })
}
