/** Server-owned recovery policy and safe list serialization for F41 Operations. */
import { sanitizeGenerationEvidence, SERVER_INCIDENT_CODES } from './generation-outcome'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

export type GenerationRecoveryStatus =
    | 'none' | 'eligible' | 'retrying' | 'exhausted'
    | 'ticket_required' | 'ticket_created' | 'ticket_verification_required' | 'operator_verifying' | 'operator_resolved' | 'stale_running' | null | undefined

export type GenerationLifecycle = 'queued' | 'running' | 'terminal' | null | undefined
export type GenerationOutcome = 'succeeded' | 'partial_failed' | 'failed' | 'cancelled' | null | undefined

export type RecoveryAction = 'view_detail' | 'monitor' | 'retry_website' | 'create_ticket' | 'open_ticket'
export type GenerationPriority = 'cannot_recover' | 'retryable' | 'retry_failed' | 'retrying' | 'stale_running' | 'history'

export type RecoveryPolicy = {
    action: RecoveryAction
    retryable: boolean
    reasonCode: string
}

export type GenerationIncidentKind = 'quota' | 'system' | 'persistence' | 'page' | 'component' | 'input' | 'unknown'
export type GenerationIncidentSummary = {
    kind: GenerationIncidentKind
    label: string
    scope: string
    totalErrors: number
}

export type GenerationListSource = {
    id: string | number
    createdAt: string
    lifecycle?: GenerationLifecycle
    outcome?: GenerationOutcome
    recoveryStatus?: GenerationRecoveryStatus
    retryRootGeneration?: { id: string | number } | string | number | null
    pageSummary?: { expected?: number | null; persisted?: number | null; failed?: number | null } | null
    generationErrors?: Array<{
        code?: string | null
        category?: string | null
        phase?: string | null
        locationType?: string | null
        locationKey?: string | null
        locationLabel?: string | null
        validationRule?: string | null
        observedState?: string | null
        operatorMessage?: string | null
        userSafeMessage?: string | null
    }> | null
    user?: { id: string | number; email?: string | null; firstName?: string | null; lastName?: string | null } | string | number | null
    site?: { id: string | number; name?: string | null; slug?: string | null } | string | number | null
}

type GenerationError = NonNullable<GenerationListSource['generationErrors']>[number]

const incidentRank: Record<GenerationIncidentKind, number> = {
    quota: 0, system: 1, persistence: 2, page: 3, component: 4, input: 5, unknown: 6,
}

function incidentKindFor(error: GenerationError): GenerationIncidentKind {
    const code = (error.code ?? '').toUpperCase()
    const phase = (error.phase ?? '').toLowerCase()
    const category = (error.category ?? '').toLowerCase()
    const locationType = (error.locationType ?? '').toLowerCase()
    if (/QUOTA|RATE_LIMIT|INSUFFICIENT_CREDIT|BILLING/.test(code) || category === 'quota') return 'quota'
    if (/VALIDATION|INVALID_INPUT|FORM_INVALID/.test(code) || phase.includes('validate') || locationType === 'input') return 'input'
    if (/UPSTREAM|PROVIDER|SYSTEM|INTERNAL|TIMEOUT|UNAVAILABLE/.test(code) || category === 'transient' || category === 'system') return 'system'
    if (locationType === 'page') return 'page'
    if (locationType === 'component') return 'component'
    if (/PERSIST|DATABASE|STORAGE|SAVE/.test(code) || phase.includes('persist') || locationType === 'website') return 'persistence'
    return 'unknown'
}

/**
 * Produces the single operational answer required by the listing. It chooses
 * the most blocking category across every captured error, never array order.
 * Detailed page/component evidence stays out of the list contract.
 */
