import type { BasePayload } from 'payload'
import sharp from 'sharp'

import { getCuratedFallbackMedia, type MediaPipelineContext } from '../media-pipeline'
import { PIXABAY_CATEGORY_BY_COMPOSER } from '../pixabay-client'
import {
    catalogImageToCandidate,
    type CatalogImage,
} from '@/lib/media/stock-catalog'
import { createF38StockInfrastructure } from '@/lib/media/stock-adapter'
import { downloadAndValidateStockImage } from '@/lib/media/stock-image'

import type {
    F38ImageSourceEvent,
    PersistedImage,
    PlannedReservoir,
    ResolvedImage,
    StockImageCandidate,
} from './contracts'
import {
    createF38Resolver,
    type F38GenerationSummary,
    type F38Resolver,
} from './resolver'
import {
    createF38PixabayProvider,
    getProcessPixabayResponseCache,
} from './pixabay-provider'
import { createOpenAIWikimediaRater, createWikimediaAdapter } from './wikimedia'

export interface F38RuntimeOptions {
    tenantId: string
    businessName: string
    category: string
    products?: string[]
    fetch?: typeof globalThis.fetch
    logger?: (event: F38ImageSourceEvent | F38GenerationSummary) => void | Promise<void>
    getCuratedFallback?: (
        demand: PlannedReservoir,
        slotIndex: number,
    ) => Promise<Omit<ResolvedImage, 'source'> | null>
}

const CURATED_BLOCK_BY_RESERVOIR = {
    landscape: 'hero',
    square: 'portfolio-grid',
    people: 'team',
    products: 'products-grid',
    blogs: 'gallery',
} as const

function persistedResult(image: CatalogImage): PersistedImage {
    const candidate = catalogImageToCandidate(image)
    return {
        candidate,
        mediaId: image.mediaId,
        objectKey: image.objectKey,
    }
}

export function createF38RuntimeResolver(
    payload: BasePayload,
    options: F38RuntimeOptions,
): F38Resolver {
    const infrastructure = createF38StockInfrastructure(payload)
    const fetchImpl = options.fetch ?? globalThis.fetch
    const logger = options.logger ?? ((event: F38ImageSourceEvent | F38GenerationSummary) => {
        console.info('[F38]', JSON.stringify(event))
    })
    const usedCuratedUrls = new Set<string>()
    const curatedContext: MediaPipelineContext = {
        tenantId: options.tenantId,
        businessName: options.businessName,
        category: options.category,
        products: options.products,
    }
    const wikimedia = createWikimediaAdapter({
        userAgent: process.env.WIKIMEDIA_USER_AGENT,
        fetch: fetchImpl,
    })
    const wikimediaRater = createOpenAIWikimediaRater({
        apiKey: process.env.OPENAI_API_KEY,
        fetch: fetchImpl,
        loadPreview: async (candidate) => {
            const image = await downloadAndValidateStockImage(candidate.previewUrl, fetchImpl)
            const data = await sharp(image.buffer)
                .resize({ width: 512, withoutEnlargement: true })
                .jpeg({ quality: 72 })
                .toBuffer()
            return { data, mimeType: 'image/jpeg' }
        },
    })
    const pixabay = createF38PixabayProvider({
        cache: getProcessPixabayResponseCache(),
        fetch: fetchImpl,
        categoryMap: PIXABAY_CATEGORY_BY_COMPOSER,
    })

    const curatedFallback = options.getCuratedFallback ?? (async (demand) => {
        const result = await getCuratedFallbackMedia(
            CURATED_BLOCK_BY_RESERVOIR[demand.kind],
            1,
            curatedContext,
            payload as unknown as Parameters<typeof getCuratedFallbackMedia>[3],
            usedCuratedUrls,
        )
        const mediaId = result.mediaIds[0]
        return mediaId == null ? null : { mediaId }
    })

    return createF38Resolver({
        searchCatalog: (demand) => infrastructure.searchCatalog(demand),
        validateCatalogObject: (candidate) =>
            candidate.objectKey ? infrastructure.objectExists(candidate.objectKey) : Promise.resolve(false),
        markCatalogUsed: (candidate) =>
            candidate.catalogId == null
                ? Promise.resolve()
                : infrastructure.markCatalogUsed([Number(candidate.catalogId)]),
        wikimedia,
        wikimediaRater,
        pixabay,
        persistExternal: async (candidate: StockImageCandidate) => {
            const persisted = await infrastructure.persistStockCandidate(candidate)
            return persistedResult(persisted)
        },
        getCuratedFallback: curatedFallback,
        emitEvent: logger,
        emitSummary: logger,
    })
}
