/**
 * GH-2062 — parse a user-supplied video link into a safe, renderable descriptor.
 * Pure (no server-only) so the editor panel validates with the exact same rules
 * the block renderer uses. Allowlist only: YouTube, Vimeo, or a direct mp4/webm file.
 */

export type ParsedVideo =
    | { kind: 'youtube'; id: string; embedUrl: string }
    | { kind: 'vimeo'; id: string; hash?: string; embedUrl: string }
    | { kind: 'file'; embedUrl: string }

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^\d{1,12}$/
const VIMEO_HASH = /^[A-Za-z0-9]{6,32}$/
const FILE_EXT = /\.(mp4|webm)$/i

function parseYoutubeId(url: URL): string | null {
    const segments = url.pathname.split('/').filter(Boolean)
    let candidate: string | null | undefined
    if (url.hostname === 'youtu.be') candidate = segments[0]
    else if (segments[0] === 'watch') candidate = url.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')) candidate = segments[1]
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : null
}

// Unlisted Vimeo videos need the privacy hash: vimeo.com/ID/HASH, player.vimeo.com/video/ID?h=HASH.
function parseVimeo(url: URL): { id: string; hash?: string } | null {
    const segments = url.pathname.split('/').filter(Boolean)
    const isPlayer = url.hostname === 'player.vimeo.com'
    if (isPlayer && segments[0] !== 'video') return null
    const id = isPlayer ? segments[1] : segments[0]
    if (!id || !VIMEO_ID.test(id)) return null
    const candidate = (isPlayer ? undefined : segments[1]) ?? url.searchParams.get('h') ?? undefined
    return { id, hash: candidate && VIMEO_HASH.test(candidate) ? candidate : undefined }
}

/** Returns null for anything that is not an allowed https video link or mp4/webm file. */
export function parseVideoUrl(raw: unknown): ParsedVideo | null {
    if (typeof raw !== 'string') return null
    const value = raw.trim()
    if (!value) return null

    // Internal media path (e.g. proxied upload) — must be a single-slash path to a video file.
    if (value.startsWith('/') && !value.startsWith('//')) {
        return FILE_EXT.test(value.split(/[?#]/)[0]) ? { kind: 'file', embedUrl: value } : null
    }

    let url: URL
    try {
        url = new URL(value)
    } catch {
        return null
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

    const host = url.hostname.toLowerCase()
    if (url.protocol === 'https:' && YOUTUBE_HOSTS.has(host)) {
        const id = parseYoutubeId(url)
        return id ? { kind: 'youtube', id, embedUrl: `https://www.youtube.com/embed/${id}` } : null
    }
    if (url.protocol === 'https:' && VIMEO_HOSTS.has(host)) {
        const vimeo = parseVimeo(url)
        if (!vimeo) return null
        const base = `https://player.vimeo.com/video/${vimeo.id}`
        return { kind: 'vimeo', ...vimeo, embedUrl: vimeo.hash ? `${base}?h=${vimeo.hash}` : base }
    }
    // Direct file: uploaded S3 media (https in prod, http on local dev storage).
    if (FILE_EXT.test(url.pathname)) return { kind: 'file', embedUrl: url.toString() }
    return null
}

/** Autoplay/muted/loop params for the background variant (iframe providers only). */
export function buildBackgroundEmbedUrl(parsed: Extract<ParsedVideo, { kind: 'youtube' | 'vimeo' }>): string {
    if (parsed.kind === 'youtube') {
        return `${parsed.embedUrl}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&modestbranding=1&playlist=${parsed.id}`
    }
    return `${parsed.embedUrl}${parsed.embedUrl.includes('?') ? '&' : '?'}autoplay=1&muted=1&loop=1&background=1`
}