export function summarizeGenerationIncident(errors: GenerationListSource['generationErrors']): GenerationIncidentSummary | null {
    const captured = errors?.filter(Boolean) ?? []
    if (captured.length === 0) return null
    const primary = captured
        .map((error, index) => ({ error, index, kind: incidentKindFor(error) }))
        .sort((a, b) => incidentRank[a.kind] - incidentRank[b.kind] || a.index - b.index)[0]
    if (!primary) return null
    const labels: Record<GenerationIncidentKind, string> = {
        quota: 'Hết quota AI', system: 'Lỗi hệ thống khi tạo web', persistence: 'Không thể lưu website',
        page: 'Lỗi tạo trang', component: 'Lỗi tạo component', input: 'Dữ liệu đầu vào không hợp lệ', unknown: 'Lỗi tạo website',
    }
    const defaultScope: Record<GenerationIncidentKind, string> = {
        quota: 'Áp dụng toàn website', system: 'Trong lúc tạo website', persistence: 'Sau khi AI tạo nội dung',
        page: 'Một hoặc nhiều trang', component: 'Một hoặc nhiều component', input: 'Cần kiểm tra form nhập', unknown: 'Cần xem chi tiết',
    }
    return {
        kind: primary.kind,
        label: labels[primary.kind],
        // The list intentionally stays at an operational level. Historical
        // location keys are not trustworthy enough to expose outside detail.
        scope: defaultScope[primary.kind],
        totalErrors: captured.length,
    }
}

export function resolveGenerationRecoveryPolicy(record: Pick<GenerationListSource, 'lifecycle' | 'outcome' | 'recoveryStatus'>): RecoveryPolicy {
    switch (record.recoveryStatus) {
        case 'ticket_created': return { action: 'open_ticket', retryable: false, reasonCode: 'TICKET_CREATED' }
        case 'ticket_verification_required': return { action: 'open_ticket', retryable: false, reasonCode: 'TICKET_VERIFICATION_REQUIRED' }
        case 'operator_verifying': return { action: 'open_ticket', retryable: false, reasonCode: 'OPERATOR_VERIFYING' }
        case 'ticket_required':
        case 'exhausted': return { action: 'create_ticket', retryable: false, reasonCode: 'TICKET_REQUIRED' }
        case 'retrying': return { action: 'monitor', retryable: false, reasonCode: 'RETRY_IN_PROGRESS' }
        case 'stale_running': return { action: 'monitor', retryable: false, reasonCode: 'STALE_RUNNING' }
        case 'eligible': return { action: 'retry_website', retryable: true, reasonCode: 'RETRY_ELIGIBLE' }
        default: return { action: 'view_detail', retryable: false, reasonCode: 'NO_RECOVERY_ACTION' }
    }
}

export function resolveGenerationPriority(record: Pick<GenerationListSource, 'lifecycle' | 'outcome' | 'recoveryStatus'>): GenerationPriority {
    if (record.recoveryStatus === 'ticket_required') return 'cannot_recover'
    if (record.recoveryStatus === 'ticket_verification_required' || record.recoveryStatus === 'operator_verifying') return 'cannot_recover'
    if (record.recoveryStatus === 'exhausted') return record.outcome === 'failed' || record.outcome === 'partial_failed' ? 'retry_failed' : 'cannot_recover'
    if (record.recoveryStatus === 'eligible') return 'retryable'
    if (record.recoveryStatus === 'retrying') return 'retrying'
    if (record.recoveryStatus === 'stale_running') return 'stale_running'
    return 'history'
}

export const generationPriorityRank: Record<GenerationPriority, number> = {
    cannot_recover: 0, retryable: 1, retry_failed: 2, retrying: 3, stale_running: 4, history: 5,
}

function relationLabel(value: GenerationListSource['user'] | GenerationListSource['site'], kind: 'user' | 'site') {
    if (!value) return { id: null, label: 'Unknown', missing: true }
    if (typeof value === 'string' || typeof value === 'number') return { id: String(value), label: `#${value}`, missing: false }
    if (kind === 'user' && 'email' in value) {
        const name = [value.firstName, value.lastName].filter(Boolean).join(' ')
        return {
            id: String(value.id),
            label: name || value.email || `#${value.id}`,
            email: typeof value.email === 'string' ? value.email : null,
            missing: false,
        }
    }
    if ('name' in value) return { id: String(value.id), label: value.name || value.slug || `#${value.id}`, missing: false }
    return { id: String(value.id), label: `#${value.id}`, missing: false }
}

