/**
 * TC-AICP-310 — discounts list: when the assistant changes a discount, the CURRENT page is fetched again with the same
 * page / sort; the rows stay on screen while it loads (no spinner, no toast when it fails), a slow answer overtaken by a
 * newer one never replaces it, other kinds are ignored, and a burst of announcements gives ONE list fetch.
 * TC-AICP-311 — the Discount codes / Usage history tab counts are read again on a discount change (and only then).
 * Real: DiscountsClientLayout, DiscountsTabNav, useAgentChanges, announceAgentChange (the bus), en strings.
 * Faked: fetch, next/navigation, sonner.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ query: 'page=2&limit=10' }))
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/discounts',
    useSearchParams: () => new URLSearchParams(nav.query),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { DiscountsClientLayout } from '@/app/(dashboard)/discounts/_components/discounts-client-layout'
import { DiscountsTabNav } from '@/app/(dashboard)/discounts/_components/discounts-tab-nav'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentDashboardQueryProvider } from '../../helpers/agent-query-provider'
import { resetQueryCache } from '../../helpers/query-provider'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

type Reply = Response | Promise<Response>
const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
const doc = (code: string) => ({ id: code, code, type: 'percentage', value: 10, status: 'active', usageCount: 0 })
const page = (total: number, ...codes: string[]) => json({ docs: codes.map(doc), totalDocs: total, totalPages: 3, page: 2 })

/** list calls (limit != 1) and count calls (limit=1) are answered separately */
const net = { list: vi.fn<(url: string) => Reply>(), counts: vi.fn<(url: string) => Reply>() }
const calls = (m: typeof net.list) => m.mock.calls.map((c) => c[0])
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('usage-history')) return net.counts(url)
    return url.includes('limit=1&') || url.endsWith('limit=1') ? net.counts(url) : net.list(url)
})

const change = (id: string, kind = 'store_discount'): AgentChange => ({
    action: 'applied', kind: 'store.discounts_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const wrap = (ui: React.ReactElement) => render(<AgentDashboardQueryProvider><I18nProvider defaultLocale="en"><TooltipProvider>{ui}</TooltipProvider></I18nProvider></AgentDashboardQueryProvider>)
const settle = () => act(() => new Promise((r) => setTimeout(r, 260)))

beforeEach(() => {
    resetQueryCache()
    nav.query = 'page=2&limit=10'
    net.list.mockReset()
    net.counts.mockReset()
    net.counts.mockImplementation(() => json({ totalDocs: 25 }))
    toast.error.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('discounts list refreshes when the assistant changes a discount', () => {
    it('TC-AICP-310: refetches the current page keeping rows visible, no spinner, and ignores a stale answer', async () => {
        net.list.mockImplementation(() => page(25, 'OLD10'))
        wrap(<DiscountsClientLayout />)
        await waitFor(() => expect(screen.getAllByText('OLD10').length).toBeGreaterThan(0))
        expect(calls(net.list)[0]).toContain('page=2')

        // first change: its answer is slow; a second change overtakes it
        let slow!: (r: Response) => void
        net.list.mockClear()
        net.list.mockImplementationOnce(() => new Promise<Response>((r) => { slow = r }))
        net.list.mockImplementationOnce(() => page(25, 'NEWEST'))
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(net.list).toHaveBeenCalledTimes(1))
        // same page, limit and sort as the one on screen; rows stay and no spinner while it loads
        expect(calls(net.list)[0]).toContain('page=2&limit=10&sort=-createdAt')
        expect(screen.getAllByText('OLD10').length).toBeGreaterThan(0)
        expect(document.querySelector('.animate-spin')).toBeNull()

        act(() => announceAgentChange(change('d2')))
        await waitFor(() => expect(net.list).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getAllByText('NEWEST').length).toBeGreaterThan(0))

        await act(async () => { slow(await page(25, 'STALE')) })
        await settle()
        expect(screen.queryByText('STALE')).toBeNull()
        expect(screen.getAllByText('NEWEST').length).toBeGreaterThan(0)
    })

    it('TC-AICP-310: a failed background fetch keeps the rows and shows no toast', async () => {
        net.list.mockImplementation(() => page(25, 'KEEP'))
        wrap(<DiscountsClientLayout />)
        await waitFor(() => expect(screen.getAllByText('KEEP').length).toBeGreaterThan(0))

        net.list.mockImplementation(() => Promise.reject(new Error('offline')))
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        await settle()
        expect(screen.getAllByText('KEEP').length).toBeGreaterThan(0)
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-AICP-310: other kinds are ignored; three announcements in one burst give ONE list fetch', async () => {
        net.list.mockImplementation(() => page(25, 'ROW'))
        wrap(<DiscountsClientLayout />)
        await waitFor(() => expect(screen.getAllByText('ROW').length).toBeGreaterThan(0))
        net.list.mockClear()

        act(() => announceAgentChange(change('p1', 'shop_product')))
        await settle()
        expect(net.list).not.toHaveBeenCalled()

        act(() => {
            announceAgentChange(change('d1'))
            announceAgentChange(change('d2'))
            announceAgentChange(change('d3'))
        })
        await waitFor(() => expect(net.list).toHaveBeenCalledTimes(1))
        await settle()
        expect(net.list).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-311: the tab counts are read again on a discount change and not on another kind', async () => {
        net.counts.mockImplementation((url) => json({ totalDocs: url.includes('usage-history') ? 7 : 25 }))
        wrap(<DiscountsTabNav />)
        await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument())
        expect(screen.getByText('7')).toBeInTheDocument()

        net.counts.mockClear()
        act(() => announceAgentChange(change('p1', 'shop_product')))
        await settle()
        expect(net.counts).not.toHaveBeenCalled()

        net.counts.mockImplementation((url) => json({ totalDocs: url.includes('usage-history') ? 7 : 24 }))
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(screen.getByText('24')).toBeInTheDocument())
        expect(screen.getByText('7')).toBeInTheDocument()
        // one read per count per burst
        expect(net.counts).toHaveBeenCalledTimes(2)
    })
})
