/**
 * Unit Tests — F10 Order Management
 * Coverage Map:
 *   - Utilities: formatPrice
 *   - Components: OrderMobileCard
 *   - Components: OrderStatusBadge
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { formatPrice, STATUS_CONFIG } from '@/app/(dashboard)/orders/types'

// ── Mock i18n ─────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                orders: {
                    filters: { all: 'All', pending: 'Pending', confirmed: 'Confirmed' },
                    paymentFilter: { all: 'All Methods', cod: 'Cash on Delivery', qrBanking: 'QR Banking' },
                    noOrdersFound: 'No orders found matching your filters.',
                    table: { item: 'item', itemPlural: 'items' },
                    toast: { updated: 'Status updated' },
                    status: {
                        pending: 'Pending',
                        confirmed: 'Confirmed',
                        ready_to_ship: 'Ready To Ship',
                        shipped: 'Shipped',
                        completed: 'Completed',
                        cancelled: 'Cancelled',
                        refunded: 'Refunded'
                    },
                    changeTo: 'Change to'
                }
            }
        },
        locale: 'en'
    })
}))

// ── Mock sonner ──────────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Mock lucide-react ────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
    Banknote: () => <span data-testid="icon-banknote" />,
    QrCode: () => <span data-testid="icon-qrcode" />,
    CreditCard: () => <span data-testid="icon-creditcard" />,
    ChevronDown: () => <span data-testid="icon-chevrondown" />,
    ChevronLeft: () => <span data-testid="icon-chevronleft" />,
    Truck: () => <span data-testid="icon-truck" />,
    CheckCircle: () => <span data-testid="icon-checkcircle" />
}))

// Imports after mocks
import { OrderMobileCard } from '@/app/(dashboard)/orders/components/OrderMobileCard'
import { OrderStatusBadge } from '@/app/(dashboard)/orders/components/OrderStatusBadge'

// Mock Data
const mockOrder = {
    id: 'order-123',
    orderNumber: 'ORD-123',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    subtotal: 100,
    tax: 5,
    total: 105,
    currency: 'MYR',
    status: 'pending' as const,
    paymentMethod: 'cod' as const,
    items: [
        { product: 'p1', productName: 'Item 1', variant: 'Default', quantity: 1, unitPrice: 105 }
    ],
    createdAt: new Date('2026-03-25T10:00:00Z').toISOString()
}

describe('F10 Order Tracking Types & Utils', () => {
    it('formatPrice formats strictly to 2 decimal places with correct currency symbol', () => {
        expect(formatPrice(100.5, 'MYR')).toBe('RM 100.50')
        expect(formatPrice(50, 'SGD')).toBe('S$50.00')
        expect(formatPrice(1234.56, 'USD')).toBe('$1234.56')
    })

    it('STATUS_CONFIG has correct mapping for known statuses', () => {
        expect(STATUS_CONFIG.pending.label).toBe('Pending')
        expect(STATUS_CONFIG.completed.label).toBe('Completed')
        expect(STATUS_CONFIG.cancelled.label).toBe('Cancelled')
    })
})

describe('OrderStatusBadge Component', () => {
    it('renders correct label based on status', () => {
        render(
            <OrderStatusBadge
                order={mockOrder}
                onStatusChange={vi.fn()}
            />
        )
        // Should show 'Pending' from STATUS_CONFIG
        expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders dropdown items for allowed transitions', () => {
        // 'pending' status can transition to 'confirmed' or 'cancelled'
        render(
            <OrderStatusBadge
                order={mockOrder}
                onStatusChange={vi.fn()}
            />
        )
        // Click the badge to open dropdown
        fireEvent.click(screen.getByText('Pending'))
        // Expect 'Change to Confirmed' and 'Change to Cancelled' to appear in the DOM
        expect(screen.getByText('Change to Confirmed')).toBeInTheDocument()
        expect(screen.getByText('Change to Cancelled')).toBeInTheDocument()
    })
})

describe('OrderMobileCard Component', () => {
    it('renders stacked order details correctly (US-F10-05)', () => {
        render(
            <OrderMobileCard
                order={mockOrder}
                isSelected={false}
                onSelect={vi.fn()}
                onToggleSelect={vi.fn()}
                onStatusChange={vi.fn()}
            />
        )
        // Check order number and customer
        expect(screen.getByText('#ORD-123')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()

        // Check total
        expect(screen.getByText('RM 105.00')).toBeInTheDocument()

        // Check payment method
        expect(screen.getByText('COD')).toBeInTheDocument()

        // Check items count (it has 1 item, so it should display '1 item')
        expect(screen.getByText(/1\s+item/)).toBeInTheDocument()
    })

    it('toggles selection when checkbox is clicked', () => {
        const onToggleMock = vi.fn()
        render(
            <OrderMobileCard
                order={mockOrder}
                isSelected={false}
                onSelect={vi.fn()}
                onToggleSelect={onToggleMock}
                onStatusChange={vi.fn()}
            />
        )

        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).not.toBeChecked()

        fireEvent.click(checkbox)
        expect(onToggleMock).toHaveBeenCalledWith('order-123', true)
    })

    it('calls onSelect when clicking the interactive div', () => {
        const onSelectMock = vi.fn()
        render(
            <OrderMobileCard
                order={mockOrder}
                isSelected={false}
                onSelect={onSelectMock}
                onToggleSelect={vi.fn()}
                onStatusChange={vi.fn()}
            />
        )

        // Top div (has role="button" containing customerName)
        const row = screen.getByText('John Doe').closest('[role="button"]')
        fireEvent.click(row!)
        expect(onSelectMock).toHaveBeenCalledWith(mockOrder)
    })
})
