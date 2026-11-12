/**
 * Truthful terminal outcome for a website-generation run.
 *
 * This module deliberately receives persistence facts from the route. It must
 * never infer a successful website from an AI composition result alone.
 */

export type GenerationOutcome = 'succeeded' | 'partial_failed' | 'failed'
export type TerminalErrorPhase = 'site_persist' | 'composition' | 'unknown'
export type GenerationIncidentPhase = 'validate' | 'site_persist' | 'page_persist' | 'component_persist' | 'composition' | 'recovery' | 'unknown'
export type GenerationIncidentLocationType = 'input' | 'site' | 'page' | 'component' | 'unknown'
export type GenerationIncidentCategory = 'input_validation' | 'persistence' | 'composition' | 'quota' | 'system'
export type GenerationValidationRule = 'required' | 'format' | 'min_length' | 'max_length' | 'unsupported_value' | 'contract_mismatch'
export type GenerationObservedState = 'missing' | 'invalid_format' | 'too_short' | 'too_long' | 'unsupported' | 'unknown'

export type GenerationIncidentHint = {
    phase?: GenerationIncidentPhase
    locationType?: GenerationIncidentLocationType
    /** Stable server-owned key, never a submitted field value. */
    locationKey?: string
    /** Server-owned Vietnamese label for the stable key. */
    locationLabel?: string
    code?: string
    category?: GenerationIncidentCategory
    validationRule?: GenerationValidationRule
    observedState?: GenerationObservedState
    retryabilityReason?: string
    /** Only use a pre-sanitized, product-owned message. */
    operatorMessage?: string
    userSafeMessage?: string
    /** Use only for diagnostic evidence already sanitized by the caller. */
    sanitizedTechnicalMessage?: string
}

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
    phase: GenerationIncidentPhase
    locationType: GenerationIncidentLocationType
    locationKey?: string
    locationLabel?: string
    validationRule?: GenerationValidationRule
    observedState?: GenerationObservedState
    code: string
    category: GenerationIncidentCategory
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
const SAFE_MESSAGE = 'Chúng tôi chưa thể hoàn thiện website của bạn. Thông tin của bạn đã được lưu.'

const INPUT_LOCATION_LABELS: Record<string, string> = {
    'businessInfo.businessName': 'Tên doanh nghiệp',
    'businessInfo.industry': 'Ngành hàng',
    'businessInfo.shortDescription': 'Mô tả',
    'businessInfo.products': 'Sản phẩm / dịch vụ',
    language: 'Ngôn ngữ',
    template: 'Template',
}
const NON_INPUT_LOCATION_LABELS: Partial<Record<GenerationIncidentLocationType, string>> = {
    site: 'Toàn bộ website', page: 'Trang bị ảnh hưởng', component: 'Component bị ảnh hưởng', unknown: 'Chưa xác định',
}
const INCIDENT_PHASES = new Set<GenerationIncidentPhase>(['validate', 'site_persist', 'page_persist', 'component_persist', 'composition', 'recovery', 'unknown'])
const INCIDENT_LOCATION_TYPES = new Set<GenerationIncidentLocationType>(['input', 'site', 'page', 'component', 'unknown'])
const INCIDENT_CATEGORIES = new Set<GenerationIncidentCategory>(['input_validation', 'persistence', 'composition', 'quota', 'system'])
const VALIDATION_RULES = new Set<GenerationValidationRule>(['required', 'format', 'min_length', 'max_length', 'unsupported_value', 'contract_mismatch'])
const OBSERVED_STATES = new Set<GenerationObservedState>(['missing', 'invalid_format', 'too_short', 'too_long', 'unsupported', 'unknown'])
/** Canonical server-owned F41 incident codes. Read models must use this too. */
export const SERVER_INCIDENT_CODES = new Set([
    'FORM_INVALID', 'INVALID_INPUT', 'INVALID_TEMPLATE_CONTRACT', 'INVALID_COMPONENT_CONTRACT',
    'PAGE_PERSISTENCE_FAILED', 'PAGE_PERSIST_FAILED', 'PAGE_GENERATION_FAILED', 'SITE_PERSISTENCE_FAILED',
    'GENERATION_FAILED', 'GENERATION_TIMEOUT', 'IMAGE_GENERATION_TIMEOUT', 'PERSISTENCE_TIMEOUT',
    'AI_QUOTA_EXCEEDED', 'UPSTREAM_TIMEOUT', 'RECOVERY_TIMEOUT', 'RECOVERY_INVALID_OUTPUT',
    'RECOVERY_GENERATION_FAILED', 'RECOVERY_PREVIOUSLY_TERMINAL',
])

