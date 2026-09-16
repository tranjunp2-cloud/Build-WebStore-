import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenerationRetryAction } from '@/app/studio/generations/_components/generation-retry-action'
import type { GenerationRecord } from '@/app/studio/generations/_components/generation-types'

const record: GenerationRecord = {
    id: '41', submittedAt: '2026-09-15T00:00:00.000Z',
    user: { id: 'user-1', label: 'Operator', missing: false },
    site: { id: 'site-1', label: 'Website', missing: false },
    lifecycle: 'terminal', outcome: 'partial_failed', recoveryStatus: 'eligible', priority: 'retryable',
    recoveryPolicy: { action: 'retry_website', retryable: true, reasonCode: 'RETRYABLE' },
    pageSummary: { expected: 5, persisted: 4, failed: 1 }, incidentSummary: null, affectedError: null,
}

afterEach(() => vi.unstubAllGlobals())

describe('GenerationRetryAction', () => {
    it('TC-F41-13: cancelling confirmation never invokes the retry API', () => {
        // Arrange
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        render(<GenerationRetryAction record={record} onAccepted={vi.fn()} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Gen lại website 41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))

        // Assert
        expect(fetchMock).not.toHaveBeenCalled()
        expect(screen.queryByText('Gen lại website?')).not.toBeInTheDocument()
    })

    it('TC-F41-13: confirms exactly once and disables the confirm CTA while queued', async () => {
        // Arrange
        let resolveFetch: ((value: Response) => void) | undefined
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
        vi.stubGlobal('fetch', fetchMock)
        vi.stubGlobal('crypto', { randomUUID: () => '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572' })
        render(<GenerationRetryAction record={record} onAccepted={vi.fn()} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Gen lại website 41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gen lại' }))
        fireEvent.click(screen.getByRole('button', { name: 'Đang xếp hàng…' }))

        // Assert
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Đang xếp hàng…' })).toBeDisabled()
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/generations/41/retry', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572' }) }))

        // Cleanup the pending request to avoid a state update after the test finishes.
        resolveFetch?.(new Response(null, { status: 202 }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Gen lại website 41' })).toHaveTextContent('Đang gen lại'))
        expect(screen.getByRole('button', { name: 'Gen lại website 41' })).toBeDisabled()
    })

    it('TC-F41-13: treats only RETRY_IN_PROGRESS conflicts as an idempotent retry success', async () => {
        // Arrange — a generic 409 means the server rejected this retry, it is
        // not proof that a recovery job exists.
        const onAccepted = vi.fn()
        vi.stubGlobal('crypto', { randomUUID: () => '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572' })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'RETRY_NOT_ALLOWED', message: 'Retry đã hết lượt.' } }), { status: 409 })))
        render(<GenerationRetryAction record={record} onAccepted={onAccepted} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Gen lại website 41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gen lại' }))

        // Assert
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Retry đã hết lượt.'))
        expect(onAccepted).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Gen lại website 41', hidden: true })).toBeEnabled()
    })

    it('TC-F41-13: accepts RETRY_IN_PROGRESS conflicts as idempotent success', async () => {
        // Arrange
        const onAccepted = vi.fn()
        vi.stubGlobal('crypto', { randomUUID: () => '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572' })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'RETRY_IN_PROGRESS', message: 'Website đang được gen lại.' } }), { status: 409 })))
        render(<GenerationRetryAction record={record} onAccepted={onAccepted} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Gen lại website 41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gen lại' }))

        // Assert
        await waitFor(() => expect(onAccepted).toHaveBeenCalledWith('41'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Gen lại website 41' })).toBeDisabled()
    })
})
