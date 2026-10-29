import { PixabayAttemptBudget } from './budget'
import {
    createPixabayCacheKey,
    SingleFlight,
    type PixabaySearchParameters,
} from './cache'
import type { StockImageCandidate } from './contracts'
import { getProcessPixabayKeyRing, PixabayKeyRing } from './key-ring'
import { normalizeImageTerm } from './relevance'
import { buildStockAlt } from '../stock-alt'

interface PixabayHit {
    id: number
    pageURL: string
    webformatURL: string
    largeImageURL?: string
    tags?: string
    user?: string
    imageWidth: number
    imageHeight: number
}

interface PixabayApiResponse {
    hits: PixabayHit[]
}

export interface PixabayResponseCache {
    get(key: string): Promise<PixabayApiResponse | null>
    set(key: string, value: PixabayApiResponse, expiresAt: Date): Promise<void>
}

const processResponseCache = new Map<string, {
    value: PixabayApiResponse
    expiresAt: number
}>()

const sharedProcessResponseCache: PixabayResponseCache = {
    async get(key) {
        const entry = processResponseCache.get(key)
        if (!entry) return null
        if (entry.expiresAt <= Date.now()) {
            processResponseCache.delete(key)
            return null
        }
        return entry.value
    },
    async set(key, value, expiresAt) {
        processResponseCache.set(key, { value, expiresAt: expiresAt.getTime() })
    },
}

export function getProcessPixabayResponseCache(): PixabayResponseCache {
    return sharedProcessResponseCache
}

export function resetProcessPixabayResponseCacheForTests(): void {
    processResponseCache.clear()
}

export type PixabayFailureReason =
    | 'unavailable'
    | 'budget_exhausted'
    | 'network'
    | 'auth'
    | 'rate'
    | 'server'
    | 'invalid_response'

export type PixabayProviderResult =
    | {
          ok: true
          candidates: StockImageCandidate[]
          cacheHit: boolean
          keyIndex?: number
      }
    | {
          ok: false
          reason: PixabayFailureReason
          failoverEligible: boolean
          keyIndex?: number
      }

export interface F38PixabaySearchInput extends PixabaySearchParameters {
    category: string
    budget: PixabayAttemptBudget
    reservation: 'primary' | 'failover'
    laterUnresolvedReservoirs?: number
}

export interface F38PixabayProvider {
    search(input: F38PixabaySearchInput): Promise<PixabayProviderResult>
}

export interface CreateF38PixabayProviderOptions {
    keyRing?: PixabayKeyRing
    cache: PixabayResponseCache
    fetch?: typeof globalThis.fetch
    now?: () => number
    timeoutMs?: number
    categoryMap?: Readonly<Record<string, string>>
}

const processSingleFlight = new SingleFlight<PixabayProviderResult>()

function isPixabayResponse(value: unknown): value is PixabayApiResponse {
    if (!value || typeof value !== 'object') return false
    const hits = (value as { hits?: unknown }).hits
    return Array.isArray(hits) && hits.every((hit) => {
        if (!hit || typeof hit !== 'object') return false
        const item = hit as Partial<PixabayHit>
        return (
            typeof item.id === 'number' &&
            typeof item.pageURL === 'string' &&
            typeof item.webformatURL === 'string' &&
            typeof item.imageWidth === 'number' &&
            typeof item.imageHeight === 'number'
        )
    })
}

