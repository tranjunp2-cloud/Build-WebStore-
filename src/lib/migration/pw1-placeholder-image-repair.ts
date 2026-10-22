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

/** An older migrate build stored the neutral placeholder under the plain media name (no `-placeholder` suffix); it is told apart by its exact 960x640 size and byte count. `$1` is `pw1-<tenant>-%`. */
export const PLACEHOLDER_MEDIA_WHERE = `filename LIKE $1 AND (filename LIKE '%-placeholder.jpg' OR (width = 960 AND height = 640 AND filesize = 9447))`
export const placeholderMediaPattern = (tenantId: number | string) => `pw1-${tenantId}-%`
/** The names a placeholder for this source URL can have, newest naming first. */
export const pw1PlaceholderNames = (tenantId: number | string, url: string) => [pw1PlaceholderFilename(tenantId, url), pw1MediaFilename(tenantId, url)]

export type PlaceholderMedia = { id: number; filename: string }
export type PlaceholderCandidate = { url: string; placeholder: PlaceholderMedia }

/** Source URLs whose stored media is still the neutral placeholder (found by the filename, which encodes the URL hash; the rows come from `PLACEHOLDER_MEDIA_WHERE`). */
export function placeholderCandidates(urls: Iterable<string>, tenantId: number | string, placeholders: PlaceholderMedia[]): PlaceholderCandidate[] {
    const byName = new Map(placeholders.map(media => [media.filename, media]))
    return [...urls].flatMap(url => {
        const placeholder = pw1PlaceholderNames(tenantId, url).map(name => byName.get(name)).find(Boolean)
        return placeholder ? [{ url, placeholder }] : []
    })
}