function safeIncidentKey(value: string | undefined): string | undefined {
    if (!value || !/^[a-zA-Z0-9._/-]{1,120}$/.test(value)) return undefined
    return value
}

function safeEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
    return typeof value === 'string' && allowed.has(value as T) ? value as T : undefined
}

function safeIncidentCode(value: unknown): string | undefined {
    return typeof value === 'string' && SERVER_INCIDENT_CODES.has(value) ? value : undefined
}

function inputOperatorMessage(label: string | undefined, rule: GenerationValidationRule | undefined, state: GenerationObservedState | undefined): string {
    const location = label ?? 'Trường thông tin chưa xác định'
    if (rule === 'required' || state === 'missing') return `${location} đang bị thiếu.`
    if (rule === 'format' || state === 'invalid_format') return `${location} chưa đúng định dạng.`
    if (rule === 'min_length' || state === 'too_short') return `${location} chưa đủ thông tin.`
    if (rule === 'max_length' || state === 'too_long') return `${location} vượt giới hạn cho phép.`
    return `${location} chưa hợp lệ.`
}

function safeDiagnosticEvidence(error: unknown, code: string): string {
    const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
    if (/timeout|timed out|etimedout/i.test(raw)) return `Normalized diagnostic: ${code} (timeout).`
    if (/duplicate|unique constraint/i.test(raw)) return `Normalized diagnostic: ${code} (constraint conflict).`
    if (/validation|invalid/i.test(raw)) return `Normalized diagnostic: ${code} (validation rejected).`
    return `Normalized diagnostic: ${code}.`
}

function operatorMessageFor(locationType: GenerationIncidentLocationType, code: string): string {
    if (locationType === 'page') return 'Hệ thống chưa thể lưu một trang của website.'
    if (locationType === 'component') return 'Hệ thống chưa thể lưu một component của website.'
    if (code.includes('TIMEOUT')) return 'Quá trình tạo website mất quá lâu.'
    return 'Hệ thống chưa thể hoàn thiện website.'
}

/**
 * Converts persisted diagnostic text to a bounded operator-safe form. This is
 * exported because read models must defensively sanitize legacy rows too; the
 * field name `sanitizedTechnicalMessage` alone is not a trust boundary.
 */
export function sanitizeGenerationEvidence(value: unknown, maxLength = MAX_MESSAGE_LENGTH): string {
    const raw = value instanceof Error ? value.message : String(value ?? '')
    return raw
        .replace(/\/[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs)/g, '<path>')
        .replace(/(api[_-]?key|authorization|token|password|cookie|set-cookie|client[_-]?secret|secret)\s*[:=]\s*(?:bearer\s+)?[^\r\n,;]+/gi, '$1=<redacted>')
        .replace(/(["'](?:api[_-]?key|authorization|token|password|cookie|set-cookie|client[_-]?secret|secret)["']\s*:\s*["'])(?:bearer\s+)?[^"']*(["'])/gi, '$1<redacted>$2')
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '<redacted-api-key>')
        .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s/@]+:[^\s/@]+@/gi, '<redacted-url-credentials>@')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
}

