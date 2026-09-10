import createDOMPurify from 'dompurify'

/** Preserve CKEditor document structure; embeds are restricted to video providers. */
export function sanitizeRichTextHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    for (const frame of doc.querySelectorAll('iframe')) {
        let allowed = false
        try {
            const url = new URL(frame.getAttribute('src') || '')
            allowed = url.protocol === 'https:' && !url.username && !url.password
                && ((['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname) && /^\/embed\/[\w-]+$/.test(url.pathname))
                    || (url.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(url.pathname)))
        } catch { allowed = false }
        if (!allowed) { frame.remove(); continue }
        frame.setAttribute('title', frame.getAttribute('title') || 'Embedded video')
        frame.setAttribute('loading', 'lazy')
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    }
    const purifier = createDOMPurify(window)
    return purifier.sanitize(doc.body.innerHTML, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'referrerpolicy'] })
}
