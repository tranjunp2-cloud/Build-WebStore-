import { createHash } from 'crypto'
import type { buildGenerationTicketIncidentSnapshot, serializeAdminGenerationDetail } from './generation-recovery-policy'

type GenerationDetail = ReturnType<typeof serializeAdminGenerationDetail>
type TicketSnapshot = NonNullable<ReturnType<typeof buildGenerationTicketIncidentSnapshot>>

export type GenerationIssueDraft = {
    dedupeKey: string
    title: string
    description: string
    severity: 'high' | 'medium'
    relatedId: string
}

export type GenerationIssueEscalationFailure = 'NO_INCIDENT' | 'NOT_TICKET_ELIGIBLE'

function canonicalSignature(detail: GenerationDetail) {
    const incident = detail.incident
    if (!incident) return null
    const rootId = detail.lineage.retryRootGenerationId ?? detail.id
    return JSON.stringify({
        version: 'f41-generation-issue-v1',
        rootId,
        phase: incident.developerEvidence?.phase ?? null,
        kind: incident.kind,
        locationType: incident.location.type,
        locationKey: incident.location.key,
        code: incident.cause.code,
        validationRule: incident.cause.validationRule,
        observedState: incident.cause.observedState,
        recoveryReason: incident.recovery.reasonCode,
    })
}

function line(label: string, value: string | null | undefined) {
    return value ? `${label}: ${value}` : `${label}: Chưa ghi nhận`
}

/**
 * Builds a bounded issue payload from the existing Super Admin-safe detail model.
 * This module must never receive a Payload document or raw user input.
 */
export function buildGenerationIssueDraft(
    detail: GenerationDetail,
    snapshot: TicketSnapshot | null,
): GenerationIssueDraft | GenerationIssueEscalationFailure {
    if (!detail.incident || !snapshot) return 'NO_INCIDENT'
    if (detail.recoveryPolicy.action !== 'create_ticket' && detail.recoveryPolicy.action !== 'open_ticket') return 'NOT_TICKET_ELIGIBLE'

    const signature = canonicalSignature(detail)
    if (!signature) return 'NO_INCIDENT'
    const dedupeKey = `f41i_${createHash('sha256').update(signature, 'utf8').digest('hex')}`
    const incident = snapshot.incident
    const retryRoot = snapshot.lineage.retryRootGenerationId ?? snapshot.generationId
    const description = [
        'Sự cố generation được tạo tự động từ Studio.',
        '',
        line('Generation ID', snapshot.generationId),
        line('Generation gốc', retryRoot),
        line('Website ID', snapshot.website.id),
        line('User ID', snapshot.user.id),
        line('Trace ID', snapshot.traceId),
        '',
        line('Loại sự cố', incident.label),
        line('Vị trí', incident.location.known ? incident.location.label : 'Unknown — generation cũ chưa capture vị trí'),
        line('Mã chuẩn hóa', incident.cause.code),
        line('Nguyên nhân', incident.cause.label),
        line('Ảnh hưởng', incident.impact.summary),
        line('Recovery', incident.recovery.reasonCode),
        line('Lần gen lại', String(snapshot.lineage.retryAttempt)),
        ...(incident.cause.validationRule ? [line('Quy tắc validation', incident.cause.validationRule), line('Trạng thái quan sát', incident.cause.observedState)] : []),
        ...(incident.developerEvidence ? [line('Giai đoạn lỗi', incident.developerEvidence.phase), line('Technical evidence đã sanitize', incident.developerEvidence.technicalMessage)] : []),
    ].join('\n').slice(0, 10_000)

    return {
        dedupeKey,
        title: `[Generation #${snapshot.generationId}] ${incident.label}`.slice(0, 300),
        description,
        severity: incident.kind === 'system' || incident.kind === 'quota' ? 'high' : 'medium',
        relatedId: snapshot.generationId,
    }
}
