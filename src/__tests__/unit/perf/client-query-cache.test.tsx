/**
 * TC-PERF-100..102 — the dashboard's shared React Query cache (providers/query-provider + hooks/queries).
 * TC-PERF-100 one client per tab: the editor's provider sees what the dashboard cached.
 * TC-PERF-101 a list opened again within 30 s shows its rows with no request; once stale it refetches in the
 *             background with the rows on screen; a window focus does not refetch.
 * TC-PERF-102 switching workspace never shows the other workspace's rows and drops its cache entries.
 * Real: QueryProvider, the products page. Faked: server actions, next/*, heavy modals.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQueryClient } from '@tanstack/react-query'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('next/image', () => ({ default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} /> }))
vi.mock('react-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-dom')>()), createPortal: (node: React.ReactNode) => node }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/use-auto-resize-textarea', () => ({ useAutoResizeTextarea: vi.fn() }))
const actions = vi.hoisted(() => ({ page: vi.fn(), categories: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => ({ getProductsPageAction: actions.page, updateProductFieldAction: vi.fn() }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: actions.categories, getAiCategoriesAction: vi.fn() }))
vi.mock('@/components/dashboard/BulkCreateModal', () => ({ BulkCreateModal: () => null }))
vi.mock('@/components/dashboard/product-form/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/ProductQuickViewModal', () => ({ ProductQuickViewModal: () => null }))

import ProductsPageClient from '@/app/(dashboard)/products/ProductsPageClient'
import { queryKeys } from '@/hooks/queries/query-keys'
import { getQueryClient, QueryProvider } from '@/providers/query-provider'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resetQueryCache } from '../../helpers/query-provider'

const product = (id: string, name: string) => ({ id, name, slug: id, price: 10, currency: 'MYR', status: 'active', inventory: 5, images: [], category: [] })
const pageOf = (...names: string[]) => ({ docs: names.map((n, i) => product(String(i + 1), n)), totalDocs: names.length, counts: { all: names.length, active: names.length, draft: 0, archived: 0 }, page: 1 })
const products = (workspace = 'tenant-1', user = 'user-1') => (
    <I18nProvider defaultLocale="en">
        <QueryProvider workspace={workspace} user={user}>
            <TooltipProvider><ProductsPageClient /></TooltipProvider>
        </QueryProvider>
    </I18nProvider>
)
const settle = () => act(() => new Promise((r) => setTimeout(r, 250)))

beforeEach(() => {
    resetQueryCache()
    actions.page.mockReset()
    actions.categories.mockReset().mockResolvedValue([])
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('one cache for the dashboard and the editor [TC-PERF-100]', () => {
    it('TC-PERF-100 the editor provider (no workspace) reads the same client the dashboard filled', async () => {
        // Arrange
        actions.page.mockResolvedValue(pageOf('Alpha'))
        const { unmount } = render(products())
        await screen.findAllByText('Alpha')
        unmount()
        let seen: unknown
        const Probe = () => { seen = useQueryClient(); return null }

        // Act
        render(<QueryProvider><Probe /></QueryProvider>)

        // Assert
        expect(seen).toBe(getQueryClient())
        expect(getQueryClient().getQueriesData({ queryKey: queryKeys.products.lists('tenant-1:user-1') }).length).toBeGreaterThan(0)
    })
})

describe('fresh for 30 s, then a background refetch [TC-PERF-101]', () => {
    it('TC-PERF-101 reopening within 30 s makes no request; a window focus does not refetch', async () => {
        // Arrange
        actions.page.mockResolvedValue(pageOf('Alpha'))
        const first = render(products())
        await screen.findAllByText('Alpha')
        first.unmount()
        const calls = actions.page.mock.calls.length

        // Act
        render(products())
        await screen.findAllByText('Alpha')
        await act(async () => { window.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
        await settle()

        // Assert
        expect(actions.page).toHaveBeenCalledTimes(calls)
    })

    it('TC-PERF-101 reopening after 30 s shows the cached rows at once and refetches them in the background', async () => {
        // Arrange
        actions.page.mockResolvedValueOnce(pageOf('Alpha'))
        const first = render(products())
        await screen.findAllByText('Alpha')
        first.unmount()
        const now = Date.now()
        vi.spyOn(Date, 'now').mockReturnValue(now + 31_000)
        let finish!: (v: ReturnType<typeof pageOf>) => void
        actions.page.mockReturnValueOnce(new Promise((r) => { finish = r }))

        // Act
        render(products())

        // Assert — the old rows are there before the refetch answers (no skeleton)
        expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(2))
        await act(async () => { finish(pageOf('Alpha renamed')) })
        await screen.findAllByText('Alpha renamed')
    })
})

describe('switching workspace [TC-PERF-102]', () => {
    it("TC-PERF-102 never shows the other workspace's rows and drops its cache entries", async () => {
        // Arrange
        actions.page.mockResolvedValueOnce(pageOf('Shop A product'))
        const view = render(products('tenant-a'))
        await screen.findAllByText('Shop A product')
        let finish!: (v: ReturnType<typeof pageOf>) => void
        actions.page.mockReturnValueOnce(new Promise((r) => { finish = r }))

        // Act
        view.rerender(products('tenant-b'))

        // Assert — workspace B loads its own page; A's rows are gone before B answers
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(2))
        expect(screen.queryAllByText('Shop A product')).toHaveLength(0)
        await act(async () => { finish(pageOf('Shop B product')) })
        await screen.findAllByText('Shop B product')
        const scopes = getQueryClient().getQueryCache().getAll().map((q) => q.queryKey[1])
        expect(scopes).not.toContain('tenant-a:user-1')
    })
})
