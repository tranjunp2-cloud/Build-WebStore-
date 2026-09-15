/**
 * Truthful terminal outcome for a website-generation run.
 *
 * This module deliberately receives persistence facts from the route. It must
 * never infer a successful website from an AI composition result alone.
 */

export type GenerationOutcome = 'succeeded' | 'partial_failed' | 'failed'
export type TerminalErrorPhase = 'site_persist' | 'composition' | 'unknown'

export type PersistedPage = {
    id?: number | string
    key: string
    slug: string
    title: string
    blockCount?: number
}

export type FailedPage = {
    key: string
    slug: string
    title: string
    blockCount?: number
    error: unknown
}

export type NormalizedGenerationError = {
    phase: 'site_persist' | 'page_persist' | 'composition' | 'unknown'
    locationType: 'site' | 'page' | 'unknown'
    locationKey?: string
    code: string
    category: 'persistence' | 'composition'
    retryabilityReason: string
    operatorMessage: string
    userSafeMessage: string
    sanitizedTechnicalMessage: string
    signature: string
}

export type GenerationOutcomeResult = {
    outcome: GenerationOutcome
    pageSummary: { expected: number; persisted: number; failed: number }
    pageOutcomes: Array<{
        pageKey: string
        slug: string
        title: string
        status: 'persisted' | 'failed'
        pageId?: number | string
        blockCount?: number
        errorCode?: string
        errorSummary?: string
    }>
    errors: NormalizedGenerationError[]
    userSafeMessage: string
}

const MAX_MESSAGE_LENGTH = 500

function boundedMessage(value: unknown): string {
    const raw = value instanceof Error ? value.message : String(value ?? '')
    return raw
        .replace(/\/[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs)/g, '<path>')
        .replace(/(api[_-]?key|authorization|token|password|cookie|set-cookie|client[_-]?secret|secret)\s*[:=]\s*(?:bearer\s+)?[^\r\n,;]+/gi, '$1=<redacted>')
        .replace(/(["'](?:api[_-]?key|authorization|token|password|cookie|set-cookie|client[_-]?secret|secret)["']\s*:\s*["'])(?:bearer\s+)?[^"']*(["'])/gi, '$1<redacted>$2')
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '<redacted-api-key>')
        .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s/@]+:[^\s/@]+@/gi, '<redacted-url-credentials>@')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_MESSAGE_LENGTH)
}

function normalizeError(error: unknown, page?: FailedPage, terminalPhase: TerminalErrorPhase = 'unknown'): NormalizedGenerationError {
    const message = boundedMessage(error)
    const timeout = /timeout|timed out|etimedout/i.test(message)
    const isComposition = !page && terminalPhase === 'composition'

    return {
        phase: page ? 'page_persist' : isComposition ? 'composition' : terminalPhase === 'site_persist' ? 'site_persist' : 'unknown',
        locationType: page ? 'page' : terminalPhase === 'site_persist' ? 'site' : 'unknown',
        ...(page ? { locationKey: page.key } : {}),
        code: timeout ? isComposition ? 'GENERATION_TIMEOUT' : 'PERSISTENCE_TIMEOUT' : page ? 'PAGE_PERSISTENCE_FAILED' : terminalPhase === 'site_persist' ? 'SITE_PERSISTENCE_FAILED' : 'GENERATION_FAILED',
        category: isComposition ? 'composition' : 'persistence',
        retryabilityReason: timeout ? 'transient_timeout' : 'requires_operator_review',
        operatorMessage: message || 'Persistence failed without a diagnostic message.',
        userSafeMessage: 'Chúng tôi chưa thể hoàn thiện website của bạn. Thông tin của bạn đã được lưu.',
        sanitizedTechnicalMessage: message || 'Persistence failed without a diagnostic message.',
        signature: `${page ? 'page' : 'site'}:${timeout ? 'timeout' : 'persistence_failure'}`,
    }
}

/** Derives an outcome exclusively from the actual site/page persistence facts. */
export function finalizeGenerationOutcome(input: {
    expectedPages: number
    persistedPages: PersistedPage[]
    failedPages: FailedPage[]
    terminalError?: unknown
    terminalErrorPhase?: TerminalErrorPhase
}): GenerationOutcomeResult {
    const expected = Math.max(0, input.expectedPages)
    const persisted = input.persistedPages.length
    const failed = input.failedPages.length
    const hasTerminalError = input.terminalError !== undefined && input.terminalError !== null

    const outcome: GenerationOutcome = expected > 0 && !hasTerminalError && persisted === expected && failed === 0
        ? 'succeeded'
        : persisted > 0
            ? 'partial_failed'
            : 'failed'

    const pageErrors = input.failedPages.map((page) => ({ page, error: normalizeError(page.error, page) }))
    const errors = [
        ...pageErrors.map(({ error }) => error),
        ...(hasTerminalError ? [normalizeError(input.terminalError, undefined, input.terminalErrorPhase)] : []),
    ]

    return {
        outcome,
        pageSummary: { expected, persisted, failed: Math.max(failed, Math.max(0, expected - persisted)) },
        pageOutcomes: [
            ...input.persistedPages.map((page) => ({
                pageKey: page.key,
                slug: page.slug,
                title: page.title,
                status: 'persisted' as const,
                ...(page.id !== undefined ? { pageId: String(page.id) } : {}),
                ...(page.blockCount !== undefined ? { blockCount: page.blockCount } : {}),
            })),
            ...pageErrors.map(({ page, error }) => ({
                pageKey: page.key,
                slug: page.slug,
                title: page.title,
                status: 'failed' as const,
                errorCode: error.code,
                errorSummary: error.operatorMessage,
                ...(page.blockCount !== undefined ? { blockCount: page.blockCount } : {}),
            })),
        ],
        errors,
        userSafeMessage: outcome === 'succeeded'
            ? 'Website của bạn đã sẵn sàng.'
            : 'Chúng tôi chưa thể hoàn thiện website của bạn. Thông tin của bạn đã được lưu.',
    }
}
