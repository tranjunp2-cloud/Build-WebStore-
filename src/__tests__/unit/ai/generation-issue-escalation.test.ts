import { describe, expect, it } from 'vitest'
import { buildGenerationIssueDraft } from '@/lib/ai/generation-issue-escalation'
import { buildGenerationTicketIncidentSnapshot, serializeAdminGenerationDetail } from '@/lib/ai/generation-recovery-policy'

function detail(overrides: Record<string, unknown> = {}) {
    return serializeAdminGenerationDetail({
        id: 41,
        createdAt: '2026-09-16T00:00:00.000Z',
        lifecycle: 'terminal',
        outcome: 'failed',
        recoveryStatus: 'ticket_required',
        inputSnapshot: { businessInfo: { businessName: 'Không được lộ', shortDescription: 'private@example.test' } },
        promptText: 'prompt must never reach issue',
        traceId: 'tr_generation_issue_41',
        generationErrors: [{ phase: 'persist_page', locationType: 'page', locationKey: 'contact', locationLabel: 'Trang lỗi', code: 'PAGE_GENERATION_FAILED', category: 'system', userSafeMessage: 'Không thể lưu trang', sanitizedTechnicalMessage: 'Database write timed out' }],
        pageSummary: { expected: 5, persisted: 4, failed: 1 },
        ...overrides,
    } as never, [], [])
}

describe('[TC-F41-21/22/29] generation issue escalation draft', () => {
    it('TC-F41-21: derives a deterministic, safe ticket from the server detail model', () => {
        // Arrange
        const generation = detail()

        // Act
        const draft = buildGenerationIssueDraft(generation, buildGenerationTicketIncidentSnapshot(generation))

        // Assert
        expect(draft).toMatchObject({ relatedId: '41', severity: 'high' })
        expect(typeof draft === 'string' ? null : draft.dedupeKey).toMatch(/^f41i_[a-f0-9]{64}$/)
        expect(typeof draft === 'string' ? '' : draft.description).toContain('Trace ID: tr_generation_issue_41')
    })

    it('TC-F41-22: keeps one dedupe key for the same retry-root incident and changes it for a distinct code', () => {
        // Arrange
        const first = detail({ retryRootGeneration: 7 })
        const sameIncident = detail({ id: 42, retryRootGeneration: 7 })
        const differentIncident = detail({ retryRootGeneration: 7, generationErrors: [{ phase: 'persist_page', locationType: 'page', locationKey: 'contact', locationLabel: 'Trang lỗi', code: 'QUOTA_EXHAUSTED', category: 'quota', userSafeMessage: 'Hết quota', sanitizedTechnicalMessage: 'Quota exhausted' }] })

        // Act
        const firstDraft = buildGenerationIssueDraft(first, buildGenerationTicketIncidentSnapshot(first))
        const sameDraft = buildGenerationIssueDraft(sameIncident, buildGenerationTicketIncidentSnapshot(sameIncident))
        const differentDraft = buildGenerationIssueDraft(differentIncident, buildGenerationTicketIncidentSnapshot(differentIncident))

        // Assert
        expect(typeof firstDraft === 'string' || typeof sameDraft === 'string' ? null : firstDraft.dedupeKey).toBe(typeof sameDraft === 'string' ? null : sameDraft.dedupeKey)
        expect(typeof firstDraft === 'string' || typeof differentDraft === 'string' ? null : firstDraft.dedupeKey).not.toBe(typeof differentDraft === 'string' ? null : differentDraft.dedupeKey)
        expect(typeof firstDraft === 'string' ? null : firstDraft.relatedId).toBe('7')
    })

    it('TC-F41-29: excludes raw form values and prompt from the issue description and key', () => {
        // Arrange
        const generation = detail()

        // Act
        const draft = buildGenerationIssueDraft(generation, buildGenerationTicketIncidentSnapshot(generation))
        const serialized = typeof draft === 'string' ? '' : `${draft.dedupeKey}\n${draft.title}\n${draft.description}`

        // Assert
        expect(serialized).not.toContain('private@example.test')
        expect(serialized).not.toContain('Không được lộ')
        expect(serialized).not.toContain('prompt must never reach issue')
    })

    it('TC-F41-29: excludes a page title containing PII while keeping the safe location category', () => {
        // Arrange
        const generation = detail({ pageOutcomes: [{ pageKey: 'contact', title: 'Liên hệ jane@example.test', status: 'failed' }] })

        // Act
        const draft = buildGenerationIssueDraft(generation, buildGenerationTicketIncidentSnapshot(generation))
        const description = typeof draft === 'string' ? '' : draft.description

        // Assert
        expect(description).toContain('Vị trí: Trang bị ảnh hưởng')
        expect(description).not.toContain('jane@example.test')
    })

    it('TC-F41-29: does not persist free-form technical evidence in the ticket', () => {
        // Arrange
        const generation = detail({ generationErrors: [{ phase: 'page_persist', locationType: 'page', locationKey: 'contact', locationLabel: 'Trang lỗi', code: 'PAGE_GENERATION_FAILED', category: 'system', userSafeMessage: 'Không thể lưu trang', sanitizedTechnicalMessage: 'Normalized diagnostic: PAGE_GENERATION_FAILED (provider timeout).' }] })

        // Act
        const draft = buildGenerationIssueDraft(generation, buildGenerationTicketIncidentSnapshot(generation))
        const description = typeof draft === 'string' ? '' : draft.description

        // Assert
        expect(description).toContain('Technical evidence: Có')
        expect(description).not.toContain('Normalized diagnostic: PAGE_GENERATION_FAILED (provider timeout).')
    })

    it('TC-F41-23: rejects a generation whose recovery policy does not allow Dev escalation', () => {
        // Arrange
        const generation = detail({ recoveryStatus: 'eligible' })

        // Act
        const result = buildGenerationIssueDraft(generation, buildGenerationTicketIncidentSnapshot(generation))

        // Assert
        expect(result).toBe('NOT_TICKET_ELIGIBLE')
    })
})
