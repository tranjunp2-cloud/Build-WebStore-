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
        phase: incident.cause.phase,
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

function ticketLocationLabel(type: string) {
    const labels: Record<string, string> = {
        input: 'Form tạo website', page: 'Trang bị ảnh hưởng', component: 'Component bị ảnh hưởng', site: 'Toàn bộ website', unknown: 'Chưa xác định',
    }
    return labels[type] ?? 'Chưa xác định'
}

function priorityForSeverity(severity: GenerationIssueDraft['severity']) {
    return severity === 'high' ? 'P1' : 'P2'
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
    const website = snapshot.website.name || 'Chưa có website'
    const user = snapshot.user.name || 'Chưa xác định người dùng'
    const locationKey = incident.location.key ? `${incident.location.type}:${incident.location.key}` : incident.location.type
    const severity = incident.kind === 'system' || incident.kind === 'quota' ? 'high' : 'medium'
    const description = [
        `# Bug Report: ${incident.label}`,
        '',
        `**Bug ID:** BUG-F41-G${retryRoot}`,
        '**Feature/Module:** F41 – User Generations / Website generation',
        '**Environment:** Chưa được hệ thống capture tự động — đối chiếu môi trường tại link Generation',
        '**Browser/Device:** Không áp dụng; lỗi được hệ thống ghi nhận trong pipeline generation',
        '**Tester:** Studio automation · người trực tracking',
        `**Date:** ${snapshot.execution.terminalAt ?? snapshot.execution.submittedAt ?? 'Chưa ghi nhận'}`,
        `**Severity:** ${severity === 'high' ? 'High' : 'Medium'}`,
        `**Priority:** ${priorityForSeverity(severity)}`,
        '',
        '### Preconditions',
        '- Đăng nhập Studio bằng quyền Super Admin.',
        `- Có generation [#${snapshot.generationId}](${snapshot.generationDetailHref})${retryRoot !== snapshot.generationId ? ` thuộc generation gốc #${retryRoot}` : ''}.`,
        `- Website bị ảnh hưởng: **${website}**${snapshot.website.id ? ` (Website #${snapshot.website.id})` : ''}.`,
        `- Người dùng bị ảnh hưởng: **${user}**${snapshot.user.id ? ` (User #${snapshot.user.id})` : ''}${snapshot.user.email ? ` · ${snapshot.user.email}` : ''}.`,
        '',
        '### Steps to Reproduce',
        `1. Truy cập [Generation #${snapshot.generationId}](${snapshot.generationDetailHref}) bằng quyền Super Admin.`,
        '2. Mở mục “Thông tin user đã nhập” để xác nhận bản form đã được chuẩn hoá.',
        `3. Mở “Sự cố cần xử lý”, đối chiếu mã lỗi \`${incident.cause.code}\`, giai đoạn \`${incident.cause.phase}\` và vị trí \`${locationKey}\`.`,
        '4. Không gen lại mù trên production; dùng trace ID và log pipeline để tái hiện/analyze trước.',
        '',
        '### Actual Result',
        `- Website generation gặp **${incident.label}** tại ${ticketLocationLabel(incident.location.type).toLowerCase()}.`,
        `- Vị trí: ${ticketLocationLabel(incident.location.type)}; giai đoạn: \`${incident.cause.phase}\`.`,
        `- ${incident.impact.summary}`,
        `- Mã lỗi: \`${incident.cause.code}\`; nguyên nhân chuẩn hoá: ${incident.cause.label}.`,
        `- Lần gen lại: ${snapshot.lineage.retryAttempt}.`,
        ...(incident.cause.validationRule ? [`- Quy tắc validation: ${incident.cause.validationRule}; trạng thái quan sát: ${incident.cause.observedState ?? 'Chưa ghi nhận'}.`] : []),
        '',
        '### Expected Result',
        `- ${incident.impact.expected ?? 'Các'} trang được tạo và lưu thành công sau khi pipeline xử lý dữ liệu hợp lệ.`,
        '- Không phát sinh lỗi generation ở cùng mã lỗi/giai đoạn; website có thể tiếp tục được người dùng sử dụng.',
        '',
        '### Evidence',
        `- Generation detail: [mở Generation #${snapshot.generationId}](${snapshot.generationDetailHref}).`,
        ...(snapshot.website.previewHref ? [`- Preview nội bộ: [mở preview](${snapshot.website.previewHref}).`] : []),
        `- Trace ID: \`${snapshot.traceId ?? 'Chưa ghi nhận'}\`.`,
        `- Technical context: endpoint \`${snapshot.execution.endpoint}\`, source \`${snapshot.execution.source}\`, input schema \`${snapshot.execution.inputSchemaVersion ?? 'Chưa ghi nhận'}\`, input hash \`${snapshot.execution.inputHash ?? 'Chưa ghi nhận'}\`.`,
        ...(incident.developerEvidence ? [`- Diagnostic chuẩn hoá: \`${incident.developerEvidence.technicalMessage}\`.`] : ['- Console error / Network response: Chưa capture tự động; đối chiếu theo trace ID và log pipeline.']),
        '',
        '### Impact',
        `- Ảnh hưởng đến: website **${website}**, người dùng **${user}**; ${incident.impact.summary}`,
        '- Tần suất: Once cho generation này; cần đối chiếu trace/log để kết luận có lặp lại hay không.',
        `- Có workaround: ${incident.recovery.retryable ? 'Có — người trực có thể gen lại website theo policy.' : 'Không — cần Dev điều tra và cập nhật hướng xử lý.'}`,
        '',
        '### Dev handoff / Definition of Done',
        '1. Xác định root cause từ trace ID và mã lỗi; ghi rõ owner xử lý.',
        '2. Sửa lỗi hoặc ghi rõ quyết định không xử lý được cùng hướng dẫn cho người trực.',
        '3. Cập nhật ticket theo workflow: Backlog → Reopen (nếu cần) → Dev đang xử lý → Dev đã sửa → QA Testing → Done.',
        '4. Khi chuyển Hoàn tất, generation được trả về User Generations để người trực test lại.',
        '',
        '### Safe technical context',
        `- ${line('Generation ID', snapshot.generationId)}`,
        `- ${line('Generation gốc', retryRoot)}`,
        `- ${line('Website ID', snapshot.website.id)}`,
        `- ${line('User ID', snapshot.user.id)}`,
        `- ${line('Trace ID', snapshot.traceId)}`,
        `- ${line('Endpoint', snapshot.execution.endpoint)}`,
        `- ${line('Nguồn generation', snapshot.execution.source)}`,
        `- ${line('Input schema version', snapshot.execution.inputSchemaVersion)}`,
        `- ${line('Input hash', snapshot.execution.inputHash)}`,
        `- ${line('Thời điểm gửi form', snapshot.execution.submittedAt)}`,
        `- ${line('Thời điểm kết thúc', snapshot.execution.terminalAt)}`,
        `- ${line('Recovery state', incident.recovery.reasonCode)}`,
    ].join('\n').slice(0, 10_000)

    return {
        dedupeKey,
        title: `[Generation #${snapshot.generationId}] ${incident.label}`.slice(0, 300),
        description,
        severity,
        // A ticket belongs to the retry lineage, not a particular attempt.
        // This makes the same ticket discoverable from the root and every
        // retry after the UI reloads.
        relatedId: retryRoot,
    }
}
