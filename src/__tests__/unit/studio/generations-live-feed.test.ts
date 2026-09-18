import { describe, expect, it } from 'vitest'
import { appendUniqueGenerationRecords, getExportScope, getOperatorStatus, mergePolledGenerationRecords, toDateTimeLocalValue } from '@/app/studio/generations/_components/generations-live-feed'
import { isIssueUnassigned } from '@/app/studio/issues/_components/issues-list'
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
        incidentSummary: null,
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

    it('TC-F41-19: does not let a stale eligible poll undo an accepted retry monitor state', () => {
        const locallyAccepted = {
            ...record('generation-1'),
            recoveryStatus: 'retrying',
            priority: 'retrying',
            recoveryPolicy: { action: 'monitor' as const, retryable: false, reasonCode: 'RETRY_IN_PROGRESS' },
        }

        const result = mergePolledGenerationRecords([record('generation-1')], [locallyAccepted])

        expect(result).toEqual([locallyAccepted])
    })

    it('TC-F41-19: accepts a later server retry-failed update instead of keeping monitor state forever', () => {
        const locallyAccepted = {
            ...record('generation-1'),
            recoveryStatus: 'retrying',
            priority: 'retrying',
            recoveryPolicy: { action: 'monitor' as const, retryable: false, reasonCode: 'RETRY_IN_PROGRESS' },
        }
        const serverUpdate = {
            ...record('generation-1'),
            recoveryStatus: 'retry_failed',
            priority: 'retry_failed',
            recoveryPolicy: { action: 'create_ticket' as const, retryable: false, reasonCode: 'RETRY_FAILED' },
        }

        const result = mergePolledGenerationRecords([serverUpdate], [locallyAccepted])

        expect(result).toEqual([serverUpdate])
    })
})

describe('generation listing presentation guards', () => {
    it('counts the DEV queue as assigned even though no individual user is stored', () => {
        expect(isIssueUnassigned({ assignmentTarget: 'dev', assignedTo: null })).toBe(false)
        expect(isIssueUnassigned({ assignmentTarget: 'unassigned', assignedTo: null })).toBe(true)
        expect(isIssueUnassigned({ assignedTo: { id: 3 } })).toBe(false)
    })

    it('TC-F41-21: derives an operator-facing status from recovery state and outcome, not queue priority', () => {
        expect(getOperatorStatus({ recoveryStatus: 'ticket_required', lifecycle: 'terminal', outcome: 'failed' }).label).toBe('Cần Dev xử lý')
        expect(getOperatorStatus({ recoveryStatus: 'exhausted', lifecycle: 'terminal', outcome: 'partial_failed' }).label).toBe('Cần Dev xử lý')
        expect(getOperatorStatus({ recoveryStatus: 'ticket_created', lifecycle: 'terminal', outcome: 'failed' }).label).toBe('Đã chuyển Dev')
        expect(getOperatorStatus({ recoveryStatus: 'none', lifecycle: 'queued', outcome: null }).label).toBe('Đang chờ tạo website')
        expect(getOperatorStatus({ recoveryStatus: 'none', lifecycle: 'terminal', outcome: 'succeeded' }).label).toBe('Đã hoàn tất')
        expect(getOperatorStatus({ recoveryStatus: 'eligible', lifecycle: 'terminal', outcome: 'partial_failed' }).label).toBe('Có thể gen lại')
        expect(getOperatorStatus({ recoveryStatus: 'retrying', lifecycle: 'terminal', outcome: 'partial_failed' }).label).toBe('Đang gen lại')
        expect(getOperatorStatus({ recoveryStatus: 'stale_running', lifecycle: 'running', outcome: null }).label).toBe('Có dấu hiệu bị kẹt')
        expect(getOperatorStatus({ recoveryStatus: 'none', lifecycle: 'terminal', outcome: 'cancelled' }).label).toBe('Cần kiểm tra')
    })

    it('TC-F41-18: converts ISO timestamps to browser-local datetime-local values', () => {
        // Date constructor uses local fields; this assertion is timezone-safe.
        const source = '2026-09-15T09:08:07.000Z'
        const local = new Date(source)
        const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}T${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
        expect(toDateTimeLocalValue(source)).toBe(expected)
        expect(toDateTimeLocalValue('not-a-date')).toBe('')
    })

    it('TC-F41-18: prevents Export CSV from silently dropping unsupported queue filters', () => {
        expect(getExportScope({ view: 'needs_attention', status: 'all', recoveryStatus: 'all', search: '', userId: '', siteId: '', dateFrom: '', dateTo: '', cursor: '', limit: 50 })).toMatch(/chỉ hỗ trợ toàn bộ generation/i)
        expect(getExportScope({ view: 'all', status: 'failed', recoveryStatus: 'all', search: '', userId: '1', siteId: '', dateFrom: '', dateTo: '', cursor: '', limit: 50 })).toMatch(/trạng thái, User ID và khoảng thời gian/i)
    })
})
