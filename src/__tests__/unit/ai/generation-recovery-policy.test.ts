import { describe, expect, it } from 'vitest'
import {
    generationPriorityRank,
    resolveGenerationPriority,
    resolveGenerationRecoveryPolicy,
    serializeAdminGeneration,
    summarizeGenerationIncident,
    type GenerationListSource,
} from '@/lib/ai/generation-recovery-policy'

const record = (overrides: Partial<GenerationListSource> = {}): GenerationListSource => ({
    id: 'gen-1',
    createdAt: '2026-09-15T08:00:00.000Z',
    lifecycle: 'terminal',
    outcome: 'failed',
    recoveryStatus: 'eligible',
    ...overrides,
})

describe('[TC-F41-06/08] generation recovery policy', () => {
    it('TC-F41-06: orders unrecoverable records before retryable, active and history records', () => {
        // Arrange
        const records = [
            record({ id: 'history', recoveryStatus: 'none', outcome: 'succeeded' }),
            record({ id: 'retrying', recoveryStatus: 'retrying' }),
            record({ id: 'eligible', recoveryStatus: 'eligible' }),
            record({ id: 'stale', recoveryStatus: 'stale_running', lifecycle: 'running', outcome: null }),
            record({ id: 'ticket', recoveryStatus: 'ticket_required' }),
        ]

        // Act
        const ordered = [...records].sort((a, b) =>
            generationPriorityRank[resolveGenerationPriority(a)] - generationPriorityRank[resolveGenerationPriority(b)],
        )

        // Assert
        expect(ordered.map(({ id }) => id)).toEqual(['ticket', 'eligible', 'retrying', 'stale', 'history'])
    })

    it('TC-F41-08: derives exactly one server-owned action without inspecting error text', () => {
        // Arrange
        const eligible = record({ recoveryStatus: 'eligible' })
        const ticketOnly = record({ recoveryStatus: 'ticket_required' })
        const running = record({ recoveryStatus: 'stale_running', lifecycle: 'running', outcome: null })

        // Act
        const policies = [eligible, ticketOnly, running].map(resolveGenerationRecoveryPolicy)

        // Assert
        expect(policies).toEqual([
            { action: 'retry_website', retryable: true, reasonCode: 'RETRY_ELIGIBLE' },
            { action: 'create_ticket', retryable: false, reasonCode: 'TICKET_REQUIRED' },
            { action: 'monitor', retryable: false, reasonCode: 'STALE_RUNNING' },
        ])
    })

    it('TC-F41-07: serializes only allowlisted list fields with explicit missing relations', () => {
        // Arrange
        const source = record({
            user: null,
            site: null,
            pageSummary: { expected: 5, persisted: 4, failed: 1 },
            generationErrors: [{
                code: 'PAGE_PERSISTENCE_FAILED',
                phase: 'page_persist',
                locationType: 'page',
                locationKey: 'about',
                operatorMessage: 'raw provider stack / secret',
                userSafeMessage: 'Safe normalized summary',
            }],
            // Payload can contain these non-contract fields. The list serializer must not spread them.
            promptText: 'customer prompt',
            inputSnapshot: { apiKey: 'secret' },
            outputSnapshot: { providerResponse: 'private' },
            errorLog: 'raw provider stack',
        } as GenerationListSource)

        // Act
        const serialized = serializeAdminGeneration(source)

        // Assert
        expect(serialized).toMatchObject({
            id: 'gen-1',
            user: { id: null, label: 'Unknown', missing: true },
            site: { id: null, label: 'Unknown', missing: true },
            pageSummary: { expected: 5, persisted: 4, failed: 1 },
            affectedError: { code: 'PAGE_PERSISTENCE_FAILED', locationKey: 'about', summary: 'Safe normalized summary' },
            incidentSummary: { kind: 'persistence', label: 'Không thể lưu website', scope: 'about', totalErrors: 1 },
        })
        expect(serialized).not.toHaveProperty('promptText')
        expect(serialized).not.toHaveProperty('inputSnapshot')
        expect(serialized).not.toHaveProperty('outputSnapshot')
        expect(serialized).not.toHaveProperty('errorLog')
        expect(JSON.stringify(serialized)).not.toContain('raw provider stack / secret')
    })

    it('TC-F41-08: selects the most blocking incident across all captured errors', () => {
        // Arrange: the first error is component-scoped, but quota blocks the entire website.
        const errors: NonNullable<GenerationListSource['generationErrors']> = [
            { code: 'INVALID_COMPONENT_CONTRACT', locationType: 'component', locationKey: 'Sản phẩm / Gallery' },
            { code: 'AI_QUOTA_EXCEEDED', locationType: 'website' },
            { code: 'PAGE_GENERATION_FAILED', locationType: 'page', locationKey: 'Liên hệ' },
        ]

        // Act
        const incident = summarizeGenerationIncident(errors)

        // Assert
        expect(incident).toEqual({ kind: 'quota', label: 'Hết quota AI', scope: 'Áp dụng toàn website', totalErrors: 3 })
    })
})
