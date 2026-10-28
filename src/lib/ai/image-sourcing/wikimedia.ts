import type { PlannedReservoir, StockImageCandidate } from './contracts'
import { hasReusableStockLicense } from './license'

interface WikimediaMetadataValue {
    value?: string
}

interface WikimediaImageInfo {
    thumburl?: string
    url?: string
    descriptionurl?: string
    width?: number
    height?: number
    extmetadata?: Record<string, WikimediaMetadataValue>
}

interface WikimediaPage {
    pageid?: number
    title?: string
    imageinfo?: WikimediaImageInfo[]
}

interface WikimediaSearchResponse {
    query?: { pages?: WikimediaPage[] | Record<string, WikimediaPage> }
}

export type WikimediaSearchResult =
    | { ok: true; candidates: StockImageCandidate[] }
    | { ok: false; reason: 'unavailable' | 'timeout' | 'rate' | 'server' | 'invalid_response' }

export interface WikimediaAdapter {
    search(demand: PlannedReservoir): Promise<WikimediaSearchResult>
}

export interface CreateWikimediaAdapterOptions {
    userAgent?: string
    fetch?: typeof globalThis.fetch
    timeoutMs?: number
}

function plainText(value: string | undefined): string {
    return (value ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

function mapPage(page: WikimediaPage, demand: PlannedReservoir): StockImageCandidate | null {
    const image = page.imageinfo?.[0]
    const meta = image?.extmetadata
    if (!image || !meta || page.pageid == null) return null
    const downloadUrl = image.url ?? ''
    const previewUrl = image.thumburl ?? ''
    const sourceUrl = image.descriptionurl ?? ''
    const creator = plainText(meta.Artist?.value)
    const licenseName = plainText(meta.LicenseShortName?.value ?? meta.UsageTerms?.value)
    const licenseUrl = plainText(meta.LicenseUrl?.value)
    const attribution = plainText(meta.Attribution?.value ?? meta.Credit?.value)
    const width = image.width ?? 0
    const height = image.height ?? 0

    try {
        if (new URL(downloadUrl).hostname !== 'upload.wikimedia.org') return null
        if (new URL(previewUrl).hostname !== 'upload.wikimedia.org') return null
        const source = new URL(sourceUrl)
        if (source.protocol !== 'https:' || source.hostname !== 'commons.wikimedia.org') return null
        if (new URL(licenseUrl).protocol !== 'https:') return null
    } catch {
        return null
    }
    if (
        !creator ||
        !licenseName ||
        !licenseUrl ||
        !attribution ||
        width <= 0 ||
        height <= 0 ||
        !hasReusableStockLicense({
            provider: 'wikimedia',
            licenseName,
            licenseUrl,
        })
    ) {
        return null
    }

    const title = plainText(meta.ImageDescription?.value ?? page.title?.replace(/^File:/, ''))
    return {
        provider: 'wikimedia',
        providerImageId: String(page.pageid),
        previewUrl,
        downloadUrl,
        sourceUrl,
        creator,
        licenseName,
        licenseUrl,
        attribution,
        tags: [title, demand.subject].filter(Boolean),
        category: demand.category,
        width,
        height,
        aspect: width / height,
        active: true,
        alt: title || demand.subject,
    }
}

function matchesDemandAspect(candidate: StockImageCandidate, demand: PlannedReservoir): boolean {
    return demand.aspect === 'landscape'
        ? candidate.aspect >= 1.25
        : candidate.aspect >= 0.8 && candidate.aspect <= 1.25
}

export function createWikimediaAdapter(options: CreateWikimediaAdapterOptions): WikimediaAdapter {
    const fetchImpl = options.fetch ?? globalThis.fetch
    const timeoutMs = options.timeoutMs ?? 5_000
    return {
        async search(demand): Promise<WikimediaSearchResult> {
            const userAgent = options.userAgent?.trim()
            if (!userAgent) return { ok: false, reason: 'unavailable' }
            const url = new URL('https://commons.wikimedia.org/w/api.php')
            const parameters: Record<string, string> = {
                action: 'query',
                generator: 'search',
                gsrsearch: demand.subject,
                gsrnamespace: '6',
                gsrlimit: '50',
                prop: 'imageinfo',
                iiprop: 'url|size|extmetadata',
                iiurlwidth: '512',
                iiextmetadatafilter:
                    'Artist|LicenseShortName|LicenseUrl|UsageTerms|Attribution|Credit|ImageDescription',
                format: 'json',
                formatversion: '2',
                origin: '*',
            }
            for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)

            let response: Response
            try {
                response = await fetchImpl(url, {
                    headers: { 'User-Agent': userAgent },
                    signal: AbortSignal.timeout(timeoutMs),
                })
            } catch (error) {
                const name = error instanceof Error ? error.name : ''
                return { ok: false, reason: name === 'TimeoutError' ? 'timeout' : 'server' }
            }
            if (response.status === 429) return { ok: false, reason: 'rate' }
            if (!response.ok) return { ok: false, reason: 'server' }

            let data: WikimediaSearchResponse
            try {
                data = (await response.json()) as WikimediaSearchResponse
            } catch {
                return { ok: false, reason: 'invalid_response' }
            }
            const rawPages = data.query?.pages
            const pages = Array.isArray(rawPages) ? rawPages : Object.values(rawPages ?? {})
            return {
                ok: true,
                candidates: pages.flatMap((page) => {
                    const candidate = mapPage(page, demand)
                    return candidate ? [candidate] : []
                }).filter((candidate) => matchesDemandAspect(candidate, demand)).slice(0, 20),
            }
        },
    }
}

export interface ValidatedPreview {
    data: Uint8Array
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface WikimediaRating {
    winnerId: string | null
    relevant: boolean
    alt: string
    reason: string
}

export interface WikimediaRater {
    rate(
        candidates: readonly StockImageCandidate[],
        demand: PlannedReservoir,
    ): Promise<WikimediaRating | null>
}

