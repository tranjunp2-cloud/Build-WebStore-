import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('@/app/studio/issues/_components/live-error-detail-drawer', () => ({
    LiveErrorDetailDrawer: ({ error }: { error: { message: string } | null }) =>
        error ? <div role="dialog">{error.message}</div> : null,
}))

import { LiveErrorsView } from '@/app/studio/issues/_components/live-errors-view'

const guidance = {
    category: 'http-500-503' as const,
    investigationArea: 'Application route, dependency, or recent deployment',
    checks: [
        'Inspect the top application frame',
        'Compare the first occurrence with the latest deployment',
    ] as [string, string],
    escalationCondition:
        'Escalate when the application frame is unavailable or the deployment comparison is inconclusive',
    label: 'Suggested next checks' as const,
}

const sentryError = {
    source: 'sentry' as const,
    providerId: '9001',
    occurredAt: '2026-07-28T08:00:00.000Z',
    severity: 'high' as const,
    message: 'Synthetic Sentry failure',
    host: 'coffee.primeweb.app',
    tenantMatch: { id: '42', slug: 'coffee', name: 'Coffee' },
    route: '/api/orders',
    method: 'POST',
    statusCode: 500,
    release: 'release-1',
    deploymentId: null,
    requestId: null,
    traceId: null,
    frames: [],
    providerUrl: 'https://sentry.io/organizations/example/issues/9001/',
    guidance,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

// ── TC-F39-AC03–05: Independent source UI states and retry ─────────────────
describe('[TC-F39-AC03–05] LiveErrorsView provider isolation', () => {
    it('keeps the successful source usable and retries only the failed source', async () => {
        // Arrange
        let vercelAttempts = 0
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.includes('source=sentry')) {
                return new Response(JSON.stringify({
                    data: [sentryError],
                    fetchedAt: '2026-07-28T08:01:00.000Z',
                }), { status: 200 })
            }

            vercelAttempts += 1
            if (vercelAttempts === 1) {
                return new Response(JSON.stringify({
                    error: 'Provider unavailable',
                    code: 'rate-limited',
                }), { status: 502 })
            }

            return new Response(JSON.stringify({
                data: [],
                fetchedAt: '2026-07-28T08:02:00.000Z',
            }), { status: 200 })
        })
        vi.stubGlobal('fetch', fetchMock)
        const onPromoted = vi.fn()

        // Act
        render(<LiveErrorsView onPromoted={onPromoted} />)

        // Assert
        const sentryStatus = await screen.findByRole('region', { name: 'Sentry status' })
        const vercelStatus = screen.getByRole('region', { name: 'Vercel status' })
        await waitFor(() => expect(sentryStatus).toHaveTextContent('1 errors'))
        await waitFor(() => expect(vercelStatus).toHaveTextContent('Unavailable'))
        expect(screen.getByText('Synthetic Sentry failure')).toBeVisible()

        // Act
        fireEvent.click(within(vercelStatus).getByRole('button', { name: 'Retry' }))

        // Assert
        await waitFor(() => expect(vercelStatus).toHaveTextContent('0 errors'))
        expect(screen.getByText('Synthetic Sentry failure')).toBeVisible()
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('shows the total-failure state without removing the tracked-view control', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn(async () =>
            new Response(JSON.stringify({ error: 'Provider unavailable' }), {
                status: 502,
            }),
        ))

        // Act
        render(<LiveErrorsView onPromoted={vi.fn()} />)

        // Assert
        expect(await screen.findByText('Live errors are unavailable')).toBeVisible()
        expect(screen.getByText(/Tracked issues remain available/)).toBeVisible()
        expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(2)
    })
})
