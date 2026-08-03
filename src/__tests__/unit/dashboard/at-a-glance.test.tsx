import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

type TestLocale = 'en' | 'ms'

vi.mock('@/components/dashboard/revamp/charts', () => ({
    Sparkline: ({ data }: { data: number[] }) => (
        <span data-testid="sparkline" data-values={data.join(',')} />
    ),
}))

vi.mock('@/components/dashboard/revamp/atoms', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/components/dashboard/revamp/atoms')>()
    return {
        ...actual,
        SectionHead: ({ title }: { title: string }) => <h2>{title}</h2>,
        InfoTooltip: ({ tip }: { tip: string }) => <span aria-label={tip} />,
    }
})

import { AtAGlance } from '@/components/dashboard/revamp/at-a-glance'
import { I18nProvider } from '@/i18n'
import type { GlanceData } from '@/lib/dashboard/dashboard-types'

const baseData: GlanceData = {
    rangeLabel: '21 – 27 Jul 2026',
    stats: {
        views: { value: 1_200, delta: 4.2 },
        leads: { value: 42, delta: -2.5 },
        engage: { value: 18.4, delta: 0, unit: '%' },
        revenue: { value: 1_234.56, delta: 12.5, currency: true },
    },
    sparks: {
        views: [100, 120],
        leads: [4, 6],
        engage: [12, 18.4],
        revenue: [100.25, 1_234.56],
    },
}

function dataWithRevenue(value: number, delta: number): GlanceData {
    return {
        ...baseData,
        stats: {
            ...baseData.stats,
            revenue: { value, delta, currency: true },
        },
    }
}

function renderAtAGlance(
    data: GlanceData,
    period: 'today' | '7d' | '30d',
    locale: TestLocale = 'en',
) {
    return render(
        <I18nProvider defaultLocale={locale}>
            <AtAGlance data={data} period={period} showHeader={false} />
        </I18nProvider>,
    )
}

function revenueCard(label: 'Revenue' | 'Hasil' = 'Revenue'): HTMLElement {
    const card = screen.getByText(label).closest('.stat-card')
    if (!card) throw new Error('Revenue card was not rendered')
    return card as HTMLElement
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
})

// ── TC-F03.55 ──────────────────────────────────────────────────────────────
describe('[TC-F03.55] Active Revenue card', () => {
    it('renders real MYR data with two decimals, delta, note, and sparkline', () => {
        // Arrange
        renderAtAGlance(baseData, '7d')

        // Act
        const card = revenueCard()

        // Assert
        expect(within(card).getByText('RM 1,234.56')).toBeInTheDocument()
        expect(within(card).getByText('+12.5%')).toHaveClass('delta', 'up')
        expect(within(card).getByText('vs prev 7d')).toBeInTheDocument()
        expect(within(card).getByTestId('sparkline')).toHaveAttribute(
            'data-values',
            '100.25,1234.56'
        )
        expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
    })
})

// ── TC-F03.55 ──────────────────────────────────────────────────────────────
describe('[TC-F03.55] Revenue edge values', () => {
    it('renders zero revenue and a flat delta without NaN or Infinity', () => {
        // Arrange
        renderAtAGlance(dataWithRevenue(0, 0), 'today')

        // Act
        const card = revenueCard()

        // Assert
        expect(within(card).getByText('RM 0.00')).toBeInTheDocument()
        expect(within(card).getByText('0.0%')).toHaveClass('delta', 'flat')
        expect(within(card).getByText('vs yesterday')).toBeInTheDocument()
        expect(card).not.toHaveTextContent(/NaN|Infinity/)
    })

    it('renders a negative comparison delta', () => {
        // Arrange
        renderAtAGlance(dataWithRevenue(825.5, -8.25), '30d')

        // Act
        const card = revenueCard()

        // Assert
        expect(within(card).getByText('RM 825.50')).toBeInTheDocument()
        expect(within(card).getByText('-8.3%')).toHaveClass('delta', 'down')
        expect(within(card).getByText('vs prev 30d')).toBeInTheDocument()
    })
})

// ── TC-F03.55 ──────────────────────────────────────────────────────────────
describe('[TC-F03.55] Revenue localization', () => {
    it('uses the Malay label and comparison note while retaining MYR formatting', () => {
        // Arrange
        renderAtAGlance(baseData, '7d', 'ms')

        // Act
        const card = revenueCard('Hasil')

        // Assert
        expect(within(card).getByText('Hasil')).toBeInTheDocument()
        expect(within(card).getByText('RM 1,234.56')).toBeInTheDocument()
        expect(within(card).getByText('vs 7h lepas')).toBeInTheDocument()
        expect(screen.queryByText(/akan datang/i)).not.toBeInTheDocument()
    })
})