/**
 * Converts a known, server-owned incident hint to the durable contract.
 * Free-form error text can only become bounded technical evidence; location,
 * category and input metadata are never inferred from it.
 */
export function normalizeGenerationIncident(error: unknown, hint: GenerationIncidentHint = {}): NormalizedGenerationError {
    const message = sanitizeGenerationEvidence(error)
    const timeout = /timeout|timed out|etimedout/i.test(message)
    const phase = safeEnum(hint.phase, INCIDENT_PHASES) ?? 'unknown'
    const locationType = safeEnum(hint.locationType, INCIDENT_LOCATION_TYPES) ?? 'unknown'
    const validationRule = safeEnum(hint.validationRule, VALIDATION_RULES)
    const observedState = safeEnum(hint.observedState, OBSERVED_STATES)
    const rawLocationKey = safeIncidentKey(hint.locationKey)
    // Labels are selected exclusively from a server-owned catalog. Page and
    // component names may be provider- or user-influenced, so the durable
    // incident keeps only its stable key; the read model resolves a display
    // name from separately captured page metadata when it exists.
    const locationLabel = locationType === 'input'
        ? INPUT_LOCATION_LABELS[rawLocationKey ?? '']
        : NON_INPUT_LOCATION_LABELS[locationType]
    const locationKey = locationType === 'input' && !locationLabel ? undefined : rawLocationKey
    const category = safeEnum(hint.category, INCIDENT_CATEGORIES) ?? (phase === 'composition' ? 'composition' : 'persistence')
    const code = safeIncidentCode(hint.code) ?? (timeout ? phase === 'composition' ? 'GENERATION_TIMEOUT' : 'PERSISTENCE_TIMEOUT' : 'GENERATION_FAILED')

    return {
        phase,
        locationType,
        ...(locationKey ? { locationKey } : {}),
        ...(locationLabel ? { locationLabel } : {}),
        ...(validationRule ? { validationRule } : {}),
        ...(observedState ? { observedState } : {}),
        code,
        category,
        retryabilityReason: hint.retryabilityReason ?? (timeout ? 'transient_timeout' : 'requires_operator_review'),
        operatorMessage: locationType === 'input'
            ? inputOperatorMessage(locationLabel, validationRule, observedState)
            : operatorMessageFor(locationType, code),
        userSafeMessage: hint.userSafeMessage ?? SAFE_MESSAGE,
        sanitizedTechnicalMessage: locationType === 'input'
            ? 'Input validation rejected without persisting the submitted value.'
            : safeDiagnosticEvidence(error, code),
        signature: `${locationType}:${code}`,
    }
}

function normalizeError(error: unknown, page?: FailedPage, terminalPhase: TerminalErrorPhase = 'unknown'): NormalizedGenerationError {
    const message = sanitizeGenerationEvidence(error)
    const timeout = /timeout|timed out|etimedout/i.test(message)
    const isComposition = !page && terminalPhase === 'composition'
    const phase: GenerationIncidentPhase = page ? 'page_persist' : isComposition ? 'composition' : terminalPhase === 'site_persist' ? 'site_persist' : 'unknown'
    const locationType: GenerationIncidentLocationType = page ? 'page' : terminalPhase === 'site_persist' ? 'site' : 'unknown'

    return normalizeGenerationIncident(error, {
        phase,
        locationType,
        ...(page ? { locationKey: page.key } : {}),
        code: timeout ? isComposition ? 'GENERATION_TIMEOUT' : 'PERSISTENCE_TIMEOUT' : page ? 'PAGE_PERSISTENCE_FAILED' : terminalPhase === 'site_persist' ? 'SITE_PERSISTENCE_FAILED' : 'GENERATION_FAILED',
        category: isComposition ? 'composition' : 'persistence',
        retryabilityReason: timeout ? 'transient_timeout' : 'requires_operator_review',
        operatorMessage: message || 'Persistence failed without a diagnostic message.',
        sanitizedTechnicalMessage: message || undefined,
    })
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
