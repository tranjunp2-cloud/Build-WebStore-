import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/studio/performance/logs', useSearchParams: () => new URLSearchParams() }))
vi.mock('recharts', () => ({}))

import { Delta, EmptyState, ErrorState } from '@/app/studio/performance/_components/au-parts'
import { GenerationSection } from '@/app/studio/performance/_components/generation-section'
import { LogDrawer } from '@/app/studio/performance/_components/log-drawer'
import { LogsTable } from '@/app/studio/performance/_components/logs-table'
import { PlanTable, TopShopsTable } from '@/app/studio/performance/_components/overview-tables'
import type { GenerationSection as GenerationData } from '@/lib/admin/ai-usage/generation-queries'
import { mapLogRow } from '@/lib/admin/ai-usage/log-queries'

const log = (over: Record<string, unknown> = {}) => mapLogRow({
    id: 10, created_at: '2026-10-29T05:00:00.000Z', tenant_id: 412, shop: 'Kedai Runcit', user_email: 'pakmat@kedairuncit.my', plan: 'FREEMIUM', area: 'dashboard', feature: 'assistant',
    task: 'chat-reply', task_label: 'Chat reply', summary: 'Explained shipping settings', model: 'claude-haiku-5-5', tokens_in: '11900', cached_tokens_in: '11900', tokens_out: '392',
    cost_usd: '0.0015', duration_ms: '2400', outcome: 'ok', run_id: 'run_1', ...over,
})

const stats = { finished: 0, succeeded: 0, successRate: null, medianMs: null, costPerSuccess: null, websiteSetupCost: 0 }
const emptyGen: GenerationData = { current: stats, previous: stats, finishedDeltaPct: null, exclusions: { running: 0, rejected: 0, otherEndpoints: 0 }, failReasons: [], failedTotal: 0, recentFailed: [] }

describe('TC-AIS-OV-010 empty and error states', () => {
    it('shows the error state with a retry link and an alert role', () => {
        render(<ErrorState what="AI usage" retryHref="/studio/performance?period=30d" />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load AI usage.')
        expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/studio/performance?period=30d')
    })

    it('shows an empty state for the top shops and the plan table without crashing', () => {
        render(<><TopShopsTable shops={[]} total={0} sort="cost" query={new URLSearchParams()} /><PlanTable rows={[]} limits={{}} /></>)
        expect(screen.getByText('No shop used AI in this period.')).toBeInTheDocument()
        expect(screen.getByText('Professional')).toBeInTheDocument()
        expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    it('says so when the previous period has nothing to compare with', () => {
        render(<Delta current={5} previous={0} upIsGood />)
        expect(screen.getByText('No earlier data')).toBeInTheDocument()
    })

    it('a rate (pts) with no calls in the earlier period is not compared with 0 %', () => {
        // Arrange + Act
        const { container } = render(<Delta kind="pts" current={78} previous={0} upIsGood noEarlier />)
        // Assert
        expect(screen.getByText('No earlier data')).toBeInTheDocument()
        expect(container.querySelector('[data-tone]')).toBeNull()
    })

    it('renders a delta with the right tone: cost going up is bad', () => {
        const { container } = render(<Delta current={110} previous={100} upIsGood={false} />)
        expect(container.querySelector('[data-tone="bad"]')).toHaveTextContent('10.0%')
    })

    it('renders EmptyState text', () => {
        render(<EmptyState title="No AI calls match" text="Try a wider period." />)
        expect(screen.getByText('No AI calls match')).toBeInTheDocument()
    })
})

describe('TC-AIS-GEN-003 website generation section states', () => {
    it('shows an empty message and no KPI tiles when nothing finished', () => {
        render(<GenerationSection data={emptyGen} compare />)
        expect(screen.getByText('No finished website generations in this period.')).toBeInTheDocument()
        expect(screen.getByText('No failed generations.')).toBeInTheDocument()
    })

    it('lists what is not counted and links failed generations to their detail page', () => {
        const data: GenerationData = { ...emptyGen, current: { ...stats, finished: 10, succeeded: 8, successRate: 80, medianMs: 41000, costPerSuccess: 0.13, websiteSetupCost: 1.04 },
            exclusions: { running: 9, rejected: 14, otherEndpoints: 1204 }, failReasons: [{ code: 'PROVIDER_TIMEOUT', count: 2 }], failedTotal: 2,
            recentFailed: [{ id: 77, shop: 'Kopi Tiam Corner', code: 'PROVIDER_TIMEOUT', at: '2026-10-29T04:41:00.000Z', durationMs: 120000 }] }
        render(<GenerationSection data={data} compare={false} />)
        expect(screen.getByText(/9 still running or stuck, 14 rejected at the form, 1,204 SEO meta and other runs/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Kopi Tiam Corner' })).toHaveAttribute('href', '/studio/generations/77')
        expect(screen.getByText('80.0')).toBeInTheDocument()
        expect(screen.getByText('2m 00s')).toBeInTheDocument()
    })
})

describe('TC-AIS-LOG-007 logs table and drawer', () => {
    it('has no Duration column so it fits 1280px, and opens the drawer through ?log', () => {
        render(<LogsTable rows={[log(), log({ id: 11, cost_usd: null, outcome: 'error' })]} selectedId={11} hrefFor={(id) => `/studio/performance/logs?log=${id}`} />)
        const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
        expect(headers).toEqual(['Time', 'Shop', 'What · Area', 'Model', 'Tokens in / out', 'Cost', 'Status'])
        expect(screen.getAllByRole('link', { name: /Open details: Chat reply/ })[0]).toHaveAttribute('href', '/studio/performance/logs?log=10')
        expect(screen.getByText('Unpriced')).toBeInTheDocument()
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getAllByRole('row')[2]).toHaveAttribute('aria-selected', 'true')
    })

    it('groups other calls of the same reply in the drawer', () => {
        const siblings = [log({ id: 11, task_label: 'Summarize chat', cost_usd: null }), log({ id: 12, task_label: 'Generate title', cost_usd: '0.0004' })]
        render(<LogDrawer log={log()} siblings={siblings} closeHref="/studio/performance/logs" hrefFor={(id) => `/x?log=${id}`} />)
        const dialog = screen.getByRole('dialog', { name: 'Chat reply' })
        const list = within(dialog).getByRole('list')
        expect(within(list).getAllByRole('link')).toHaveLength(2)
        expect(within(list).getByRole('link', { name: /Summarize chat/ })).toHaveAttribute('href', '/x?log=11')
        expect(within(list).getByText('Unpriced')).toBeInTheDocument()
        expect(within(dialog).getByText('run_1')).toBeInTheDocument()
    })

    it('explains a call that is not part of a chat reply and shows the error box', () => {
        render(<LogDrawer log={log({ run_id: null, outcome: 'error', error_code: 'rate_limited', error_label: 'Rate limited (429)' })} siblings={[]} closeHref="/studio/performance/logs" hrefFor={(id) => `/x?log=${id}`} />)
        expect(screen.getByText('This call is not part of a chat reply.')).toBeInTheDocument()
        expect(screen.getByText('rate_limited')).toBeInTheDocument()
    })
})
