import { createHash } from 'node:crypto'

/** Every absolute http(s) string in the adapted PW1 contract: the candidates the migration downloaded (and hashed) as image sources. */
export function sourceUrls(value: unknown, found = new Set<string>()): Set<string> {
    if (typeof value === 'string') { if (/^https?:\/\//i.test(value)) found.add(value) }
    else if (Array.isArray(value)) for (const item of value) sourceUrls(item, found)
    else if (value && typeof value === 'object') for (const item of Object.values(value)) sourceUrls(item, found)
    return found
}

export const sourceHash = (url: string) => createHash('sha256').update(url).digest('hex')
/** Names the migration gave the stored copy of a source image (see downloadAndStorePw1Media). */
export const pw1MediaFilename = (tenantId: number | string, url: string) => `pw1-${tenantId}-${sourceHash(url).slice(0, 20)}.jpg`
export const pw1PlaceholderFilename = (tenantId: number | string, url: string) => pw1MediaFilename(tenantId, url).replace(/\.jpg$/, '-placeholder.jpg')

export type PlaceholderMedia = { id: number; filename: string }
export type PlaceholderCandidate = { url: string; placeholder: PlaceholderMedia }

/** Source URLs whose stored media is still the neutral placeholder (found by the placeholder filename, which encodes the URL hash). */
export function placeholderCandidates(urls: Iterable<string>, tenantId: number | string, placeholders: PlaceholderMedia[]): PlaceholderCandidate[] {
    const byName = new Map(placeholders.map(media => [media.filename, media]))
    return [...urls].flatMap(url => {
        const placeholder = byName.get(pw1PlaceholderFilename(tenantId, url))
        return placeholder ? [{ url, placeholder }] : []
    })
}
