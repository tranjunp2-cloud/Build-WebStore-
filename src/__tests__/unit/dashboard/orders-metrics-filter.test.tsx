/**
 * Unit Tests — F10 Orders: Stats Bar cards filter the order list (GH-2161)
 *
 * TC-F10-01-06 — Click vào từng ô Stats Bar lọc đúng theo trạng thái đó.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import enLocale from '@/i18n/locales/en.json'

const enOrders = enLocale.dashboard.orders

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { dashboard: { orders: enOrders } },
        locale: 'en',
    }),
}))

import { OrdersMetrics } from '@/app/(dashboard)/orders/_components/OrdersMetrics'
import { DashboardQueryProvider, resetQueryCache } from '../../helpers/query-provider'

const CARDS: Array<[string, string]> = [
    [enOrders.metrics.pending, 'pending'],
    [enOrders.status.confirmed, 'confirmed'],
    [enOrders.metrics.readyToShip, 'ready_to_ship'],
    [enOrders.metrics.shipped, 'shipped'],
    [enOrders.metrics.completed, 'completed'],
    [enOrders.metrics.cancelled, 'cancelled'],
    [enOrders.status.refunded, 'refunded'],
]

describe('TC-F10-01-06 — OrdersMetrics cards filter by status (GH-2161)', () => {
    beforeEach(() => {
        resetQueryCache()
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { pending: 5, confirmed: 2, readyToShip: 3, shipped: 1, completed: 4, cancelled: 0, refunded: 1 },
            }),
        } as Response)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it.each(CARDS)('clicking the "%s" card selects status group "%s"', async (label, key) => {
        // Arrange
        const onSelectStatus = vi.fn()
        render(<DashboardQueryProvider><OrdersMetrics activeStatus="all" onSelectStatus={onSelectStatus} /></DashboardQueryProvider>)
        await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument())

        // Act
        fireEvent.click(screen.getByText(label).closest('button')!)

        // Assert
        expect(onSelectStatus).toHaveBeenCalledWith(key)
    })

    it('marks only the active card with aria-pressed=true', async () => {
        // Arrange + Act
        render(<DashboardQueryProvider><OrdersMetrics activeStatus="shipped" onSelectStatus={vi.fn()} /></DashboardQueryProvider>)
        await waitFor(() => expect(screen.getByText(enOrders.metrics.shipped)).toBeInTheDocument())

        // Assert
        const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
        expect(pressed).toHaveLength(1)
        expect(pressed[0]).toHaveTextContent(enOrders.metrics.shipped)
    })

    it('clicking the active card clears the filter (back to "all")', async () => {
        // Arrange
        const onSelectStatus = vi.fn()
        render(<DashboardQueryProvider><OrdersMetrics activeStatus="pending" onSelectStatus={onSelectStatus} /></DashboardQueryProvider>)
        await waitFor(() => expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument())

        // Act
        fireEvent.click(screen.getByText(enOrders.metrics.pending).closest('button')!)

        // Assert
        expect(onSelectStatus).toHaveBeenCalledWith('all')
    })
})
