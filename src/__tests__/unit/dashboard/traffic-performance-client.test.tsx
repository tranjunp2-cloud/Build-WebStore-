import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    getTrafficDataAction: vi.fn(),
    getBrowserViewerTimeZone: vi.fn(),
}))

vi.mock('@/app/(dashboard)/dashboard/actions', () => ({
    getTrafficDataAction: mocks.getTrafficDataAction,
}))

vi.mock('@/lib/viewer-timezone', () => ({
    getBrowserViewerTimeZone: mocks.getBrowserViewerTimeZone,
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                revamp: {
                    traffic: {
                        title: 'Traffic & performance',
                        subtitle: 'Daily pageviews',
                        loading: 'Loading traffic...',
                        loadError: 'Traffic data could not be loaded.',
                        retry: 'Retry',
                    },
                },
            },
        },
    }),
}))

vi.mock('@/components/dashboard/revamp/atoms', () => ({
    SectionHead: () => <div data-testid="traffic-heading" />,
}))

vi.mock('@/components/dashboard/revamp/traffic-performance', () => ({
    TrafficPerformance: ({ period }: { period: string }) => (
        <div data-testid="traffic-data">{period}</div>
    ),
}))

import { TrafficPerformanceClient } from '@/components/dashboard/revamp/traffic-performance-client'

describe('TrafficPerformanceClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getBrowserViewerTimeZone.mockReturnValue('Asia/Ho_Chi_Minh')
        mocks.getTrafficDataAction.mockResolvedValue({
            total: 1,
            isHourly: true,
            days: [],
            top: { pages: [], blogs: [], referrers: [] },
            hasData: true,
        })
    })

    it('[TC-GH1720] requests Traffic after hydration using the browser timezone', async () => {
        // Arrange & Act
        render(<TrafficPerformanceClient period="today" />)

        // Assert
        expect(screen.getByText('Loading traffic...')).toBeInTheDocument()
        await waitFor(() => {
            expect(mocks.getTrafficDataAction).toHaveBeenCalledWith(
                'today',
                'Asia/Ho_Chi_Minh',
            )
        })
        expect(await screen.findByTestId('traffic-data')).toHaveTextContent('today')
    })

    it('[TC-GH1720] reloads Traffic with the same viewer timezone when period changes', async () => {
        // Arrange
        const { rerender } = render(<TrafficPerformanceClient period="7d" />)
        await screen.findByTestId('traffic-data')

        // Act
        rerender(<TrafficPerformanceClient period="30d" />)

        // Assert
        await waitFor(() => {
            expect(mocks.getTrafficDataAction).toHaveBeenLastCalledWith(
                '30d',
                'Asia/Ho_Chi_Minh',
            )
        })
        expect(mocks.getTrafficDataAction).toHaveBeenCalledTimes(2)
    })
})
