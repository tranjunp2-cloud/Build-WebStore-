import {
    RESERVOIR_ORDER,
    type F38ImageDemand,
    type PlannedReservoir,
    type ReservoirKind,
    type StockImageCandidate,
} from './contracts'
import { normalizeImageTerm } from './relevance'

const RESERVOIR_CAPS: Readonly<Record<ReservoirKind, number>> = {
    landscape: 12,
    square: 6,
    people: 6,
    products: 6,
    blogs: 3,
}

export interface ReservoirPlanInput {
    counts: Partial<Record<ReservoirKind, number>>
    category: string
    trustedSubjects?: string[]
    trustedProducts?: string[]
    blogImageKeywords?: string[]
    categoryBaseKeyword: string
}

function firstTrusted(values: readonly string[] | undefined): string | undefined {
    return values?.map(normalizeImageTerm).find(Boolean)
}

function cappedDemand(value: number | undefined, cap: number): number {
    const numeric = value ?? 0
    if (!Number.isFinite(numeric)) return 0
    return Math.min(Math.max(0, Math.trunc(numeric)), cap)
}

export function planImageReservoirs(input: ReservoirPlanInput): PlannedReservoir[] {
    const category = normalizeImageTerm(input.category)
    const categoryBase = normalizeImageTerm(input.categoryBaseKeyword)
    const siteSubject = firstTrusted(input.trustedSubjects) ?? categoryBase
    const productSubject = firstTrusted(input.trustedProducts) ?? categoryBase
    const blogSubject = firstTrusted(input.blogImageKeywords) ?? categoryBase

    const subjects: Record<ReservoirKind, string> = {
        landscape: siteSubject,
        square: siteSubject,
        people: 'professional portrait',
        products: productSubject,
        blogs: blogSubject,
    }

    return RESERVOIR_ORDER.flatMap((kind) => {
        const count = cappedDemand(input.counts[kind], RESERVOIR_CAPS[kind])
        if (count === 0) return []
        const isLandscape = kind === 'landscape' || kind === 'blogs'
        return [{
            kind,
            count,
            subject: subjects[kind],
            category: kind === 'people' ? 'people' : category,
            aiEligible: kind !== 'people',
            aspect: isLandscape ? 'landscape' : 'square',
            orientation: isLandscape ? 'horizontal' : 'all',
            perPage: 200,
        }]
    })
}

export function normalizeImageDemands(demands: readonly F38ImageDemand[]): PlannedReservoir[] {
    const byKind = new Map<ReservoirKind, F38ImageDemand>()
    for (const demand of demands) {
        if (!byKind.has(demand.kind)) byKind.set(demand.kind, demand)
    }
    return RESERVOIR_ORDER.flatMap((kind) => {
        const demand = byKind.get(kind)
        if (!demand) return []
        const count = cappedDemand(demand.count, RESERVOIR_CAPS[kind])
        if (count === 0) return []
        const isLandscape = kind === 'landscape' || kind === 'blogs'
        return [{
            ...demand,
            count,
            subject: kind === 'people' ? 'professional portrait' : normalizeImageTerm(demand.subject),
            category: kind === 'people' ? 'people' : normalizeImageTerm(demand.category),
            aiEligible: demand.aiEligible ?? kind !== 'people',
            aspect: isLandscape ? 'landscape' : 'square',
            orientation: isLandscape ? 'horizontal' : 'all',
            perPage: 200,
        }]
    })
}

export function takeDistinctCandidates(
    candidates: readonly StockImageCandidate[],
    count: number,
    selectedProviderIdentities: Set<string>,
): StockImageCandidate[] {
    const selected: StockImageCandidate[] = []
    for (const candidate of candidates) {
        const identity = `${candidate.provider}:${candidate.providerImageId}`
        if (selectedProviderIdentities.has(identity)) continue
        selectedProviderIdentities.add(identity)
        selected.push(candidate)
        if (selected.length >= count) break
    }
    return selected
}
