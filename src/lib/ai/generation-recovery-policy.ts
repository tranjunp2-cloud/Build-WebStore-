/** Server-owned recovery policy and safe list serialization for F41 Operations. */
import { sanitizeGenerationEvidence } from './generation-outcome'

export type GenerationRecoveryStatus =
    | 'none' | 'eligible' | 'retrying' | 'exhausted'
    | 'ticket_required' | 'ticket_created' | 'stale_running' | null | undefined

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
    pageSummary?: { expected?: number | null; persisted?: number | null; failed?: number | null } | null
    generationErrors?: Array<{
        code?: string | null
        category?: string | null
        phase?: string | null
        locationType?: string | null
        locationKey?: string | null
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
    if (/PERSIST|DATABASE|STORAGE|SAVE/.test(code) || phase.includes('persist') || locationType === 'website') return 'persistence'
    if (locationType === 'page') return 'page'
    if (locationType === 'component') return 'component'
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
        scope: primary.error.locationKey || defaultScope[primary.kind],
        totalErrors: captured.length,
    }
}

export function resolveGenerationRecoveryPolicy(record: Pick<GenerationListSource, 'lifecycle' | 'outcome' | 'recoveryStatus'>): RecoveryPolicy {
    switch (record.recoveryStatus) {
        case 'ticket_created': return { action: 'open_ticket', retryable: false, reasonCode: 'TICKET_CREATED' }
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
        return { id: String(value.id), label: name || value.email || `#${value.id}`, missing: false }
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
        recoveryPolicy: resolveGenerationRecoveryPolicy(record),
        pageSummary: { expected: record.pageSummary?.expected ?? null, persisted: record.pageSummary?.persisted ?? 0, failed: record.pageSummary?.failed ?? 0 },
        incidentSummary: summarizeGenerationIncident(record.generationErrors),
        // Historic operatorMessage values predate F41 sanitizer; list UI only
        // receives the explicitly user-safe message.
        affectedError: error ? { code: error.code ?? 'UNKNOWN', phase: error.phase ?? 'unknown', locationType: error.locationType ?? 'unknown', locationKey: error.locationKey ?? null, summary: error.userSafeMessage ?? 'Unknown' } : null,
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
    site?: { id: string | number; name?: string | null; slug?: string | null; domain?: string | null; status?: string | null } | string | number | null
    user?: { id: string | number; email?: string | null; firstName?: string | null; lastName?: string | null } | string | number | null
    pageOutcomes?: Array<{ pageKey?: string | null; title?: string | null; slug?: string | null; pageId?: string | null; status?: string | null; blockCount?: number | null; errorCode?: string | null; errorSummary?: string | null }> | null
    generationErrors?: Array<{ phase?: string | null; locationType?: string | null; locationKey?: string | null; code?: string | null; category?: string | null; retryabilityReason?: string | null; userSafeMessage?: string | null; sanitizedTechnicalMessage?: string | null }> | null
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

function siteUrls(site: ReturnType<typeof siteDetail>) {
    return {
        // This is an internal, operator-only preview route; it is derived from
        // the database id rather than accepting an arbitrary stored URL.
        preview: site.id ? `/preview/${encodeURIComponent(site.id)}` : null,
        live: site.domain,
    }
}

function userDetail(value: GenerationDetailSource['user']) {
    if (!value) return { id: null, name: 'Unknown', email: null }
    if (typeof value === 'string' || typeof value === 'number') return { id: String(value), name: `#${value}`, email: null }
    const name = [value.firstName, value.lastName].filter(Boolean).join(' ')
    return { id: String(value.id), name: name || value.email || `#${value.id}`, email: value.email ?? null }
}

/** Safe, bounded debugger detail. Never add raw prompt/output/request/stack data. */
export function serializeAdminGenerationDetail(
    record: GenerationDetailSource,
    retryHistory: GenerationDetailSource[] = [],
    recoveryJobs: GenerationRecoveryJobDetailSource[] = [],
) {
    const summary = serializeAdminGeneration(record)
    const capturedSite = siteDetail(record.site)
    const recoveredSite = siteDetail(record.recoveredSite)
    // A recovery can create the website before the parent generation has been
    // linked to it. Prefer the original relation, but do not hide the recovery
    // website in that transitional state.
    const site = capturedSite.id ? capturedSite : recoveredSite
    const errors = recordItems(record.generationErrors).slice(0, 20).map((error) => ({
        phase: safeDiagnostic(error.phase, 100) ?? 'unknown', locationType: safeDiagnostic(error.locationType, 100) ?? 'unknown', locationKey: safeDiagnostic(error.locationKey, 160),
        code: safeDiagnostic(error.code, 120) ?? 'UNKNOWN', category: safeDiagnostic(error.category, 100) ?? 'unknown', retryabilityReason: safeDiagnostic(error.retryabilityReason, 160),
        message: safeDiagnostic(error.userSafeMessage) ?? 'Không có mô tả lỗi an toàn.', technicalMessage: safeDiagnostic(error.sanitizedTechnicalMessage),
    }))
    const pages = recordItems(record.pageOutcomes).slice(0, 100).map((page) => ({
        pageKey: safeDiagnostic(page.pageKey, 160), title: safeDiagnostic(page.title, 240) ?? safeDiagnostic(page.slug, 160) ?? 'Trang chưa đặt tên', slug: safeDiagnostic(page.slug, 160),
        pageId: safeDiagnostic(page.pageId, 120), status: page.status === 'persisted' ? 'persisted' : page.status === 'failed' ? 'failed' : 'unknown', blockCount: typeof page.blockCount === 'number' && Number.isFinite(page.blockCount) ? page.blockCount : null,
        errorCode: safeDiagnostic(page.errorCode, 120), errorSummary: safeDiagnostic(page.errorSummary),
    }))
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
    return {
        ...summary,
        endpoint: record.endpoint ?? 'site-generator', category: record.category ?? null,
        website: { ...site, urls: siteUrls(site) },
        recoveredWebsite: record.recoveredSite && recoveredSite.id !== site.id ? { ...recoveredSite, urls: siteUrls(recoveredSite) } : null,
        user: userDetail(record.user),
        input: safeInput(record.inputSnapshot), inputSchemaVersion: record.inputSchemaVersion ?? null,
        inputHash: record.inputHash ? record.inputHash.slice(0, 16) : null,
        pages, errors, timeline: [...timestamps, ...recoveryTimeline].sort((a, b) => a.at.localeCompare(b.at)), durationMs: record.durationMs ?? null,
        lineage: { source: record.source ?? 'user_submit', parentGenerationId: relationId(record.parentGeneration), retryRootGenerationId: relationId(record.retryRootGeneration), retryAttempt: record.retryAttempt ?? 0 },
        retryHistory: retryHistory.filter((item) => String(item.id) !== String(record.id)).slice(0, 10).map((item) => ({ id: String(item.id), submittedAt: item.createdAt, outcome: item.outcome ?? null, recoveryStatus: item.recoveryStatus ?? 'none', retryAttempt: item.retryAttempt ?? 0 })),
    }
}
