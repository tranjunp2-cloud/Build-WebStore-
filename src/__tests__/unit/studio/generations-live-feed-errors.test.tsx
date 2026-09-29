import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

import { GenerationsLiveFeed } from '@/app/studio/generations/_components/generations-live-feed'
import type { GenerationsListResponse } from '@/app/studio/generations/_components/generation-types'

const staleData: GenerationsListResponse = {
    items: [{
        id: 'stale-eligible', submittedAt: '2026-09-15T00:00:00.000Z',
        user: { id: 'user-1', label: 'Operator', missing: false },
        site: { id: 'site-1', label: 'Website', missing: false },
        lifecycle: 'terminal', outcome: 'failed', recoveryStatus: 'eligible', priority: 'retryable',
        recoveryPolicy: { action: 'retry_website', retryable: true, reasonCode: 'RETRYABLE' },
        pageSummary: { expected: 1, persisted: 0, failed: 1 }, incidentSummary: null, affectedError: null,
    }],
    meta: { totalDocs: 1, limit: 50, hasNextPage: false, hasPrevPage: false },
}

afterEach(() => vi.unstubAllGlobals())

describe('GenerationsLiveFeed error state', () => {
    it('TC-F41-21: changes to All Generations before querying a global status', async () => {
        // Arrange
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(staleData), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        render(<GenerationsLiveFeed initialData={staleData} />)
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())

        // Act
        fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }), { target: { value: 'success:all' } })

        // Assert
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(String(fetchMock.mock.calls[1]?.[0])).toContain('view=all')
        expect(String(fetchMock.mock.calls[1]?.[0])).toContain('status=success')
    })

    it('TC-F41-18: clears stale actionable rows and shows the server-safe filter error', async () => {
        // Arrange — a prior query has a retryable row, but the active request
        // rejects an over-broad user/site name search.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'SEARCH_TOO_BROAD', message: 'Có quá nhiều user hoặc website khớp. Hãy nhập từ khóa cụ thể hơn.' } }), { status: 400 })))

        // Act
        render(<GenerationsLiveFeed initialData={staleData} />)

        // Assert — stale rows must not remain actionable under the rejected filter.
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Có quá nhiều user hoặc website khớp'))
        expect(screen.queryByRole('button', { name: 'Xem generation stale-eligible' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Gen lại website stale-eligible' })).not.toBeInTheDocument()
    })

    it('TC-F41-18: clears retry actions synchronously when search changes before its request settles', async () => {
        // Arrange — the initial request preserves the existing queue; the
        // search request deliberately remains pending after the input event.
        let settleSearch: ((response: Response) => void) | undefined
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(staleData), { status: 200 }))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { settleSearch = resolve })))
        render(<GenerationsLiveFeed initialData={staleData} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Gen lại website stale-eligible' })).toBeVisible())

        // Act — changing scope must remove the prior CTA before the delayed
        // request has any chance to return an error or replacement rows.
        fireEvent.change(screen.getByRole('textbox', { name: 'Tìm generation' }), { target: { value: 'too broad' } })

        // Assert
        expect(screen.queryByRole('button', { name: 'Gen lại website stale-eligible' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Xem generation stale-eligible' })).not.toBeInTheDocument()
        await waitFor(() => expect(settleSearch).toBeDefined())
        settleSearch?.(new Response(JSON.stringify({ error: { code: 'SEARCH_TOO_BROAD', message: 'Có quá nhiều user hoặc website khớp.' } }), { status: 400 }))
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Có quá nhiều user hoặc website khớp'))
    })

    it('defaults to All Generations tab and displays global overview statistics', async () => {
        // Arrange
        const dataWithOverview: GenerationsListResponse = {
            ...staleData,
            overview: {
                total: 529,
                needsAttention: 0,
                retryable: 0,
                retrying: 0,
                ticketRequired: 0,
                succeeded: 480,
                running: 49,
            },
        }
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(dataWithOverview), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        // Act
        render(<GenerationsLiveFeed initialData={dataWithOverview} />)

        // Assert — All Generations is active by default
        const allTab = await screen.findByRole('button', { name: /all generations/i })
        expect(allTab).toHaveAttribute('aria-pressed', 'true')
        expect(allTab).toHaveTextContent('All Generations · 529')

        // Needs Attention shows its own 0 count, NOT 529
        const attentionTab = screen.getByRole('button', { name: /needs attention/i })
        expect(attentionTab).toHaveAttribute('aria-pressed', 'false')
        expect(attentionTab).toHaveTextContent('Needs Attention · 0')

        // Top KPIs reflect overview
        expect(screen.getByText('480')).toBeVisible() // Đã hoàn tất
        expect(screen.getByText('49')).toBeVisible() // Đang tạo website
    })
})
