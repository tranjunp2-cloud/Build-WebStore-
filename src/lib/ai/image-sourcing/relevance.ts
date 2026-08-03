import type {
    ImageAspect,
    PlannedReservoir,
    ReservoirKind,
    StockImageCandidate,
} from './contracts'
import { providerIdentity } from './contracts'
import { hasReusableStockLicense } from './license'

export const IMAGE_RELEVANCE_SYNONYMS = Object.freeze([
    Object.freeze(['cake', 'cakes', 'cupcake', 'cupcakes', 'cheesecake']),
    Object.freeze(['frosting', 'frosted']),
    Object.freeze(['grill', 'grilled']),
    Object.freeze(['pastry', 'pastries']),
    Object.freeze(['cookie', 'cookies']),
    Object.freeze(['noodle', 'noodles']),
    Object.freeze(['dress', 'dresses']),
] as const)

const SYNONYM_LOOKUP = new Map<string, ReadonlySet<string>>()
for (const group of IMAGE_RELEVANCE_SYNONYMS) {
    const normalizedGroup = new Set<string>(group)
    for (const term of group) SYNONYM_LOOKUP.set(term, normalizedGroup)
}

export function normalizeImageTerm(value: string): string {
    return value
        .normalize('NFC')
        .toLocaleLowerCase('en-US')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ')
}

function aspectCompatible(candidateAspect: number, aspect: ImageAspect): boolean {
    if (!Number.isFinite(candidateAspect) || candidateAspect <= 0) return false
    return aspect === 'landscape'
        ? candidateAspect >= 1.25
        : candidateAspect >= 0.8 && candidateAspect <= 1.25
}

function exactAspect(candidateAspect: number, aspect: ImageAspect): boolean {
    return aspect === 'landscape'
        ? candidateAspect >= 1.5
        : candidateAspect >= 0.9 && candidateAspect <= 1.1
}

function completePhraseExists(haystack: string, phrase: string): boolean {
    return ` ${haystack} `.includes(` ${phrase} `)
}

function hasCompleteSynonymMatch(candidateTerms: string, subjectTokens: string[]): boolean {
    const candidateTokens = new Set(candidateTerms.split(' ').filter(Boolean))
    return subjectTokens.every((subjectToken) => {
        if (candidateTokens.has(subjectToken)) return true
        const synonyms = SYNONYM_LOOKUP.get(subjectToken)
        if (!synonyms) return false
        return [...synonyms].some((synonym) => candidateTokens.has(synonym))
    })
}

export type RelevanceRejection =
    | 'inactive'
    | 'license'
    | 'category'
    | 'object'
    | 'aspect'
    | 'duplicate'
    | 'subject'
    | 'threshold'

export type RelevanceResult =
    | { accepted: true; score: number }
    | { accepted: false; score: number; reason: RelevanceRejection }

export interface ScoreCandidateOptions {
    candidate: StockImageCandidate
    subject: string
    category: string
    aspect: ImageAspect
    reservoir: ReservoirKind
    selectedProviderIdentities: ReadonlySet<string>
    requirePersistedObject?: boolean
    minimumScore?: number
}

export function checkImageCandidateHardGates(
    options: Omit<ScoreCandidateOptions, 'subject' | 'minimumScore'>,
): RelevanceRejection | null {
    const {
        candidate,
        selectedProviderIdentities,
        reservoir,
        requirePersistedObject = false,
    } = options
    if (!candidate.active) return 'inactive'
    if (!hasReusableStockLicense(candidate)) return 'license'

    const expectedCategory = reservoir === 'people' ? 'people' : normalizeImageTerm(options.category)
    if (normalizeImageTerm(candidate.category) !== expectedCategory) {
        return 'category'
    }
    if (requirePersistedObject && (candidate.mediaId == null || !candidate.objectKey)) {
        return 'object'
    }
    if (!aspectCompatible(candidate.aspect, options.aspect)) {
        return 'aspect'
    }
    if (selectedProviderIdentities.has(providerIdentity(candidate))) {
        return 'duplicate'
    }
    return null
}

export function scoreImageCandidate(options: ScoreCandidateOptions): RelevanceResult {
    const hardGate = checkImageCandidateHardGates(options)
    if (hardGate) return { accepted: false, score: 0, reason: hardGate }
    const { candidate, minimumScore = 5 } = options
    const subject = normalizeImageTerm(options.subject)
    const candidateTerms = normalizeImageTerm(
        [...candidate.tags, candidate.alt ?? '', candidate.creator].join(' '),
    )
    const subjectTokens = subject.split(' ').filter(Boolean)
    let subjectScore = 0
    if (subject && completePhraseExists(candidateTerms, subject)) {
        subjectScore = 5
    } else if (
        subjectTokens.length > 0 &&
        (hasCompleteSynonymMatch(candidateTerms, subjectTokens) ||
            subjectTokens.every((token) => candidateTerms.split(' ').includes(token)))
    ) {
        subjectScore = 3
    }
    if (subjectScore === 0) return { accepted: false, score: 0, reason: 'subject' }

    const score = subjectScore + (exactAspect(candidate.aspect, options.aspect) ? 2 : 0)
    if (score < minimumScore) return { accepted: false, score, reason: 'threshold' }
    return { accepted: true, score }
}

export interface RankedCandidate {
    candidate: StockImageCandidate
    score: number
}

function timestamp(value: string | Date | null | undefined): number {
    if (value == null) return Number.NEGATIVE_INFINITY
    const parsed = value instanceof Date ? value.getTime() : Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

export function rankImageCandidates(
    candidates: readonly StockImageCandidate[],
    demand: Pick<PlannedReservoir, 'subject' | 'category' | 'aspect' | 'kind'>,
    selectedProviderIdentities: ReadonlySet<string>,
    requirePersistedObject = false,
): RankedCandidate[] {
    return candidates
        .map((candidate) => ({
            candidate,
            result: scoreImageCandidate({
                candidate,
                subject: demand.subject,
                category: demand.category,
                aspect: demand.aspect,
                reservoir: demand.kind,
                selectedProviderIdentities,
                requirePersistedObject,
            }),
        }))
        .filter(
            (
                item,
            ): item is {
                candidate: StockImageCandidate
                result: { accepted: true; score: number }
            } => item.result.accepted,
        )
        .map(({ candidate, result }) => ({ candidate, score: result.score }))
        .sort((left, right) => {
            if (left.score !== right.score) return right.score - left.score
            const useCount = (left.candidate.useCount ?? 0) - (right.candidate.useCount ?? 0)
            if (useCount !== 0) return useCount
            const leftLastUsed = timestamp(left.candidate.lastUsedAt)
            const rightLastUsed = timestamp(right.candidate.lastUsedAt)
            if (leftLastUsed !== rightLastUsed) return leftLastUsed < rightLastUsed ? -1 : 1
            const provider = left.candidate.provider.localeCompare(right.candidate.provider)
            if (provider !== 0) return provider
            return left.candidate.providerImageId.localeCompare(right.candidate.providerImageId)
        })
}
