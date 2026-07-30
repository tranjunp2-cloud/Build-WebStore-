import { PixabayAttemptBudget } from './budget'
import {
    RESERVOIR_ORDER,
    type F38ImageDemand,
    type F38ImageSourceEvent,
    type F38ResolutionResult,
    type PersistedImage,
    type PlannedReservoir,
    type ReservoirKind,
    type ResolvedImage,
    type StockImageCandidate,
} from './contracts'
import { providerIdentity } from './contracts'
import type { F38PixabayProvider, PixabayProviderResult } from './pixabay-provider'
import { checkImageCandidateHardGates, rankImageCandidates } from './relevance'
import { normalizeImageDemands } from './reservoirs'
import type {
    WikimediaAdapter,
    WikimediaRater,
    WikimediaRating,
    WikimediaSearchResult,
} from './wikimedia'

export interface F38GenerationSummary {
    event: 'f38_image_source_summary'
    attemptsUsed: number
    reservoirs: Array<{
        reservoir: ReservoirKind
        requested: number
        resolved: number
        providers: string[]
        stages: Array<{
            stage: F38ImageSourceEvent['stage']
            outcome: F38ImageSourceEvent['outcome']
            reason?: string
            provider?: F38ImageSourceEvent['provider']
            score?: number
            keyIndex?: number
            fallbackStage?: F38ImageSourceEvent['fallbackStage']
        }>
    }>
}

export interface F38ResolverDependencies {
    searchCatalog?: (demand: PlannedReservoir) => Promise<StockImageCandidate[]>
    validateCatalogObject?: (candidate: StockImageCandidate) => Promise<boolean>
    markCatalogUsed?: (candidate: StockImageCandidate) => Promise<void>
    wikimedia?: WikimediaAdapter
    wikimediaRater?: WikimediaRater
    pixabay?: F38PixabayProvider
    persistExternal?: (candidate: StockImageCandidate) => Promise<PersistedImage | null>
    generateAi?: (
        demand: PlannedReservoir,
        slotIndex: number,
    ) => Promise<Omit<ResolvedImage, 'source'> | null>
    getCuratedFallback?: (
        demand: PlannedReservoir,
        slotIndex: number,
    ) => Promise<Omit<ResolvedImage, 'source'> | null>
    emitEvent?: (event: F38ImageSourceEvent) => void | Promise<void>
    emitSummary?: (summary: F38GenerationSummary) => void | Promise<void>
}

export interface F38ResolveInput {
    demands: readonly F38ImageDemand[]
    selectedProviderIdentities?: Set<string>
    budget?: PixabayAttemptBudget
}

export interface F38Resolver {
    resolveF38ImageDemand(input: F38ResolveInput): Promise<F38ResolutionResult>
}

function emptyReservoirs(): Record<ReservoirKind, ResolvedImage[]> {
    return {
        landscape: [],
        square: [],
        people: [],
        products: [],
        blogs: [],
    }
}

function isAspectCompatible(candidate: StockImageCandidate, demand: PlannedReservoir): boolean {
    if (demand.aspect === 'landscape') return candidate.aspect >= 1.25
    return candidate.aspect >= 0.8 && candidate.aspect <= 1.25
}

type ResolvedAssetReference = {
    mediaId?: string | number
    objectKey?: string
    url?: string
}

function canonicalImageUrl(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return ''
    try {
        const url = new URL(trimmed, 'https://f38.local')
        url.hash = ''
        url.searchParams.sort()
        return url.origin === 'https://f38.local'
            ? `${url.pathname}${url.search}`
            : url.toString()
    } catch {
        return trimmed
    }
}

function resolvedAssetKeys(image: ResolvedAssetReference): string[] {
    const keys: string[] = []
    if (image.mediaId !== undefined && String(image.mediaId).trim()) {
        keys.push(`media:${String(image.mediaId).trim()}`)
    }
    if (image.objectKey?.trim()) keys.push(`object:${image.objectKey.trim()}`)
    if (image.url?.trim()) keys.push(`url:${canonicalImageUrl(image.url)}`)
    return keys
}

