import { load } from 'cheerio'
import type { Payload } from 'payload'
import { rehostHtmlImages } from './pw1-media'

/** Rehosted images are stored as `pw1-<tenant>-<hash>…` media (cloned template content can carry another tenant's), so any other absolute <img> URL is still the PW1 original. */
const REHOSTED_MEDIA = /pw1-\d+-[0-9a-f]{20}/
const isExternalImage = (url: string) => /^https?:\/\//i.test(url) && !REHOSTED_MEDIA.test(url)

/** Absolute http(s) <img> sources in rich text that were never rehosted into destination media (entities decoded). */
export function externalImageUrls(html: string): string[] {
    if (!html.includes('<img')) return []
    const urls = new Set<string>()
    load(html, null, false)('img').each((_, element) => {
        const src = (element.attribs?.src ?? '').trim()
        if (isExternalImage(src)) urls.add(src)
    })
    return [...urls]
}

export type RichTextImageRepair = { changed: boolean; html: string; found: number; remaining: number }

/**
 * Re-runs the migration's own rich-text image rehost (entity decoding, redirects, browser User-Agent,
 * Chromium fallback, content-type tolerance) on html whose images were left pointing at PW1.
 * Images that still cannot be downloaded stay as they were; `remaining` counts them.
 */
export async function repairRichTextImages(html: string, tenantId: number | string, payload: Payload, cache = new Map<string, number>()): Promise<RichTextImageRepair> {
    const found = externalImageUrls(html).length
    if (found === 0) return { changed: false, html, found: 0, remaining: 0 }
    // Only the images still on PW1: already rehosted ones must not be downloaded again from our own storage.
    const next = await rehostHtmlImages(html, tenantId, payload, cache, isExternalImage)
    return { changed: next !== html, html: next, found, remaining: externalImageUrls(next).length }
}
