/**
 * TC-AICP-306 — the products list, when the copilot applies or undoes a product change: loads the current page again
 * with the same status tab / sort / page, rows stay on screen the whole time (no skeleton), the tab counts
 * come from the same response, a response that was overtaken by a newer one is dropped, and a failed refresh keeps the
 * rows and does not toast.
 * TC-AICP-307 — other entity kinds are ignored; a burst of three announcements loads once; a product the copilot
 * created shows up as a row; an open quick view shows the refreshed row.
 * Real: ProductsPageClient, the agent-changes bus + hook, en strings. Faked: server actions, next/*, heavy modals.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('next/image', () => ({ default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} /> }))
vi.mock('react-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-dom')>()), createPortal: (node: React.ReactNode) => node }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/hooks/use-auto-resize-textarea', () => ({ useAutoResizeTextarea: vi.fn() }))
const actions = vi.hoisted(() => ({ page: vi.fn(), categories: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => ({ getProductsPageAction: actions.page, updateProductFieldAction: vi.fn() }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: actions.categories, getAiCategoriesAction: vi.fn() }))
vi.mock('@/components/dashboard/BulkCreateModal', () => ({ BulkCreateModal: () => null }))
vi.mock('@/components/dashboard/ProductStoreAskBar', () => ({ ProductStoreAskBar: () => null }))
vi.mock('@/components/dashboard/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/product-form/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/ProductQuickViewModal', () => ({
    ProductQuickViewModal: ({ product }: { product: { name: string } }) => <div data-testid="quick-view">{product.name}</div>,
}))

import ProductsPageClient from '@/app/(dashboard)/products/ProductsPageClient'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentDashboardQueryProvider } from '../../helpers/agent-query-provider'
import { resetQueryCache } from '../../helpers/query-provider'

const product = (id: string, name: string, status = 'active') => ({ id, name, slug: id, price: 10, currency: 'MYR', status, inventory: 5, images: [], category: [] })
const counts = (all: number, active = all, draft = 0) => ({ all, active, draft, archived: 0 })
const result = (docs: ReturnType<typeof product>[], c = counts(docs.length)) => ({ docs, totalDocs: docs.length, counts: c, page: 1 })
const change = (kind: string, id = '*', at = 1): AgentChange => ({ action: 'applied', kind: `${kind}.update`, entities: [{ kind, id }], changeSetId: `cs-${at}`, at })
const deferred = <T,>() => {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}
const mount = () => render(<AgentDashboardQueryProvider><I18nProvider defaultLocale="en"><TooltipProvider><ProductsPageClient /></TooltipProvider></I18nProvider></AgentDashboardQueryProvider>)
const announce = async (c: AgentChange) => { await act(async () => { announceAgentChange(c) }) }
const lastInput = () => actions.page.mock.calls.at(-1)![0]

beforeEach(() => {
    resetQueryCache()
    actions.page.mockReset()
    actions.categories.mockReset().mockResolvedValue([])
    toast.error.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('products list follows the copilot [TC-AICP-306]', () => {
    it('TC-AICP-306 loads the current tab again, keeps rows visible meanwhile, and refreshes the counts', async () => {
        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha')], counts(3, 2, 1)))
        mount()
        await screen.findAllByText('Alpha')

        // the tab's page is requested in the same render as the click (a cached query, no timer): answer queued first
        actions.page.mockResolvedValueOnce(result([product('2', 'Beta draft', 'draft')], counts(3, 2, 1)))
        fireEvent.mouseDown(screen.getByRole('tab', { name: /Draft/ }), { button: 0 })
        await waitFor(() => expect(lastInput()).toMatchObject({ status: 'draft', page: 1 }))
        await screen.findAllByText('Beta draft')

        const refresh = deferred<ReturnType<typeof result>>()
        actions.page.mockReturnValueOnce(refresh.promise)
        const calls = actions.page.mock.calls.length
        await announce(change('product', '2'))
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(calls + 1))
        expect(lastInput()).toMatchObject({ status: 'draft', search: '', page: 1, sort: 'Latest' })
        // the old rows are still there while the refresh is in flight
        expect(screen.getAllByText('Beta draft').length).toBeGreaterThan(0)

        await act(async () => { refresh.resolve(result([product('2', 'Beta renamed', 'draft')], counts(4, 2, 2))) })
        await screen.findAllByText('Beta renamed')
        expect(screen.queryAllByText('Beta draft')).toHaveLength(0)
        expect(screen.getByRole('tab', { name: /Draft/ })).toHaveTextContent('2')
        expect(screen.getByRole('tab', { name: /All/ })).toHaveTextContent('4')
        expect(screen.getByRole('tab', { name: /Draft/ })).toHaveAttribute('data-state', 'active')
    })

    it('TC-AICP-306 drops a refresh that a newer one overtook', async () => {
        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha')]))
        mount()
        await screen.findAllByText('Alpha')

        const first = deferred<ReturnType<typeof result>>()
        const second = deferred<ReturnType<typeof result>>()
        actions.page.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        await announce(change('product', '1', 1))
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(2))
        await new Promise(resolve => setTimeout(resolve, 200)) // a second burst, after the first one fired
        await announce(change('product', '1', 2))
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(3))

        await act(async () => { second.resolve(result([product('1', 'Alpha newest')])) })
        await screen.findAllByText('Alpha newest')
        await act(async () => { first.resolve(result([product('1', 'Alpha stale')])) })
        expect(screen.queryAllByText('Alpha stale')).toHaveLength(0)
        expect(screen.getAllByText('Alpha newest').length).toBeGreaterThan(0)
    })

    it('TC-AICP-306 a failed background refresh keeps the rows and shows no toast', async () => {
        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha')]))
        mount()
        await screen.findAllByText('Alpha')

        actions.page.mockRejectedValueOnce(new Error('boom'))
        await announce(change('product', '1'))
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(toast.error).not.toHaveBeenCalled()
        expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    })
})

describe('products list change filter [TC-AICP-307]', () => {
    it('TC-AICP-307 ignores other entity kinds', async () => {
        actions.page.mockResolvedValue(result([product('1', 'Alpha')]))
        mount()
        await screen.findAllByText('Alpha')
        const calls = actions.page.mock.calls.length

        await announce(change('store_discount', '9'))
        await announce(change('blog_post', '3', 2))
        await new Promise(resolve => setTimeout(resolve, 300))
        expect(actions.page).toHaveBeenCalledTimes(calls)
    })

    it('TC-AICP-307 loads once for a burst of three announcements and shows the product the copilot created', async () => {
        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha')]))
        mount()
        await screen.findAllByText('Alpha')
        const calls = actions.page.mock.calls.length

        actions.page.mockResolvedValueOnce(result([product('7', 'Fresh draft', 'draft'), product('1', 'Alpha')]))
        await act(async () => {
            announceAgentChange(change('product', '7', 1))
            announceAgentChange(change('product', '8', 2))
            announceAgentChange(change('product', '*', 3))
        })
        await screen.findAllByText('Fresh draft')
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(actions.page).toHaveBeenCalledTimes(calls + 1)
    })

    it('TC-AICP-307 reloads the categories only when a category changed, and an open quick view shows the refreshed row', async () => {
        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha')]))
        mount()
        const row = (await screen.findAllByText('Alpha'))[0]
        fireEvent.click(row)
        expect((await screen.findByTestId('quick-view')).textContent).toBe('Alpha')
        const categoryCalls = actions.categories.mock.calls.length

        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha v2')]))
        await announce(change('product', '1'))
        await waitFor(() => expect(screen.getByTestId('quick-view').textContent).toBe('Alpha v2'))
        expect(actions.categories).toHaveBeenCalledTimes(categoryCalls)

        actions.page.mockResolvedValueOnce(result([product('1', 'Alpha v2')]))
        await announce(change('store_category', 'c1', 2))
        await waitFor(() => expect(actions.categories).toHaveBeenCalledTimes(categoryCalls + 1))
    })
})
