/**
 * Unit Tests — F10 Order Management: Internationalization (i18n)
 *
 * TC-F10.i18n — Covers:
 *   1. Locale key completeness & EN/MS parity
 *   2. OrdersMetrics renders with i18n labels
 *   3. OrdersActionBar dropdown labels reflect i18n
 *   4. OrdersPagination uses i18n labels
 *   5. CancelOrderModal renders with i18n text
 *   6. OrdersTable status badge + headers use i18n
 *   7. OrderDetailPanel section headers use i18n
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import enLocale from '@/i18n/locales/en.json'
import msLocale from '@/i18n/locales/ms.json'

// ── Shared i18n mock data for EN & MS ────────────────────────────────────
const enOrders = enLocale.dashboard.orders
const msOrders = msLocale.dashboard.orders

let currentMockLocale = 'en'
let currentMockOrders = enOrders

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { dashboard: { orders: currentMockOrders } },
        ti: (key: string, vars: Record<string, any>) =>
            key.replace(/{(\w+)}/g, (_, k) => vars[k] ?? ''),
        locale: currentMockLocale,
    }),
}))

// ── Mock sonner ──────────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Mock lucide-react ────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
    Search: () => <span data-testid="icon-search" />,
    Package: () => <span data-testid="icon-package" />,
    Loader2: () => <span data-testid="icon-loader" />,
    ChevronLeft: () => <span data-testid="icon-chevron-left" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    Clock: () => <span data-testid="icon-clock" />,
    AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
    ArrowLeft: () => <span data-testid="icon-arrow-left" />,
    Truck: () => <span data-testid="icon-truck" />,
    CheckCircle: () => <span data-testid="icon-checkcircle" />,
    CheckCircle2: () => <span data-testid="icon-checkcircle2" />,
    XCircle: () => <span data-testid="icon-xcircle" />,
    X: () => <span data-testid="icon-x" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    CreditCard: () => <span data-testid="icon-creditcard" />,
    ArrowDownUp: () => <span data-testid="icon-arrowdownup" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
}))

// ── Mock next/image ──────────────────────────────────────────────────────
vi.mock('next/image', () => ({
    default: (props: any) => <img {...props} />,
}))

// ── Imports after mocks ──────────────────────────────────────────────────
import { OrdersMetrics } from '@/app/(dashboard)/orders/_components/OrdersMetrics'
import { OrdersActionBar } from '@/app/(dashboard)/orders/_components/OrdersActionBar'
import { CancelOrderModal } from '@/app/(dashboard)/orders/_components/CancelOrderModal'

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: Locale Key Completeness & EN/MS Parity
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.01 — Locale Key Completeness', () => {
    it('EN locale has all required dashboard.orders top-level keys', () => {
        const requiredKeys = [
            'pageTitle', 'pageSubtitle', 'metrics', 'tableHeaders',
            'pagination', 'detail', 'actions', 'progress', 'cancel',
            'filterDates', 'filterStatus', 'status', 'toast',
        ]
        requiredKeys.forEach(key => {
            expect(enOrders).toHaveProperty(key)
        })
    })

    it('MS locale has all required dashboard.orders top-level keys', () => {
        const requiredKeys = [
            'pageTitle', 'pageSubtitle', 'metrics', 'tableHeaders',
            'pagination', 'detail', 'actions', 'progress', 'cancel',
            'filterDates', 'filterStatus', 'status', 'toast',
        ]
        requiredKeys.forEach(key => {
            expect(msOrders).toHaveProperty(key)
        })
    })

    it('EN and MS have identical key structures for status labels', () => {
        expect(Object.keys(enOrders.status).sort())
            .toEqual(Object.keys(msOrders.status).sort())
    })

    it('EN and MS have identical key structures for detail section', () => {
        expect(Object.keys(enOrders.detail).sort())
            .toEqual(Object.keys(msOrders.detail).sort())
    })

    it('EN and MS have identical key structures for actions', () => {
        expect(Object.keys(enOrders.actions).sort())
            .toEqual(Object.keys(msOrders.actions).sort())
    })

    it('EN and MS have identical key structures for progress steps', () => {
        expect(Object.keys(enOrders.progress).sort())
            .toEqual(Object.keys(msOrders.progress).sort())
    })

    it('EN and MS have identical key structures for table headers', () => {
        expect(Object.keys(enOrders.tableHeaders).sort())
            .toEqual(Object.keys(msOrders.tableHeaders).sort())
    })

    it('EN and MS have identical key structures for cancel modal', () => {
        expect(Object.keys(enOrders.cancel).sort())
            .toEqual(Object.keys(msOrders.cancel).sort())
    })

    it('EN and MS have identical key structures for filterDates', () => {
        expect(Object.keys(enOrders.filterDates).sort())
            .toEqual(Object.keys(msOrders.filterDates).sort())
    })

    it('EN and MS have identical key structures for metrics', () => {
        expect(Object.keys(enOrders.metrics).sort())
            .toEqual(Object.keys(msOrders.metrics).sort())
    })

    it('EN and MS have identical key structures for pagination', () => {
        expect(Object.keys(enOrders.pagination).sort())
            .toEqual(Object.keys(msOrders.pagination).sort())
    })

    it('EN and MS have identical key structures for toast', () => {
        expect(Object.keys(enOrders.toast).sort())
            .toEqual(Object.keys(msOrders.toast).sort())
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Locale Value Non-Empty Checks
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.02 — Locale Values Are Non-Empty', () => {
    function assertAllValuesNonEmpty(obj: Record<string, any>, path = '') {
        Object.entries(obj).forEach(([key, value]) => {
            const fullPath = path ? `${path}.${key}` : key
            if (typeof value === 'object' && value !== null) {
                assertAllValuesNonEmpty(value, fullPath)
            } else {
                expect(value, `Key "${fullPath}" should not be empty`).toBeTruthy()
            }
        })
    }

    it('EN locale has no empty string values in orders namespace', () => {
        assertAllValuesNonEmpty(enOrders, 'en.dashboard.orders')
    })

    it('MS locale has no empty string values in orders namespace', () => {
        assertAllValuesNonEmpty(msOrders, 'ms.dashboard.orders')
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: MS translations are actually different from EN
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.03 — MS Translations Differ From EN', () => {
    it('pageTitle is different in MS vs EN', () => {
        expect(msOrders.pageTitle).not.toBe(enOrders.pageTitle)
    })

    it('pageSubtitle is different in MS vs EN', () => {
        expect(msOrders.pageSubtitle).not.toBe(enOrders.pageSubtitle)
    })

    it('metric labels are different in MS vs EN', () => {
        expect(msOrders.metrics.pending).not.toBe(enOrders.metrics.pending)
        expect(msOrders.metrics.readyToShip).not.toBe(enOrders.metrics.readyToShip)
    })

    it('detail section headers are different in MS vs EN', () => {
        expect(msOrders.detail.title).not.toBe(enOrders.detail.title)
        expect(msOrders.detail.customerInfo).not.toBe(enOrders.detail.customerInfo)
        expect(msOrders.detail.paymentInfo).not.toBe(enOrders.detail.paymentInfo)
    })

    it('action button labels are different in MS vs EN', () => {
        expect(msOrders.actions.confirmOrder).not.toBe(enOrders.actions.confirmOrder)
        expect(msOrders.actions.cancelOrder).not.toBe(enOrders.actions.cancelOrder)
    })

    it('progress step labels differ in MS vs EN', () => {
        expect(msOrders.progress.pending).not.toBe(enOrders.progress.pending)
        expect(msOrders.progress.confirmed).not.toBe(enOrders.progress.confirmed)
    })

    it('filterDates labels differ in MS vs EN', () => {
        expect(msOrders.filterDates.allDates).not.toBe(enOrders.filterDates.allDates)
        expect(msOrders.filterDates.today).not.toBe(enOrders.filterDates.today)
    })

    it('cancel modal labels differ in MS vs EN', () => {
        expect(msOrders.cancel.title).not.toBe(enOrders.cancel.title)
        expect(msOrders.cancel.reasonLabel).not.toBe(enOrders.cancel.reasonLabel)
    })

    it('pagination labels differ in MS vs EN', () => {
        expect(msOrders.pagination.previous).not.toBe(enOrders.pagination.previous)
        expect(msOrders.pagination.next).not.toBe(enOrders.pagination.next)
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: OrdersMetrics Component Rendering
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.04 — OrdersMetrics renders i18n labels (EN)', () => {
    beforeEach(() => {
        currentMockLocale = 'en'
        currentMockOrders = enOrders
        // Mock the fetch call that OrdersMetrics makes internally
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { pending: 5, readyToShip: 3, confirmed: 2, shipped: 1, cancelled: 0 }
            }),
        } as Response)
    })

    it('renders all four metric labels from EN locale', () => {
        render(<OrdersMetrics />)

        // The 4 metrics are: Pending, Ready to Ship, Confirmed (uses status.confirmed), Shipped
        expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.readyToShip)).toBeInTheDocument()
        expect(screen.getByText(enOrders.status.confirmed)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.shipped)).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: OrdersActionBar Dropdown Labels
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.05 — OrdersActionBar dropdown i18n labels', () => {
    beforeEach(() => {
        currentMockLocale = 'en'
        currentMockOrders = enOrders
    })

    // The filters are shared <FilterChip> pills that render "{label} : {value}",
    // so the chip's accessible name contains the i18n value; options appear on click.
    it('displays "All Dates" label from i18n by default', () => {
        render(<OrdersActionBar />)
        expect(screen.getByRole('button', { name: new RegExp(enOrders.filterDates.allDates) })).toBeInTheDocument()
    })

    it('displays "All Status" label from i18n by default', () => {
        render(<OrdersActionBar />)
        expect(screen.getByRole('button', { name: new RegExp(enOrders.filterStatus.allStatus) })).toBeInTheDocument()
    })

    it('displays search placeholder from i18n', () => {
        render(<OrdersActionBar />)
        expect(screen.getByPlaceholderText(enOrders.search)).toBeInTheDocument()
    })

    it('shows date filter options when the chip is clicked', () => {
        render(<OrdersActionBar />)
        fireEvent.click(screen.getByRole('button', { name: new RegExp(enOrders.filterDates.allDates) }))

        expect(screen.getByText(enOrders.filterDates.today)).toBeInTheDocument()
        expect(screen.getByText(enOrders.filterDates.thisWeek)).toBeInTheDocument()
        expect(screen.getByText(enOrders.filterDates.thisMonth)).toBeInTheDocument()
    })

    it('shows status filter options when the chip is clicked', () => {
        render(<OrdersActionBar />)
        fireEvent.click(screen.getByRole('button', { name: new RegExp(enOrders.filterStatus.allStatus) }))

        expect(screen.getByText(enOrders.status.pending)).toBeInTheDocument()
        expect(screen.getByText(enOrders.status.confirmed)).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: CancelOrderModal Labels
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.07 — CancelOrderModal i18n labels', () => {
    beforeEach(() => {
        currentMockLocale = 'en'
        currentMockOrders = enOrders
    })

    it('renders modal title from i18n when open', () => {
        render(
            <CancelOrderModal
                orderNumber="ORD-001"
                isOpen={true}
                isLoading={false}
                onBack={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        // Title is rendered as "{c.title} {orderNumber}" so use regex
        expect(screen.getByText(new RegExp(enOrders.cancel.title))).toBeInTheDocument()
    })

    it('renders reason label from i18n', () => {
        render(
            <CancelOrderModal
                orderNumber="ORD-001"
                isOpen={true}
                isLoading={false}
                onBack={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        // The label includes a '*' suffix, so use partial matching
        expect(screen.getByText(new RegExp(enOrders.cancel.reasonLabel))).toBeInTheDocument()
    })

    it('renders back and confirm button labels from i18n', () => {
        render(
            <CancelOrderModal
                orderNumber="ORD-001"
                isOpen={true}
                isLoading={false}
                onBack={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        expect(screen.getByText(enOrders.cancel.back)).toBeInTheDocument()
        expect(screen.getByText(enOrders.cancel.confirm)).toBeInTheDocument()
    })

    it('renders placeholder text from i18n', () => {
        render(
            <CancelOrderModal
                orderNumber="ORD-001"
                isOpen={true}
                isLoading={false}
                onBack={vi.fn()}
                onConfirm={vi.fn()}
            />
        )

        expect(screen.getByPlaceholderText(enOrders.cancel.reasonPlaceholder)).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: Specific key value checks
// ═══════════════════════════════════════════════════════════════════════
describe('TC-F10.i18n.08 — Specific Key Value Correctness', () => {
    it('EN status labels match expected values', () => {
        expect(enOrders.status.pending).toBe('Pending')
        expect(enOrders.status.confirmed).toBe('Confirmed')
        expect(enOrders.status.readyToShip).toBe('Ready to Ship')
        expect(enOrders.status.shipped).toBe('Shipping') // renamed from 'Shipped' (bug #22)
        expect(enOrders.status.completed).toBe('Completed')
        expect(enOrders.status.cancelled).toBe('Cancelled')
        expect(enOrders.status.refunded).toBe('Refunded')
    })

    it('MS status labels match expected values', () => {
        expect(msOrders.status.pending).toBe('Menunggu')
        expect(msOrders.status.confirmed).toBe('Disahkan')
        // Shortened for the tablet/mobile status badge so the pill fits the column
        // without overflow (MS runs longer than EN): 'Sedia untuk Dihantar' → 'Sedia
        // Dihantar', 'Sedang Dihantar' → 'Dihantar'.
        expect(msOrders.status.readyToShip).toBe('Sedia Dihantar')
        expect(msOrders.status.shipped).toBe('Dihantar')
        expect(msOrders.status.completed).toBe('Selesai')
        expect(msOrders.status.cancelled).toBe('Dibatalkan')
        expect(msOrders.status.refunded).toBe('Dikembalikan')
    })

    it('EN action button labels match expected values', () => {
        expect(enOrders.actions.confirmOrder).toBe('Confirm Order')
        expect(enOrders.actions.readyToShip).toBe('Ready to Ship')
        expect(enOrders.actions.shipOrder).toBe('Ship Order')
        expect(enOrders.actions.cancelOrder).toBe('Cancel Order')
        expect(enOrders.actions.refund).toBe('Refund')
    })

    it('MS action button labels match expected values', () => {
        expect(msOrders.actions.confirmOrder).toBe('Sahkan Pesanan')
        expect(msOrders.actions.readyToShip).toBe('Sedia Dihantar')
        expect(msOrders.actions.shipOrder).toBe('Hantar Pesanan')
        expect(msOrders.actions.cancelOrder).toBe('Batal Pesanan')
        expect(msOrders.actions.refund).toBe('Bayaran Balik')
    })

    it('EN filterDates labels match expected values', () => {
        expect(enOrders.filterDates.allDates).toBe('All Dates')
        expect(enOrders.filterDates.today).toBe('Today')
        expect(enOrders.filterDates.thisWeek).toBe('This Week')
        expect(enOrders.filterDates.thisMonth).toBe('This Month')
    })

    it('MS filterDates labels match expected values', () => {
        expect(msOrders.filterDates.allDates).toBe('Semua Tarikh')
        expect(msOrders.filterDates.today).toBe('Hari Ini')
        expect(msOrders.filterDates.thisWeek).toBe('Minggu Ini')
        expect(msOrders.filterDates.thisMonth).toBe('Bulan Ini')
    })

    it('EN detail section labels match expected values', () => {
        expect(enOrders.detail.title).toBe('Order Details')
        expect(enOrders.detail.customerInfo).toBe('CUSTOMER INFORMATION')
        expect(enOrders.detail.paymentInfo).toBe('PAYMENT INFORMATION')
        expect(enOrders.detail.orderItems).toBe('ORDER ITEMS')
        expect(enOrders.detail.orderSummary).toBe('ORDER SUMMARY')
    })

    it('MS detail section labels match expected values', () => {
        expect(msOrders.detail.title).toBe('Butiran Pesanan')
        expect(msOrders.detail.customerInfo).toBe('MAKLUMAT PELANGGAN')
        expect(msOrders.detail.paymentInfo).toBe('MAKLUMAT PEMBAYARAN')
        expect(msOrders.detail.orderItems).toBe('BARANGAN PESANAN')
        expect(msOrders.detail.orderSummary).toBe('RINGKASAN PESANAN')
    })

    it('EN progress step labels match expected values', () => {
        expect(enOrders.progress.pending).toBe('Pending')
        expect(enOrders.progress.confirmed).toBe('Confirmed')
        expect(enOrders.progress.ready).toBe('Ready')
        expect(enOrders.progress.shipped).toBe('Shipping') // renamed from 'Shipped' (bug #22)
        expect(enOrders.progress.completed).toBe('Completed')
    })

    it('MS progress step labels match expected values', () => {
        expect(msOrders.progress.pending).toBe('Menunggu')
        expect(msOrders.progress.confirmed).toBe('Disahkan')
        expect(msOrders.progress.ready).toBe('Sedia')
        expect(msOrders.progress.shipped).toBe('Sedang Dihantar') // renamed from 'Dihantar' (bug #22)
        expect(msOrders.progress.completed).toBe('Selesai')
    })

    it('EN pagination labels match expected values', () => {
        expect(enOrders.pagination.previous).toBe('Previous')
        expect(enOrders.pagination.next).toBe('Next')
    })

    it('MS pagination labels match expected values', () => {
        expect(msOrders.pagination.previous).toBe('Sebelum')
        expect(msOrders.pagination.next).toBe('Seterusnya')
    })
})
