type MediaWithUrl = {
    url?: unknown
}

function getImageUrl(candidate: unknown): string | null {
    if (typeof candidate === 'string') {
        const url = candidate.trim()
        return url || null
    }

    if (!candidate || typeof candidate !== 'object') return null

    const url = (candidate as MediaWithUrl).url
    if (typeof url !== 'string') return null

    const normalizedUrl = url.trim()
    return normalizedUrl || null
}

export function resolveMetadataImageUrl(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
        const url = getImageUrl(candidate)
        if (url) return url
    }

    return null
}