function mapHit(hit: PixabayHit, category: string): StockImageCandidate {
    const creator = hit.user?.trim() ?? ''
    const width = hit.imageWidth
    const height = hit.imageHeight
    return {
        provider: 'pixabay',
        providerImageId: String(hit.id),
        previewUrl: hit.webformatURL,
        downloadUrl: hit.largeImageURL || hit.webformatURL,
        sourceUrl: hit.pageURL,
        creator,
        licenseName: 'Pixabay Content License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        attribution: creator ? `by ${creator} via Pixabay` : 'via Pixabay',
        tags: (hit.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
        category,
        width,
        height,
        aspect: height > 0 ? width / height : 0,
        active: true,
        alt: buildStockAlt(hit.tags) || undefined,
    }
}

export function createF38PixabayProvider(
    options: CreateF38PixabayProviderOptions,
): F38PixabayProvider {
    const keyRing = options.keyRing ?? getProcessPixabayKeyRing()
    const fetchImpl = options.fetch ?? globalThis.fetch
    const now = options.now ?? Date.now
    const timeoutMs = options.timeoutMs ?? 5_000
    return {
        async search(input): Promise<PixabayProviderResult> {
            const normalizedQuery = normalizeImageTerm(input.query).slice(0, 100)
            const providerCategory = options.categoryMap?.[input.category]
            const cacheKey = createPixabayCacheKey({
                ...input,
                query: normalizedQuery,
                category: providerCategory,
            })
            let cached: PixabayApiResponse | null = null
            try {
                cached = await options.cache.get(cacheKey)
            } catch {
                // Cache availability must not block provider fallback.
            }
            if (cached) {
                return {
                    ok: true,
                    candidates: cached.hits.map((hit) => mapHit(hit, input.category)),
                    cacheHit: true,
                }
            }

            return processSingleFlight.run(cacheKey, async () => {
                // Re-read after acquiring single-flight ownership because another
                // request may have populated the shared cache before this turn.
                let secondCacheRead: PixabayApiResponse | null = null
                try {
                    secondCacheRead = await options.cache.get(cacheKey)
                } catch {
                    // Cache availability must not block provider fallback.
                }
                if (secondCacheRead) {
                    return {
                        ok: true,
                        candidates: secondCacheRead.hits.map((hit) => mapHit(hit, input.category)),
                        cacheHit: true,
                    }
                }

                const selectedKey = keyRing.select()
                if (!selectedKey) {
                    return { ok: false, reason: 'unavailable', failoverEligible: false }
                }
                const reserved =
                    input.reservation === 'primary'
                        ? input.budget.reservePrimary(input.laterUnresolvedReservoirs ?? 0)
                        : input.budget.reserveFailover()
                if (!reserved) {
                    return { ok: false, reason: 'budget_exhausted', failoverEligible: false }
                }

                const url = new URL('https://pixabay.com/api/')
                url.searchParams.set('key', selectedKey.key)
                url.searchParams.set('q', normalizedQuery)
                url.searchParams.set('image_type', input.imageType ?? 'photo')
                url.searchParams.set('orientation', input.orientation)
                if (providerCategory) url.searchParams.set('category', providerCategory)
                if (input.language) url.searchParams.set('lang', input.language)
                url.searchParams.set('safesearch', String(input.safeSearch ?? true))
                url.searchParams.set('per_page', String(input.perPage))
                url.searchParams.set('page', String(input.page ?? 1))

                let response: Response
                try {
                    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
                } catch {
                    return {
                        ok: false,
                        reason: 'network',
                        failoverEligible: true,
                        keyIndex: selectedKey.index,
                    }
                }

                keyRing.recordResponse(
                    selectedKey.index,
                    response.status,
                    response.headers.get('x-ratelimit-reset'),
                )
                if (response.status === 401 || response.status === 403) {
                    return {
                        ok: false,
                        reason: 'auth',
                        failoverEligible: true,
                        keyIndex: selectedKey.index,
                    }
                }
                if (response.status === 429) {
                    return {
                        ok: false,
                        reason: 'rate',
                        failoverEligible: true,
                        keyIndex: selectedKey.index,
                    }
                }
                if (!response.ok) {
                    return {
                        ok: false,
                        reason: 'server',
                        failoverEligible: false,
                        keyIndex: selectedKey.index,
                    }
                }

                let body: unknown
                try {
                    body = await response.json()
                } catch {
                    return {
                        ok: false,
                        reason: 'invalid_response',
                        failoverEligible: false,
                        keyIndex: selectedKey.index,
                    }
                }
                if (!isPixabayResponse(body)) {
                    return {
                        ok: false,
                        reason: 'invalid_response',
                        failoverEligible: false,
                        keyIndex: selectedKey.index,
                    }
                }

                try {
                    await options.cache.set(
                        cacheKey,
                        body,
                        new Date(now() + 24 * 60 * 60 * 1000),
                    )
                } catch {
                    // A valid provider response remains usable if cache storage fails.
                }
                return {
                    ok: true,
                    candidates: body.hits.map((hit) => mapHit(hit, input.category)),
                    cacheHit: false,
                    keyIndex: selectedKey.index,
                }
            })
        },
    }
}