async function mapWithConcurrency<T, R>(
    values: readonly T[],
    concurrency: number,
    mapper: (value: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(values.length)
    let cursor = 0
    const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (cursor < values.length) {
            const index = cursor
            cursor += 1
            results[index] = await mapper(values[index]!)
        }
    })
    await Promise.all(workers)
    return results
}

export function createF38Resolver(dependencies: F38ResolverDependencies = {}): F38Resolver {
    return {
        async resolveF38ImageDemand(input): Promise<F38ResolutionResult> {
            const demands = normalizeImageDemands(input.demands)
            const budget = input.budget ?? new PixabayAttemptBudget(5)
            const selectedIdentities = input.selectedProviderIdentities ?? new Set<string>()
            const selectedAssetKeys = new Set<string>()
            const reservoirs = emptyReservoirs()
            const events: F38ImageSourceEvent[] = []

            const emit = async (
                demand: PlannedReservoir,
                event: Omit<F38ImageSourceEvent, 'event' | 'reservoir' | 'attemptsUsed'>,
            ): Promise<void> => {
                const complete: F38ImageSourceEvent = {
                    event: 'f38_image_source',
                    reservoir: demand.kind,
                    attemptsUsed: budget.attemptsUsed,
                    ...event,
                }
                events.push(complete)
                try {
                    await dependencies.emitEvent?.(complete)
                } catch {
                    // Observability is non-blocking by contract.
                }
            }

            const rememberResolvedAsset = (image: ResolvedAssetReference): boolean => {
                const keys = resolvedAssetKeys(image)
                if (keys.some((key) => selectedAssetKeys.has(key))) return false
                for (const key of keys) selectedAssetKeys.add(key)
                return true
            }

            const appendGenerated = (
                demand: PlannedReservoir,
                image: ResolvedAssetReference & { alt?: string },
                source: 'ai' | 'curated',
            ): boolean => {
                if (!rememberResolvedAsset(image)) return false
                reservoirs[demand.kind].push({ ...image, source })
                return true
            }

            const appendPersisted = (
                demand: PlannedReservoir,
                persisted: PersistedImage,
                source: 'wikimedia' | 'pixabay',
                alt?: string,
            ): boolean => {
                const identity = providerIdentity(persisted.candidate)
                if (selectedIdentities.has(identity)) return false
                if (!rememberResolvedAsset(persisted)) return false
                selectedIdentities.add(identity)
                reservoirs[demand.kind].push({
                    source,
                    candidate: persisted.candidate,
                    mediaId: persisted.mediaId,
                    objectKey: persisted.objectKey,
                    alt,
                })
                return true
            }

            // Stage 1: catalog, retaining partial winners.
            for (const demand of demands) {
                let candidates: StockImageCandidate[] = []
                try {
                    candidates = (await dependencies.searchCatalog?.(demand)) ?? []
                } catch {
                    await emit(demand, {
                        stage: 'catalog',
                        outcome: 'failed',
                        reason: 'search_failed',
                        fallbackStage: 'wikimedia',
                    })
                    continue
                }
                const gateResults = await mapWithConcurrency(candidates, 8, async (candidate) => {
                    const hardGate = checkImageCandidateHardGates({
                        candidate,
                        category: demand.category,
                        aspect: demand.aspect,
                        reservoir: demand.kind,
                        selectedProviderIdentities: selectedIdentities,
                        requirePersistedObject: true,
                    })
                    if (hardGate) return { candidate, rejection: hardGate }
                    try {
                        const exists =
                            (await dependencies.validateCatalogObject?.(candidate)) ?? true
                        return {
                            candidate,
                            rejection: exists ? null : 'missing_or_unavailable',
                        }
                    } catch {
                        return { candidate, rejection: 'missing_or_unavailable' }
                    }
                })
                const objectValid: StockImageCandidate[] = []
                for (const { candidate, rejection } of gateResults) {
                    if (rejection) {
                        await emit(demand, {
                            stage:
                                rejection === 'missing_or_unavailable'
                                    ? 'object_validation'
                                    : 'catalog',
                            outcome: 'rejected',
                            reason: rejection,
                            provider: candidate.provider,
                        })
                        continue
                    }
                    objectValid.push(candidate)
                }
                const ranked = rankImageCandidates(objectValid, demand, selectedIdentities, true)
                for (const item of ranked) {
                    if (reservoirs[demand.kind].length >= demand.count) break
                    const candidate = item.candidate
                    const identity = providerIdentity(candidate)
                    if (selectedIdentities.has(identity)) continue
                    if (!rememberResolvedAsset(candidate)) {
                        await emit(demand, {
                            stage: 'catalog',
                            outcome: 'rejected',
                            reason: 'duplicate',
                            provider: candidate.provider,
                        })
                        continue
                    }
                    selectedIdentities.add(identity)
                    reservoirs[demand.kind].push({
                        source: 'catalog',
                        candidate,
                        mediaId: candidate.mediaId!,
                        objectKey: candidate.objectKey!,
                        alt: candidate.alt,
                    })
                    try {
                        await dependencies.markCatalogUsed?.(candidate)
                    } catch {
                        // Usage metadata is observational and cannot block assignment.
                    }
                    await emit(demand, {
                        stage: 'catalog',
                        outcome: 'selected',
                        provider: candidate.provider,
                        score: item.score,
                    })
                }
                if (reservoirs[demand.kind].length < demand.count) {
                    await emit(demand, {
                        stage: 'catalog',
                        outcome: 'miss',
                        reason: candidates.length > 0 ? 'partial_or_irrelevant' : 'empty',
                        fallbackStage: 'wikimedia',
                    })
                }
            }

            // Stage 2: one Wikimedia search per remaining reservoir. Accepted
            // winners are removed before another bounded rating call.
            for (const demand of demands) {
                if (reservoirs[demand.kind].length >= demand.count) continue
                if (!dependencies.wikimedia || !dependencies.wikimediaRater || !dependencies.persistExternal) {
                    await emit(demand, {
                        stage: 'wikimedia',
                        outcome: 'skipped',
                        reason: 'unavailable',
                        fallbackStage: 'pixabay',
                    })
                    continue
                }
                let search: WikimediaSearchResult
                try {
                    search = await dependencies.wikimedia.search(demand)
                } catch {
                    await emit(demand, {
                        stage: 'wikimedia',
                        outcome: 'failed',
                        reason: 'search_failed',
                        fallbackStage: 'pixabay',
                    })
                    continue
                }
                if (!search.ok) {
                    await emit(demand, {
                        stage: 'wikimedia',
                        outcome: 'failed',
                        reason: search.reason,
                        fallbackStage: 'pixabay',
                    })
                    continue
                }
                const remaining = search.candidates.filter(
                    (candidate) =>
                        isAspectCompatible(candidate, demand) &&
                        !selectedIdentities.has(providerIdentity(candidate)),
                )
                while (
                    remaining.length > 0 &&
                    reservoirs[demand.kind].length < demand.count
                ) {
                    let rating: WikimediaRating | null
                    try {
                        rating = await dependencies.wikimediaRater.rate(remaining.slice(0, 5), demand)
                    } catch {
                        rating = null
                    }
                    if (!rating?.relevant || !rating.winnerId) {
                        await emit(demand, {
                            stage: 'wikimedia_rating',
                            outcome: 'failed',
                            reason: rating ? 'no_relevant_winner' : 'invalid_or_unavailable',
                            fallbackStage: 'pixabay',
                        })
                        break
                    }
                    const winnerIndex = remaining.findIndex(
                        (candidate) => candidate.providerImageId === rating.winnerId,
                    )
                    if (winnerIndex < 0) {
                        await emit(demand, {
                            stage: 'wikimedia_rating',
                            outcome: 'failed',
                            reason: 'unknown_winner',
                            fallbackStage: 'pixabay',
                        })
                        break
                    }
                    const [winner] = remaining.splice(winnerIndex, 1)
                    let persisted: PersistedImage | null = null
                    try {
                        persisted = await dependencies.persistExternal(winner!)
                    } catch {
                        // Persist failure is isolated to this candidate.
                    }
                    if (!persisted) {
                        await emit(demand, {
                            stage: 'wikimedia',
                            outcome: 'failed',
                            reason: 'persistence_failed',
                            provider: 'wikimedia',
                            fallbackStage: 'pixabay',
                        })
                        continue
                    }
                    if (appendPersisted(demand, persisted, 'wikimedia', rating.alt)) {
                        await emit(demand, {
                            stage: 'wikimedia',
                            outcome: 'selected',
                            provider: 'wikimedia',
                        })
                    } else {
                        await emit(demand, {
                            stage: 'wikimedia',
                            outcome: 'rejected',
                            reason: 'duplicate',
                            provider: 'wikimedia',
                            fallbackStage: 'pixabay',
                        })
                    }
                }
            }

            const unresolved = (): PlannedReservoir[] =>
                demands.filter((demand) => reservoirs[demand.kind].length < demand.count)
            const failover = new Set<ReservoirKind>()

            const runPixabay = async (
                demand: PlannedReservoir,
                reservation: 'primary' | 'failover',
                laterUnresolvedReservoirs = 0,
            ): Promise<PixabayProviderResult | null> => {
                if (!dependencies.pixabay || !dependencies.persistExternal) return null
                let result: PixabayProviderResult
                try {
                    result = await dependencies.pixabay.search({
                        query: demand.subject,
                        imageType: 'photo',
                        orientation: demand.orientation,
                        category: demand.category,
                        safeSearch: true,
                        perPage: demand.perPage,
                        page: 1,
                        budget,
                        reservation,
                        laterUnresolvedReservoirs,
                    })
                } catch {
                    await emit(demand, {
                        stage: 'pixabay',
                        outcome: 'failed',
                        reason: 'provider_error',
                        fallbackStage: 'ai',
                    })
                    return null
                }
                if (!result.ok) {
                    await emit(demand, {
                        stage: 'pixabay',
                        outcome: 'failed',
                        reason: result.reason,
                        keyIndex: result.keyIndex,
                        fallbackStage: 'ai',
                    })
                    if (result.failoverEligible) failover.add(demand.kind)
                    return result
                }

                const ranked = rankImageCandidates(
                    result.candidates,
                    demand,
                    selectedIdentities,
                    false,
                )
                for (const item of ranked) {
                    if (reservoirs[demand.kind].length >= demand.count) break
                    if (selectedIdentities.has(providerIdentity(item.candidate))) continue
                    let persisted: PersistedImage | null = null
                    try {
                        persisted = await dependencies.persistExternal(item.candidate)
                    } catch {
                        // Persist failure advances to the next ranked candidate.
                    }
                    if (!persisted) continue
                    if (appendPersisted(demand, persisted, 'pixabay')) {
                        await emit(demand, {
                            stage: 'pixabay',
                            outcome: 'selected',
                            provider: 'pixabay',
                            score: item.score,
                            keyIndex: result.keyIndex,
                        })
                    } else {
                        await emit(demand, {
                            stage: 'pixabay',
                            outcome: 'rejected',
                            reason: 'duplicate',
                            provider: 'pixabay',
                            keyIndex: result.keyIndex,
                            fallbackStage: 'ai',
                        })
                    }
                }
                if (reservoirs[demand.kind].length < demand.count) {
                    await emit(demand, {
                        stage: 'pixabay',
                        outcome: 'miss',
                        reason: result.candidates.length > 0 ? 'irrelevant_or_partial' : 'empty',
                        keyIndex: result.keyIndex,
                        fallbackStage: 'ai',
                    })
                }
                failover.delete(demand.kind)
                return result
            }

            // Stage 3, pass 1: preserve one primary reservation for each later
            // unresolved reservoir.
            const primaryDemands = unresolved()
            for (let index = 0; index < primaryDemands.length; index += 1) {
                await runPixabay(
                    primaryDemands[index]!,
                    'primary',
                    primaryDemands.length - index - 1,
                )
            }

            // Stage 3, pass 2: eligible failures retry in reservoir order using
            // only budget not reserved by pass 1.
            while (budget.remaining > 0 && failover.size > 0) {
                let consumedAttempt = false
                for (const kind of RESERVOIR_ORDER) {
                    if (!failover.has(kind) || budget.remaining <= 0) continue
                    const demand = demands.find((item) => item.kind === kind)
                    if (!demand || reservoirs[kind].length >= demand.count) {
                        failover.delete(kind)
                        continue
                    }
                    const before = budget.attemptsUsed
                    const result = await runPixabay(demand, 'failover')
                    consumedAttempt ||= budget.attemptsUsed > before
                    if (!result?.ok && !result?.failoverEligible) failover.delete(kind)
                }
                if (!consumedAttempt) break
            }

            // Stage 4/5: eligible AI, then curated, then leave the slot empty.
            for (const demand of demands) {
                while (reservoirs[demand.kind].length < demand.count) {
                    const slotIndex = reservoirs[demand.kind].length
                    if (demand.aiEligible && dependencies.generateAi) {
                        try {
                            const image = await dependencies.generateAi(demand, slotIndex)
                            if (image) {
                                if (appendGenerated(demand, image, 'ai')) {
                                    await emit(demand, {
                                        stage: 'ai',
                                        outcome: 'selected',
                                        provider: 'ai',
                                    })
                                    continue
                                }
                                await emit(demand, {
                                    stage: 'ai',
                                    outcome: 'rejected',
                                    reason: 'duplicate',
                                    provider: 'ai',
                                    fallbackStage: 'curated',
                                })
                            } else {
                                await emit(demand, {
                                    stage: 'ai',
                                    outcome: 'failed',
                                    reason: 'generation_failed',
                                    fallbackStage: 'curated',
                                })
                            }
                        } catch {
                            // AI failure is non-fatal.
                            await emit(demand, {
                                stage: 'ai',
                                outcome: 'failed',
                                reason: 'generation_failed',
                                fallbackStage: 'curated',
                            })
                        }
                    } else {
                        await emit(demand, {
                            stage: 'ai',
                            outcome: 'skipped',
                            reason: demand.aiEligible ? 'unavailable' : 'ineligible',
                            fallbackStage: 'curated',
                        })
                    }

                    if (dependencies.getCuratedFallback) {
                        try {
                            const curated = await dependencies.getCuratedFallback(demand, slotIndex)
                            if (curated) {
                                if (appendGenerated(demand, curated, 'curated')) {
                                    await emit(demand, {
                                        stage: 'curated',
                                        outcome: 'selected',
                                        provider: 'curated',
                                    })
                                    continue
                                }
                                await emit(demand, {
                                    stage: 'curated',
                                    outcome: 'rejected',
                                    reason: 'duplicate',
                                    provider: 'curated',
                                    fallbackStage: 'empty',
                                })
                            }
                        } catch {
                            // Curated failures leave the slot empty.
                        }
                    }
                    await emit(demand, {
                        stage: 'empty',
                        outcome: 'miss',
                        reason: 'fallback_exhausted',
                    })
                    break
                }
            }

            const summary: F38GenerationSummary = {
                event: 'f38_image_source_summary',
                attemptsUsed: budget.attemptsUsed,
                reservoirs: demands.map((demand) => ({
                    reservoir: demand.kind,
                    requested: demand.count,
                    resolved: reservoirs[demand.kind].length,
                    providers: reservoirs[demand.kind].map((image) => image.source),
                    stages: events
                        .filter((event) => event.reservoir === demand.kind)
                        .map((event) => ({
                            stage: event.stage,
                            outcome: event.outcome,
                            ...(event.reason ? { reason: event.reason } : {}),
                            ...(event.provider ? { provider: event.provider } : {}),
                            ...(event.score === undefined ? {} : { score: event.score }),
                            ...(event.keyIndex === undefined
                                ? {}
                                : { keyIndex: event.keyIndex }),
                            ...(event.fallbackStage
                                ? { fallbackStage: event.fallbackStage }
                                : {}),
                        })),
                })),
            }
            try {
                await dependencies.emitSummary?.(summary)
            } catch {
                // Observability is non-blocking by contract.
            }
            return { reservoirs, attemptsUsed: budget.attemptsUsed, events }
        },
    }
}

export async function resolveF38ImageDemand(
    input: F38ResolveInput,
    dependencies: F38ResolverDependencies = {},
): Promise<F38ResolutionResult> {
    return createF38Resolver(dependencies).resolveF38ImageDemand(input)
}
