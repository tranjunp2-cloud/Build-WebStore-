/**
 * Unit Tests — F10 Order Management: OrdersMetrics Responsive Layout
 *
 * TC-F10.responsive.01 — Covers:
 *   1. Container responsive classes (mobile scroll vs md+ grid)
 *   2. Card responsive classes (mobile fixed width vs md+ shrink)
 *   3. Label responsive truncation (line-clamp-2 vs xl:line-clamp-1)
 *   4. All 7 status labels render correctly
 *
 * GH-1490 Reference:
 *   Issue 1: Mobile horizontal scroll with snap per card (130px floor width)
 *   Issue 2: Tablet/desktop proper 7-column grid layout without forced wrapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import enLocale from '@/i18n/locales/en.json'

// ── Shared i18n mock ────────────────────────────────────────────────────────
const enOrders = enLocale.dashboard.orders

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { dashboard: { orders: enOrders } },
        locale: 'en',
    }),
}))

// ── Mock lucide-react icons ──────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
    Clock: () => <span data-testid="icon-clock" />,
    CheckCircle2: () => <span data-testid="icon-check-circle-2" />,
    Package: () => <span data-testid="icon-package" />,
    Truck: () => <span data-testid="icon-truck" />,
    XCircle: () => <span data-testid="icon-x-circle" />,
    RotateCcw: () => <span data-testid="icon-rotate-ccw" />,
}))

// ── Import after mocks ───────────────────────────────────────────────────────
import { OrdersMetrics } from '@/app/(dashboard)/orders/_components/OrdersMetrics'

// ═══════════════════════════════════════════════════════════════════════════
// TC-F10.responsive.01 — OrdersMetrics Responsive Layout (GH-1490)
// ═══════════════════════════════════════════════════════════════════════════

describe('TC-F10.responsive.01 — OrdersMetrics Responsive Layout (GH-1490)', () => {
    beforeEach(() => {
        // Mock the fetch call that OrdersMetrics makes internally
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    pending: 5,
                    confirmed: 2,
                    readyToShip: 3,
                    shipped: 1,
                    completed: 4,
                    cancelled: 0,
                    refunded: 1,
                },
            }),
        } as Response)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    /**
     * TC-F10.responsive.01a — Container has horizontal-scroll classes for mobile (<768px)
     * AND grid layout classes for tablet/desktop (≥768px) simultaneously.
     *
     * Both breakpoint sets coexist in the DOM at all times since Tailwind responsive
     * utilities are not removed when inactive — CSS media queries control visibility.
     *
     * Note: sidebar-scroll (F18 #1138) provides a thin, low-opacity scrollbar
     * (instead of scrollbar-hide) to give mobile users visual affordance that
     * more content is available horizontally.
     */
    it('container has both mobile horizontal-scroll AND md+ grid layout classes', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Act — Wait for fetch to complete and component to render
        await waitFor(() => {
            expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        })

        const container = document.querySelector('[class*="flex"][class*="overflow-x-auto"]')
        const containerClassName = container?.className || ''

        // Assert — Mobile/small-tablet horizontal scroll classes
        expect(containerClassName).toContain('flex')
        expect(containerClassName).toContain('overflow-x-auto')
        expect(containerClassName).toContain('sidebar-scroll') // F18 #1138 scrollbar affordance
        expect(containerClassName).toContain('snap-x')
        expect(containerClassName).toContain('snap-mandatory')
        expect(containerClassName).toContain('gap-3')
        expect(containerClassName).toContain('pb-1') // Extra padding for mobile scroll

        // Assert — Tablet/desktop grid layout classes
        expect(containerClassName).toContain('xl:grid')
        expect(containerClassName).toContain('xl:grid-cols-7')
        expect(containerClassName).toContain('xl:overflow-visible')
        expect(containerClassName).toContain('xl:snap-none')
        expect(containerClassName).toContain('xl:pb-0') // Remove mobile scroll padding
        expect(containerClassName).toContain('2xl:gap-[22px]') // Desktop spacing
    })

    /**
     * TC-F10.responsive.01b — Each card element has mobile fixed-width floor
     * (shrink-0 min-w-[130px] snap-start) AND tablet/desktop responsive override
     * (xl:min-w-0 xl:shrink).
     */
    it('each card has mobile min-width floor AND md+ shrink override classes', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Act — Wait for fetch to complete
        await waitFor(() => {
            expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        })

        const container = document.querySelector('[class*="flex"][class*="overflow-x-auto"]')
        // Select direct children that have both shrink-0 and min-w-[130px] (excludes icon containers)
        const cards = container?.querySelectorAll(':scope > div[class*="min-w-[130px]"]')

        // Assert — 7 cards total
        expect(cards?.length).toBe(7)

        // Assert each card has both breakpoint sets
        cards?.forEach((card) => {
            const className = card.className

            // Mobile/small-tablet floor width (issue 1)
            expect(className).toContain('shrink-0')
            expect(className).toContain('min-w-[130px]')
            expect(className).toContain('snap-start')

            // Tablet/desktop override (issue 2)
            expect(className).toContain('xl:min-w-0')
            expect(className).toContain('xl:shrink')

            // Base styling (all breakpoints)
            expect(className).toContain('bg-dash-surface')
            expect(className).toContain('border')
            expect(className).toContain('border-dash-border')
            expect(className).toContain('rounded-2xl')
            expect(className).toContain('flex')
            expect(className).toContain('items-center')
        })
    })

    /**
     * TC-F10.responsive.01c — Label span has line-clamp-2 (mobile/tablet default)
     * AND xl:line-clamp-1 (tablet/desktop override to prevent overflow).
     *
     * This ensures narrow grid cells don't cause label text to wrap and overflow
     * the card container at ≥768px.
     */
    it('label spans have line-clamp-2 AND xl:line-clamp-1 classes', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Act — Wait for fetch to complete
        await waitFor(() => {
            expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        })

        const labels = document.querySelectorAll(
            '[class*="text-slate-400"][class*="line-clamp"]'
        )

        // Assert — 7 labels (one per card)
        expect(labels.length).toBe(7)

        // Assert each label has both line-clamp variants
        labels.forEach((label) => {
            const className = label.className

            // Mobile/tablet (2 lines max)
            expect(className).toContain('line-clamp-2')

            // Tablet/desktop override (1 line, truncate with ellipsis)
            expect(className).toContain('xl:line-clamp-1')

            // Base styling
            expect(className).toContain('text-slate-400')
            expect(className).toContain('font-normal')
        })
    })

    /**
     * TC-F10.responsive.01d — All 7 status labels render correctly from i18n.
     *
     * Reuses mock-fetch pattern from f10-orders-i18n.test.tsx to verify
     * the OrdersMetrics component properly renders all 7 cards with correct labels.
     */
    it('renders all 7 status labels from i18n (verified via DOM text)', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Assert — All 7 expected labels appear in the DOM
        // The first 5 use metrics keys, last 2 use status keys (confirmed/refunded)
        expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        expect(screen.getByText(enOrders.status.confirmed)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.readyToShip)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.shipped)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.completed)).toBeInTheDocument()
        expect(screen.getByText(enOrders.metrics.cancelled)).toBeInTheDocument()
        expect(screen.getByText(enOrders.status.refunded)).toBeInTheDocument()
    })

    /**
     * TC-F10.responsive.01e — Card container has proper padding and sizing
     * across all breakpoints (p-2 mobile, 2xl:p-[17px] for desktop).
     *
     * Ensures cards maintain visual hierarchy and proper spacing on all screens.
     */
    it('cards have responsive padding classes (p-2 mobile, 2xl:p-[17px] desktop)', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Act — Wait for fetch to complete
        await waitFor(() => {
            expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        })

        const container = document.querySelector('[class*="flex"][class*="overflow-x-auto"]')
        // Select direct children that have min-w-[130px] (the card divs, not icon containers)
        const cards = container?.querySelectorAll(':scope > div[class*="min-w-[130px]"]')

        // Assert
        cards?.forEach((card) => {
            const className = card.className

            // Mobile padding (tight for 130px width)
            expect(className).toContain('p-2')

            // Desktop padding (spacious for wider cards)
            expect(className).toContain('2xl:p-[17px]')

            // Height responsive (desktop only)
            expect(className).toContain('2xl:h-[84px]')
        })
    })

    /**
     * TC-F10.responsive.01f — Icon container and gap have responsive scaling.
     *
     * Ensures icons and gaps scale appropriately across breakpoints:
     * - Mobile: 8×8 icon, 1.5 gap
     * - Desktop (xl): 10×10 icon, 12px gap
     */
    it('icon and gap sizes have responsive classes (mobile vs xl)', async () => {
        // Arrange
        render(<OrdersMetrics />)

        // Act — Wait for fetch to complete
        await waitFor(() => {
            expect(screen.getByText(enOrders.metrics.pending)).toBeInTheDocument()
        })

        const container = document.querySelector('[class*="flex"][class*="overflow-x-auto"]')
        // Select direct children that have min-w-[130px] (the card divs, not icon containers)
        const cards = container?.querySelectorAll(':scope > div[class*="min-w-[130px]"]')

        // Assert gap in container
        const containerClassName = container?.className || ''
        expect(containerClassName).toContain('gap-3') // mobile
        expect(containerClassName).toContain('2xl:gap-[22px]') // desktop

        // Assert gap in cards
        cards?.forEach((card) => {
            const className = card.className
            expect(className).toContain('gap-1.5') // mobile
            expect(className).toContain('2xl:gap-[12px]') // desktop
        })

        // Assert icon sizing
        const iconContainers = document.querySelectorAll('[class*="w-8"][class*="h-8"]')
        expect(iconContainers.length).toBeGreaterThan(0)
        iconContainers.forEach((iconDiv) => {
            const className = iconDiv.className
            expect(className).toContain('w-8') // mobile
            expect(className).toContain('h-8') // mobile
            expect(className).toContain('2xl:w-10') // desktop
            expect(className).toContain('2xl:h-10') // desktop
        })
    })
})
