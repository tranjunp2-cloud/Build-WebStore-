import { describe, expect, it } from 'vitest'
import { appendUniqueGenerationRecords } from '@/app/studio/generations/_components/generations-live-feed'
import type { GenerationRecord } from '@/app/studio/generations/_components/generation-types'

function record(id: string): GenerationRecord {
    return {
        id,
        submittedAt: '2026-09-15T00:00:00.000Z',
        user: { id: 'user-1', label: 'Operator', missing: false },
        site: { id: 'site-1', label: 'Website', missing: false },
        lifecycle: 'terminal',
        outcome: 'failed',
        recoveryStatus: 'eligible',
        priority: 'retryable',
        recoveryPolicy: { action: 'retry_website', retryable: true, reasonCode: 'RETRYABLE' },
        pageSummary: { expected: 1, persisted: 0, failed: 1 },
        affectedError: null,
    }
}

describe('appendUniqueGenerationRecords', () => {
    it('[TC-F41-17] appends a later cursor page without replacing visible rows or duplicating IDs', () => {
        // Arrange
        const current = [record('generation-3'), record('generation-2')]
        const nextPage = [record('generation-2'), record('generation-1')]

        // Act
        const result = appendUniqueGenerationRecords(current, nextPage)

        // Assert
        expect(result.map((item) => item.id)).toEqual(['generation-3', 'generation-2', 'generation-1'])
    })
})
