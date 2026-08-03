/**
 * Pending Orders widget tests — GH-1627
 * Coverage Map:
 *   TC-F03.03 → rows, count badge, item count, currency, and five-row cap
 *   TC-F03.04 → exact order detail URL
 *   TC-F03.72 → localized empty state
 *   TC-F03.74 → localized unavailable state
 */

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: {
        href: string
        children: import('react').ReactNode
        [key: string]: unknown
    }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { PendingOrders } from '@/components/dashboard/revamp/pending-orders'
import type { PendingOrderRow, PendingOrdersLoadState } from '@/lib/dashboard/dashboard-types'

function makeOrder(index: number): PendingOrderRow {
    return {
        id: `order-${index}`,
        orderNumber: `ORD-${1000 + index}`,
        itemCount: index,
        total: 100 + index * 25.5,
        currency: index === 2 ? 'USD' : 'MYR',
        status: 'pending',
    }
}

function renderWidget(data: PendingOrdersLoadState) {
    return render(
        <I18nProvider defaultLocale="en">
            <PendingOrders data={data} />
        </I18nProvider>
    )
}

describe('PendingOrders', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('[TC-F03.03] renders order fields, total count, and no more than five rows', () => {
        // Arrange
        const orders = Array.from({ length: 6 }, (_, index) => makeOrder(index + 1))

        // Act
        renderWidget({ state: 'ready', orders, totalCount: 9 })
        const links = screen.getAllByRole('link')
        const firstRowText = links[0].textContent?.replace(/\s/g, ' ')

        // Assert
        expect(links).toHaveLength(5)
        expect(screen.getByText('9 pending orders')).toBeInTheDocument()
        expect(firstRowText).toContain('ORD-1001')
        expect(firstRowText).toContain('1 item')
        expect(firstRowText).toContain('RM 125.50')
        expect(firstRowText).toContain('Awaiting')
        expect(screen.queryByText('ORD-1006')).not.toBeInTheDocument()
    })

    it('[TC-F03.03] formats each order with its declared currency', () => {
        // Arrange
        const usdOrder = makeOrder(2)

        // Act
        renderWidget({ state: 'ready', orders: [usdOrder], totalCount: 1 })
        const rowText = screen.getByRole('link').textContent?.replace(/\s/g, ' ')

        // Assert
        expect(rowText).toContain('2 items')
        expect(rowText).toContain('US$151.00')
        expect(screen.getByText('1 pending order')).toBeInTheDocument()
    })

    it('[TC-F03.04] links a row to the exact order document route', () => {
        // Arrange
        const order = makeOrder(1)

        // Act
        renderWidget({ state: 'ready', orders: [order], totalCount: 1 })

        // Assert
        expect(screen.getByRole('link')).toHaveAttribute('href', '/orders/order-1')
    })

    it('[TC-F03.72] renders the localized empty state without order links', () => {
        // Arrange
        const data: PendingOrdersLoadState = {
            state: 'ready',
            orders: [],
            totalCount: 0,
        }

        // Act
        const { container } = renderWidget(data)

        // Assert
        expect(screen.getByText('No pending orders')).toBeInTheDocument()
        expect(screen.getByText('New orders awaiting fulfilment will appear here.')).toBeInTheDocument()
        expect(container.querySelector('.card > .empty-block > .eb-ic + h5 + p')).toHaveTextContent(
            'New orders awaiting fulfilment will appear here.'
        )
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('[TC-F03.74] renders a distinct localized unavailable state', () => {
        // Arrange
        const data: PendingOrdersLoadState = { state: 'unavailable' }

        // Act
        renderWidget(data)

        // Assert
        expect(screen.getByText('Pending orders are unavailable')).toBeInTheDocument()
        expect(screen.getByText("We couldn't load pending orders right now. Please try again later.")).toBeInTheDocument()
        expect(screen.queryByText('No pending orders')).not.toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
})
