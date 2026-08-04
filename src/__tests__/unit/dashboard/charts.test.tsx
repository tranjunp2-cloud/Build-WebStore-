import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BarChart } from '@/components/dashboard/revamp/charts'

class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

describe('dashboard traffic chart', () => {
    it('renders viewer calendar date keys without converting them through UTC', () => {
        render(
            <BarChart
                days={[
                    { date: '2026-08-03', views: 1 },
                    { date: '2026-08-04', views: 2 },
                ]}
            />,
        )

        expect(screen.getByText('3/8')).toBeInTheDocument()
        expect(screen.getByText('4/8')).toBeInTheDocument()
    })
})