export function serializeAdminGeneration(record: GenerationListSource) {
    const error = record.generationErrors?.[0]
    return {
        id: String(record.id), submittedAt: record.createdAt,
        user: relationLabel(record.user, 'user'), site: relationLabel(record.site, 'site'),
        lifecycle: record.lifecycle ?? 'running', outcome: record.outcome ?? null,
        recoveryStatus: record.recoveryStatus ?? 'none', priority: resolveGenerationPriority(record),
        // Every retry in a lineage escalates to one ticket. This stable root
        // identifier lets a reloaded list open that ticket without exposing
        // any raw generation evidence.
        ticketRelatedGenerationId: relationId(record.retryRootGeneration) ?? String(record.id),
        recoveryPolicy: resolveGenerationRecoveryPolicy(record),
        pageSummary: { expected: record.pageSummary?.expected ?? null, persisted: record.pageSummary?.persisted ?? 0, failed: record.pageSummary?.failed ?? 0 },
        incidentSummary: summarizeGenerationIncident(record.generationErrors),
        // Historic error text and location values may contain request data.
        // The list uses the structured incident summary above; retain this
        // legacy field only as a bounded, non-sensitive compatibility shape.
        affectedError: error ? { code: safeIncidentCode(error.code), phase: safeIncidentEnum(error.phase, INCIDENT_PHASES), locationType: safeIncidentEnum(error.locationType, INCIDENT_LOCATION_TYPES), locationKey: null, summary: 'Đã ghi nhận lỗi. Xem chi tiết để xử lý.' } : null,
    }
}

/**
 * Deliberately narrow representation used by the F41 detail API.  It is
 * tempting to return the Payload document after `depth: 2`, but that document
 * can contain promptText, outputSnapshot and historical error strings.  Keep
 * this contract independent from Payload and add a field here only after its
 * operator/privacy purpose has been reviewed.
 */
export type GenerationDetailSource = GenerationListSource & {
    traceId?: string | null
    endpoint?: string | null
    category?: string | null
    inputSchemaVersion?: string | null
    inputHash?: string | null
    inputSnapshot?: unknown
    startedAt?: string | null
    terminalAt?: string | null
    completedAt?: string | null
    lastHeartbeatAt?: string | null
    durationMs?: number | null
    retryAttempt?: number | null
    source?: 'user_submit' | 'ops_retry' | null
    parentGeneration?: { id: string | number } | string | number | null
    retryRootGeneration?: { id: string | number } | string | number | null
    recoveredSite?: { id: string | number; name?: string | null; domain?: string | null; status?: string | null } | string | number | null
    site?: { id: string | number; name?: string | null; slug?: string | null; domain?: string | null; status?: string | null; tenant?: { id: string | number; slug?: string | null } | string | number | null } | string | number | null
    tenant?: { id: string | number; slug?: string | null } | string | number | null
    user?: { id: string | number; email?: string | null; firstName?: string | null; lastName?: string | null } | string | number | null
    pageOutcomes?: Array<{ pageKey?: string | null; title?: string | null; slug?: string | null; pageId?: string | null; status?: string | null; blockCount?: number | null; errorCode?: string | null; errorSummary?: string | null }> | null
    generationErrors?: Array<{ phase?: string | null; locationType?: string | null; locationKey?: string | null; locationLabel?: string | null; validationRule?: string | null; observedState?: string | null; code?: string | null; category?: string | null; retryabilityReason?: string | null; userSafeMessage?: string | null; sanitizedTechnicalMessage?: string | null }> | null
}

