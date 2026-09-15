/** Server-owned recovery policy and safe list serialization for F41 Operations. */

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

export type GenerationListSource = {
    id: string | number
    createdAt: string
    lifecycle?: GenerationLifecycle
    outcome?: GenerationOutcome
    recoveryStatus?: GenerationRecoveryStatus
    pageSummary?: { expected?: number | null; persisted?: number | null; failed?: number | null } | null
    generationErrors?: Array<{
        code?: string | null
        phase?: string | null
        locationType?: string | null
        locationKey?: string | null
        operatorMessage?: string | null
        userSafeMessage?: string | null
    }> | null
    user?: { id: string | number; email?: string | null; firstName?: string | null; lastName?: string | null } | string | number | null
    site?: { id: string | number; name?: string | null; slug?: string | null } | string | number | null
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
        // Historic operatorMessage values predate F41 sanitizer; list UI only
        // receives the explicitly user-safe message.
        affectedError: error ? { code: error.code ?? 'UNKNOWN', phase: error.phase ?? 'unknown', locationType: error.locationType ?? 'unknown', locationKey: error.locationKey ?? null, summary: error.userSafeMessage ?? 'Unknown' } : null,
    }
}
