export const RESERVOIR_ORDER = [
    'landscape',
    'square',
    'people',
    'products',
    'blogs',
] as const

export type ReservoirKind = (typeof RESERVOIR_ORDER)[number]
export type StockProvider = 'wikimedia' | 'pixabay'
export type ImageAspect = 'landscape' | 'square'

export interface StockImageCandidate {
    provider: StockProvider
    providerImageId: string
    previewUrl: string
    downloadUrl: string
    sourceUrl: string
    creator: string
    licenseName: string
    licenseUrl: string
    attribution: string
    tags: string[]
    category: string
    width: number
    height: number
    aspect: number
    active: boolean
    catalogId?: string | number
    mediaId?: string | number
    objectKey?: string
    useCount?: number
    lastUsedAt?: string | Date | null
    alt?: string
}

export interface F38ImageDemand {
    kind: ReservoirKind
    count: number
    subject: string
    category: string
    aiEligible?: boolean
}

export interface PlannedReservoir extends F38ImageDemand {
    count: number
    aspect: ImageAspect
    orientation: 'horizontal' | 'all'
    perPage: 200
}

export interface PersistedImage {
    candidate: StockImageCandidate
    mediaId: string | number
    objectKey: string
}

export type ResolvedImage =
    | {
          source: 'catalog' | 'wikimedia' | 'pixabay'
          candidate: StockImageCandidate
          mediaId: string | number
          objectKey: string
          alt?: string
      }
    | {
          source: 'ai' | 'curated'
          mediaId?: string | number
          objectKey?: string
          url?: string
          alt?: string
      }

export type ImageSourceStage =
    | 'catalog'
    | 'wikimedia'
    | 'wikimedia_rating'
    | 'pixabay'
    | 'ai'
    | 'curated'
    | 'empty'
    | 'object_validation'
    | 'key_health'

export interface F38ImageSourceEvent {
    event: 'f38_image_source'
    reservoir: ReservoirKind
    stage: ImageSourceStage
    outcome: 'hit' | 'miss' | 'selected' | 'rejected' | 'failed' | 'skipped'
    reason?: string
    provider?: StockProvider | 'ai' | 'curated'
    score?: number
    attemptsUsed: number
    keyIndex?: number
    fallbackStage?: ImageSourceStage
}

export interface F38ResolutionResult {
    reservoirs: Record<ReservoirKind, ResolvedImage[]>
    attemptsUsed: number
    events: F38ImageSourceEvent[]
}

export function providerIdentity(candidate: Pick<StockImageCandidate, 'provider' | 'providerImageId'>): string {
    return `${candidate.provider}:${candidate.providerImageId}`
}
