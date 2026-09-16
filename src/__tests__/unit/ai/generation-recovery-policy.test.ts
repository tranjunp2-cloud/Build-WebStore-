import { describe, expect, it } from 'vitest'
import {
    generationPriorityRank,
    resolveGenerationPriority,
    resolveGenerationRecoveryPolicy,
    serializeAdminGeneration,
    serializeAdminGenerationDetail,
    summarizeGenerationIncident,
    type GenerationDetailSource,
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

    it('TC-F41-04/14: returns bounded debug context without raw prompt, output or secret-like values', () => {
        // Arrange
        const source = record({
            user: { id: 'user-1', firstName: 'Minh', lastName: 'Anh', email: 'minh@example.test' },
            site: { id: 'site-1', name: 'Minh Store', domain: 'https://minh.example.test', status: 'draft' },
            pageSummary: { expected: 2, persisted: 1, failed: 1 },
            inputSchemaVersion: 'f41.v1',
            inputSnapshot: { businessInfo: { businessName: 'Minh Store', industry: 'Retail', shortDescription: 'Hoa tươi', products: 'Hoa hồng', services: ['Giao nhanh'] }, language: 'vi', extraInstructions: '{"authorization":"Bearer real-secret-value"}' },
            promptText: 'raw customer prompt must not leak', outputSnapshot: { provider: 'private' },
            pageOutcomes: [{ pageKey: 'contact', title: 'Liên hệ', status: 'failed', blockCount: 3, errorCode: 'PAGE_PERSIST_FAILED', errorSummary: 'token=sk-page-secret-value' }],
            generationErrors: [{ code: 'PAGE_PERSIST_FAILED', locationType: 'page', locationKey: 'contact', userSafeMessage: 'Không thể lưu trang', sanitizedTechnicalMessage: 'token=sk-another-secret-value' }],
        } as GenerationListSource)

        // Act
        const detail = serializeAdminGenerationDetail(source)

        // Assert
        expect(detail).toMatchObject({ website: { name: 'Minh Store' }, user: { email: 'minh@example.test' }, pageSummary: { expected: 2, persisted: 1, failed: 1 }, pages: [{ title: 'Liên hệ', status: 'failed' }] })
        expect(detail.input.summary).toHaveLength(5)
        expect(detail.input.full).toMatchObject({ businessName: 'Minh Store', extraInstructions: '{"authorization":"<redacted>"}' })
        expect(detail.website.urls.preview).toBe('/preview/site-1')
        expect(JSON.stringify(detail)).not.toContain('raw customer prompt')
        expect(JSON.stringify(detail)).not.toContain('private')
        expect(JSON.stringify(detail)).not.toContain('sk-another-secret-value')
        expect(JSON.stringify(detail)).not.toContain('sk-page-secret-value')
        expect(JSON.stringify(detail)).not.toContain('real-secret-value')
    })

    it('TC-F41-20: derives bounded recovery job timeline events and falls back to the recovered website', () => {
        // Arrange
        const source = record({ id: 'parent', site: null, recoveredSite: { id: 'recovery-site', name: 'Recovery draft', domain: null } }) as GenerationDetailSource

        // Act
        const detail = serializeAdminGenerationDetail(source, [], [{ id: 'job-1', childGeneration: 'child-1', status: 'succeeded', queuedAt: '2026-09-15T08:01:00.000Z', startedAt: '2026-09-15T08:02:00.000Z', finishedAt: '2026-09-15T08:03:00.000Z' }])

        // Assert
        expect(detail.website).toMatchObject({ id: 'recovery-site', urls: { preview: '/preview/recovery-site' } })
        expect(detail.timeline.map((event) => event.event)).toEqual(expect.arrayContaining(['recovery_queued', 'recovery_started', 'recovery_finished']))
        expect(detail.timeline.find((event) => event.event === 'recovery_finished')).toMatchObject({ jobStatus: 'succeeded', childGenerationId: 'child-1' })
    })

    it('TC-F41-14: sanitizes legacy diagnostic evidence and preserves an unknown page state', () => {
        // Arrange
        const source = record({
            pageOutcomes: [{ title: 'Legacy page', status: null, errorSummary: 'Error at /var/task/src/site.ts:12:4 postgresql://admin:db-password@db.example/app' }],
            generationErrors: [{ locationType: 'site', code: 'SITE_FAILED', userSafeMessage: 'Không thể tạo website', sanitizedTechnicalMessage: 'Authorization: Bearer secret-token https://ops:ops-password@example.test/path' }],
        } as GenerationListSource)

        // Act
        const detail = serializeAdminGenerationDetail(source)
        const serialized = JSON.stringify(detail)

        // Assert
        expect(detail.pages[0]).toMatchObject({ status: 'unknown' })
        expect(serialized).not.toContain('/var/task/src/site.ts')
        expect(serialized).not.toContain('db-password')
        expect(serialized).not.toContain('ops-password')
        expect(serialized).not.toContain('secret-token')
    })
})