export type GenerationRecoveryJobDetailSource = {
    id: string | number
    sourceGeneration?: { id: string | number } | string | number | null
    childGeneration?: { id: string | number } | string | number | null
    status?: string | null
    retryAttempt?: number | null
    queuedAt?: string | null
    startedAt?: string | null
    finishedAt?: string | null
}

type InputSnapshot = {
    businessInfo?: Record<string, unknown>
    extraInstructions?: unknown
    language?: unknown
    generationLocale?: unknown
    contentBrief?: unknown
}

function safeString(value: unknown, maxLength = 1_000) {
    if (typeof value !== 'string') return null
    return value
        .replace(/(api[_-]?key|authorization|token|password|cookie|client[_-]?secret|secret)\s*[:=]\s*(?:bearer\s+)?[^\r\n,;]+/gi, '$1=<redacted>')
        .replace(/(["'](?:api[_-]?key|authorization|token|password|cookie|client[_-]?secret|secret)["']\s*:\s*["'])(?:bearer\s+)?[^"']*(["'])/gi, '$1<redacted>$2')
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '<redacted-api-key>')
        .slice(0, maxLength)
}

function safeStringList(value: unknown, maxItems = 12) {
    if (!Array.isArray(value)) return []
    return value.map((item) => safeString(item, 240)).filter((item): item is string => Boolean(item)).slice(0, maxItems)
}

function recordItems(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
        ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : []
}

function safeDiagnostic(value: unknown, maxLength = 500) {
    return sanitizeGenerationEvidence(value, maxLength) || null
}

function safeTechnicalEvidence(value: unknown) {
    if (typeof value !== 'string') return null
    const match = /^Normalized diagnostic: ([A-Z][A-Z0-9_]{1,79})(?: \([a-z_ -]{1,80}\))?\.$/.exec(value.trim())
    return match && SERVER_INCIDENT_CODES.has(match[1]) ? match[0] : null
}
const INPUT_INCIDENT_LABELS: Record<string, string> = { 'businessInfo.businessName': 'Tên doanh nghiệp', 'businessInfo.industry': 'Ngành hàng', 'businessInfo.shortDescription': 'Mô tả', 'businessInfo.products': 'Sản phẩm / dịch vụ', language: 'Ngôn ngữ', template: 'Template' }
const INCIDENT_LOCATION_LABELS: Record<string, string> = { site: 'Toàn bộ website', page: 'Trang bị ảnh hưởng', component: 'Component bị ảnh hưởng', unknown: 'Chưa xác định' }
const INCIDENT_LOCATION_TYPES = new Set(['input', 'site', 'page', 'component', 'unknown'])
const INCIDENT_PHASES = new Set(['validate', 'site_persist', 'page_persist', 'component_persist', 'composition', 'recovery', 'unknown'])
const INCIDENT_CATEGORIES = new Set(['input_validation', 'persistence', 'composition', 'quota', 'system'])
const VALIDATION_RULES = new Set(['required', 'format', 'min_length', 'max_length', 'unsupported_value', 'contract_mismatch'])
const OBSERVED_STATES = new Set(['missing', 'invalid_format', 'too_short', 'too_long', 'unsupported', 'unknown'])
function safeIncidentEnum(value: unknown, allowed: Set<string>, fallback = 'unknown') { return typeof value === 'string' && allowed.has(value) ? value : fallback }
function safeIncidentCode(value: unknown) { return typeof value === 'string' && SERVER_INCIDENT_CODES.has(value) ? value : 'UNKNOWN' }
function safeIncidentLocationKey(value: unknown) {
    return typeof value === 'string' && /^[a-zA-Z0-9._/-]{1,120}$/.test(value) ? value : null
}
function safeTraceId(value: unknown) {
    if (typeof value !== 'string') return null
    const id = value.trim()
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
        || /^f41-ui-fixture-[a-z0-9-]{1,40}$/i.test(id)
        || /^tr_[a-zA-Z0-9_-]{8,60}$/.test(id)
        ? id
        : null
}

function incidentCause(kind: GenerationIncidentKind, code: string) {
    const labels: Record<GenerationIncidentKind, string> = {
        input: 'Thông tin form chưa hợp lệ', quota: 'Không đủ quota AI để tiếp tục', system: 'Dịch vụ tạo website gặp sự cố',
        persistence: 'Không thể lưu website', page: 'Không thể tạo trang', component: 'Không thể tạo component', unknown: 'Chưa có đủ dữ liệu để xác định nguyên nhân',
    }
    return { label: labels[kind], code }
}

function relationId(value: { id: string | number } | string | number | null | undefined) {
    if (!value) return null
    return String(typeof value === 'object' ? value.id : value)
}

function safeInput(snapshot: unknown) {
    const source = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as InputSnapshot : null
    const business = source?.businessInfo && typeof source.businessInfo === 'object' && !Array.isArray(source.businessInfo) ? source.businessInfo : {}
    const fields = [
        ['Tên doanh nghiệp', safeString(business.businessName)],
        ['Ngành hàng', safeString(business.industry)],
        ['Mô tả', safeString(business.shortDescription)],
        ['Sản phẩm / dịch vụ', safeString(business.products)],
        ['Ngôn ngữ', safeString(source?.language) ?? safeString(source?.generationLocale)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    return {
        available: Boolean(source),
        summary: fields,
        full: source ? {
            businessName: safeString(business.businessName), industry: safeString(business.industry),
            shortDescription: safeString(business.shortDescription), products: safeString(business.products),
            services: safeStringList(business.services), language: safeString(source.language),
            generationLocale: safeString(source.generationLocale), extraInstructions: safeString(source.extraInstructions),
            // contentBrief can be nested/freeform, so expose only its existence.
            contentBriefCaptured: source.contentBrief !== null && source.contentBrief !== undefined,
        } : null,
    }
}

function siteDetail(value: GenerationDetailSource['site'] | GenerationDetailSource['recoveredSite']) {
    if (!value) return { id: null, name: 'Chưa có website', domain: null, status: null }
    if (typeof value === 'string' || typeof value === 'number') return { id: String(value), name: `#${value}`, domain: null, status: null }
    return { id: String(value.id), name: value.name ?? `#${value.id}`, domain: value.domain ?? null, status: value.status ?? null }
}

function siteUrls(site: ReturnType<typeof siteDetail>, tenantSlug?: string | null) {
    const isPublished = site.status === 'published' || site.status === 'live'
    const liveUrl = site.domain || (isPublished && tenantSlug ? buildStorefrontUrl(tenantSlug) : null)
    return {
        // This is an internal, operator-only preview route; it is derived from
        // the database id rather than accepting an arbitrary stored URL.
        preview: site.id ? `/preview/${encodeURIComponent(site.id)}` : null,
        live: liveUrl,
    }
}

function userDetail(value: GenerationDetailSource['user']) {
    if (!value) return { id: null, name: 'Unknown', email: null }
    if (typeof value === 'string' || typeof value === 'number') return { id: String(value), name: `#${value}`, email: null }
    const name = [value.firstName, value.lastName].filter(Boolean).join(' ')
    return { id: String(value.id), name: name || value.email || `#${value.id}`, email: value.email ?? null }
}

type DetailPageLocation = { pageKey: string | null; title: string; slug: string | null }

/**
 * Page/component error rows contain only a stable key. Resolve the human label
 * from separately captured page metadata, never from the durable error itself.
 */
function resolveIncidentLocation(type: string, key: string | null, pages: DetailPageLocation[]) {
    if (type === 'input') return { key, label: key ? INPUT_INCIDENT_LABELS[key] ?? 'Chưa xác định' : 'Chưa xác định', known: Boolean(key && INPUT_INCIDENT_LABELS[key]) }
    if (type === 'site') return { key: null, label: 'Toàn bộ website', known: true }
    if (type === 'page' && key) {
        const page = pages.find((item) => item.pageKey === key || item.slug === key)
        return page ? { key, label: page.title, known: true } : { key: null, label: 'Chưa xác định từ generation cũ', known: false }
    }
    if (type === 'component' && key) {
        const page = pages
            .filter((item) => item.pageKey && key.startsWith(`${item.pageKey}-`))
            .sort((a, b) => (b.pageKey?.length ?? 0) - (a.pageKey?.length ?? 0))[0]
        const componentKey = page?.pageKey ? key.slice(page.pageKey.length + 1) : ''
        if (page && /^[a-zA-Z0-9._/-]{1,80}$/.test(componentKey)) {
            const componentLabel = componentKey.split(/[-_/]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
            return { key, label: componentLabel ? `${page.title} / ${componentLabel}` : page.title, known: true }
        }
        return { key: null, label: 'Chưa xác định từ generation cũ', known: false }
    }
    return { key: null, label: 'Chưa xác định', known: false }
}

/** Safe, bounded debugger detail. Never add raw prompt/output/request/stack data. */
export function serializeAdminGenerationDetail(
    record: GenerationDetailSource,
    retryHistory: GenerationDetailSource[] = [],
    recoveryJobs: GenerationRecoveryJobDetailSource[] = [],
    tenantSlug?: string | null,
) {
    const summary = serializeAdminGeneration(record)
    const capturedSite = siteDetail(record.site)
    const recoveredSite = siteDetail(record.recoveredSite)
    // A recovery can create the website before the parent generation has been
    // linked to it. Prefer the original relation, but do not hide the recovery
    // website in that transitional state.
    const site = capturedSite.id ? capturedSite : recoveredSite
    const siteTenantSlug = record.site && typeof record.site === 'object' && 'tenant' in record.site && typeof (record.site as Record<string, unknown>).tenant === 'object' && typeof ((record.site as Record<string, unknown>).tenant as Record<string, unknown>)?.slug === 'string' ? ((record.site as Record<string, unknown>).tenant as Record<string, unknown>).slug as string : null
    const recordTenantSlug = record.tenant && typeof record.tenant === 'object' && 'slug' in record.tenant && typeof record.tenant.slug === 'string' ? record.tenant.slug : null
    const resolvedTenantSlug = tenantSlug ?? recordTenantSlug ?? siteTenantSlug
    const boundedRawErrors = recordItems(record.generationErrors).slice(0, 20)
    const pages = recordItems(record.pageOutcomes).slice(0, 100).map((page) => ({
        pageKey: safeDiagnostic(page.pageKey, 160), title: safeDiagnostic(page.title, 240) ?? safeDiagnostic(page.slug, 160) ?? 'Trang chưa đặt tên', slug: safeDiagnostic(page.slug, 160),
        pageId: safeDiagnostic(page.pageId, 120), status: page.status === 'persisted' ? 'persisted' : page.status === 'failed' ? 'failed' : 'unknown', blockCount: typeof page.blockCount === 'number' && Number.isFinite(page.blockCount) ? page.blockCount : null,
        errorCode: safeDiagnostic(page.errorCode, 120), errorSummary: safeDiagnostic(page.errorSummary),
    }))
    const errors = boundedRawErrors.map((error) => {
        const locationType = safeIncidentEnum(error.locationType, INCIDENT_LOCATION_TYPES)
        const candidateKey = safeIncidentLocationKey(error.locationKey)
        // The only durable field keys are the server-owned input schema keys.
        // Page/component labels can originate in prompts or old AI output and
        // are therefore shown only through their separately sanitized tree.
        const locationKey = locationType === 'input'
            ? INPUT_INCIDENT_LABELS[candidateKey ?? ''] ? candidateKey : null
            : candidateKey
        const location = resolveIncidentLocation(locationType, locationKey, pages)
        return {
        phase: safeIncidentEnum(error.phase, INCIDENT_PHASES), locationType, locationKey,
        locationLabel: location.label, locationKnown: location.known,
        validationRule: safeIncidentEnum(error.validationRule, VALIDATION_RULES, '') || null, observedState: safeIncidentEnum(error.observedState, OBSERVED_STATES, '') || null,
        code: safeIncidentCode(error.code), category: safeIncidentEnum(error.category, INCIDENT_CATEGORIES), retryabilityReason: null,
        message: 'Đã ghi nhận lỗi an toàn. Xem nguyên nhân và hành động được đề xuất bên dưới.', technicalMessage: safeTechnicalEvidence(error.sanitizedTechnicalMessage),
    }})
    const timestamps = [
        ['submitted', record.createdAt], ['started', record.startedAt], ['last_heartbeat', record.lastHeartbeatAt],
        ['terminal', record.terminalAt ?? record.completedAt],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([event, at]) => ({ event, at }))
    const recoveryTimeline = recoveryJobs.slice(0, 10).flatMap((job) => [
        ['recovery_queued', job.queuedAt], ['recovery_started', job.startedAt], ['recovery_finished', job.finishedAt],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([event, at]) => ({
        event,
        at,
        jobId: String(job.id),
        jobStatus: job.status ?? 'unknown',
        childGenerationId: relationId(job.childGeneration),
    })))
    const incidentSummary = summarizeGenerationIncident(boundedRawErrors)
    const primary = errors.find((error) => incidentSummary && incidentKindFor(error) === incidentSummary.kind) ?? errors[0]
    const inputIncident = incidentSummary?.kind === 'input'
    const isLegacy = Boolean((record.outcome === 'failed' || record.outcome === 'partial_failed') && errors.length === 0)
    const incident = !incidentSummary ? null : {
        kind: incidentSummary.kind,
        label: incidentSummary.label,
        location: {
            type: primary?.locationType ?? 'unknown', key: primary?.locationKey ?? null,
            label: primary?.locationLabel ?? 'Chưa xác định', known: primary?.locationKnown ?? false,
        },
        cause: { ...incidentCause(incidentSummary.kind, primary?.code ?? 'UNKNOWN'), phase: primary?.phase ?? 'unknown', validationRule: primary?.validationRule ?? null, observedState: primary?.observedState ?? null },
        impact: { expected: summary.pageSummary.expected, persisted: summary.pageSummary.persisted, failed: summary.pageSummary.failed, summary: summary.pageSummary.expected === null ? 'Chưa ghi nhận tổng số trang.' : `${summary.pageSummary.failed}/${summary.pageSummary.expected} trang chưa tạo, ${summary.pageSummary.persisted} trang đã lưu.` },
        recovery: { retryable: summary.recoveryPolicy.retryable, scope: summary.recoveryPolicy.retryable ? 'website' : 'none', reasonCode: summary.recoveryPolicy.reasonCode },
        owner: inputIncident ? { kind: 'user', label: 'Người dùng cần điều chỉnh form' } : summary.recoveryPolicy.action === 'create_ticket' || summary.recoveryPolicy.action === 'open_ticket' ? { kind: 'dev', label: 'Team Dev' } : { kind: 'operator', label: 'Người trực tracking' },
        nextAction: inputIncident ? { kind: 'none', label: 'Chờ người dùng điều chỉnh form và gửi lại.' } : summary.recoveryPolicy.action === 'retry_website' ? { kind: 'retry_website', label: 'Gen lại toàn bộ website.' } : summary.recoveryPolicy.action === 'create_ticket' || summary.recoveryPolicy.action === 'open_ticket' ? { kind: 'open_issues', label: summary.recoveryPolicy.action === 'open_ticket' ? 'Mở ticket hiện có trong Issues & feedback.' : 'Tạo ticket để team Dev điều tra.' } : { kind: 'monitor', label: 'Theo dõi generation và timeline.' },
        developerEvidence: primary?.technicalMessage ? { phase: primary.phase, technicalMessage: primary.technicalMessage } : null,
        legacy: false, relatedErrorCount: errors.length,
    }
    const legacyIncident = isLegacy ? { kind: 'unknown' as const, label: 'Chưa xác định lỗi', location: { type: 'unknown', key: null, label: 'Chưa xác định', known: false }, cause: { ...incidentCause('unknown', 'UNKNOWN'), phase: 'unknown', validationRule: null, observedState: null }, impact: { expected: summary.pageSummary.expected, persisted: summary.pageSummary.persisted, failed: summary.pageSummary.failed, summary: summary.pageSummary.expected === null ? 'Chưa ghi nhận tổng số trang.' : `${summary.pageSummary.failed}/${summary.pageSummary.expected} trang chưa tạo, ${summary.pageSummary.persisted} trang đã lưu.` }, recovery: { retryable: summary.recoveryPolicy.retryable, scope: summary.recoveryPolicy.retryable ? 'website' : 'none', reasonCode: summary.recoveryPolicy.reasonCode }, owner: { kind: 'operator', label: 'Người trực tracking' }, nextAction: { kind: 'monitor', label: 'Kiểm tra timeline hoặc lần gen lại để tiếp tục điều tra.' }, developerEvidence: null, legacy: true, relatedErrorCount: 0 } : null
    return {
        ...summary,
        endpoint: record.endpoint ?? 'site-generator', category: record.category ?? null,
        website: { ...site, urls: siteUrls(site, resolvedTenantSlug) },
        recoveredWebsite: record.recoveredSite && recoveredSite.id !== site.id ? { ...recoveredSite, urls: siteUrls(recoveredSite, resolvedTenantSlug) } : null,
        user: userDetail(record.user),
        traceId: safeTraceId(record.traceId),
        input: safeInput(record.inputSnapshot), inputSchemaVersion: record.inputSchemaVersion ?? null,
        inputHash: record.inputHash ? record.inputHash.slice(0, 16) : null,
        pages, errors, incident: incident ?? legacyIncident, timeline: [...timestamps, ...recoveryTimeline].sort((a, b) => a.at.localeCompare(b.at)), durationMs: record.durationMs ?? null,
        lineage: { source: record.source ?? 'user_submit', parentGenerationId: relationId(record.parentGeneration), retryRootGenerationId: relationId(record.retryRootGeneration), retryAttempt: record.retryAttempt ?? 0 },
        retryHistory: retryHistory.filter((item) => String(item.id) !== String(record.id)).slice(0, 10).map((item) => ({ id: String(item.id), submittedAt: item.createdAt, outcome: item.outcome ?? null, recoveryStatus: item.recoveryStatus ?? 'none', retryAttempt: item.retryAttempt ?? 0 })),
    }
}

/** Pure, sanitized handoff for US-F41-05. It deliberately performs no mutation. */
export function buildGenerationTicketIncidentSnapshot(detail: ReturnType<typeof serializeAdminGenerationDetail>) {
    if (!detail.incident) return null
    // The issue is an internal, Super Admin-only handoff. Keep enough
    // relationship and execution context for Dev to find the affected user,
    // then reproduce by inspection; do not copy form values, prompts or raw
    // provider output into a durable ticket.
    return {
        generationId: detail.id,
        generationDetailHref: `/studio/generations/${encodeURIComponent(detail.id)}`,
        traceId: safeTraceId(detail.traceId),
        incident: detail.incident,
        website: {
            id: detail.website.id,
            name: detail.website.name,
            previewHref: detail.website.urls.preview,
        },
        user: {
            id: detail.user.id,
            name: detail.user.name,
            email: detail.user.email,
        },
        execution: {
            endpoint: detail.endpoint,
            source: detail.lineage.source,
            inputSchemaVersion: detail.inputSchemaVersion,
            inputHash: detail.inputHash,
            submittedAt: detail.submittedAt,
            terminalAt: detail.timeline.find((item) => item.event === 'terminal')?.at ?? null,
        },
        lineage: detail.lineage,
    }
}
