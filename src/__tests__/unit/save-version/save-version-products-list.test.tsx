/**
 * TC-AICP-337 — products list inline changes (status switch): the row's updatedAt goes with the change; a refused change
 * (VERSION_CONFLICT: the product changed elsewhere since the list was read) refreshes the list silently and shows the one
 * small "Changed elsewhere — refreshed" toast, no dialog, no "failed" toast, the row shows the current status; an accepted
 * change moves the row's version on, so a second change right after is not refused.
 * Real: ProductsPageClient, en strings. Faked: server actions, next/*, heavy modals.
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
const actions = vi.hoisted(() => ({ page: vi.fn(), categories: vi.fn(), update: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => ({ getProductsPageAction: actions.page, updateProductFieldAction: actions.update }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: actions.categories, getAiCategoriesAction: vi.fn() }))
vi.mock('@/components/dashboard/BulkCreateModal', () => ({ BulkCreateModal: () => null }))
vi.mock('@/components/dashboard/ProductStoreAskBar', () => ({ ProductStoreAskBar: () => null }))
vi.mock('@/components/dashboard/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/product-form/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/ProductQuickViewModal', () => ({ ProductQuickViewModal: () => null }))

import ProductsPageClient from '@/app/(dashboard)/products/ProductsPageClient'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardQueryProvider, resetQueryCache } from '../../helpers/query-provider'

const V1 = '2026-10-22T01:00:00.000Z'
const V2 = '2026-10-22T02:00:00.000Z'
const V3 = '2026-10-22T03:00:00.000Z'
// price, sku, stock and weight: the publish gate lets it be switched back on
const product = (status: string, updatedAt: string) => ({ id: '1', name: 'Alpha', slug: 'alpha', sku: 'A-1', weight: 0.5, price: 10, currency: 'MYR', status, inventory: 5, images: [], category: [], updatedAt })
const result = (p: ReturnType<typeof product>) => ({ docs: [p], totalDocs: 1, counts: { all: 1, active: p.status === 'active' ? 1 : 0, draft: 0, archived: p.status === 'archived' ? 1 : 0 }, page: 1 })
const mount = () => render(<DashboardQueryProvider><I18nProvider defaultLocale="en"><TooltipProvider><ProductsPageClient /></TooltipProvider></I18nProvider></DashboardQueryProvider>)
const switchEl = async () => (await screen.findAllByRole('switch'))[0]!

beforeEach(() => {
    resetQueryCache()
    actions.page.mockReset()
    actions.update.mockReset()
    actions.categories.mockReset().mockResolvedValue([])
    toast.error.mockReset()
    toast.success.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('products list inline change against a stale row [TC-AICP-337]', () => {
    it('TC-AICP-337: sends the row\'s version; a refused change refreshes the list and shows only the one small toast', async () => {
        actions.page.mockResolvedValueOnce(result(product('active', V1)))
        mount()
        const toggle = await switchEl()
        expect(toggle).toHaveAttribute('aria-checked', 'true')

        // someone archived and re-activated it meanwhile: the server refuses and the list now shows the current row
        actions.update.mockResolvedValueOnce({ ok: false, code: 'VERSION_CONFLICT', current: V2 })
        actions.page.mockResolvedValueOnce(result(product('active', V2)))
        fireEvent.click(toggle)

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
        expect(toast.error).toHaveBeenCalledWith(en.dashboard.agentChanged.changedElsewhere)
        expect(actions.update).toHaveBeenCalledWith('1', { status: 'archived' }, V1)
        await waitFor(() => expect(actions.page).toHaveBeenCalledTimes(2))
        expect(toast.success).not.toHaveBeenCalled()
        await waitFor(() => expect((screen.getAllByRole('switch')[0]!)).toHaveAttribute('aria-checked', 'true'))
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('TC-AICP-337: an accepted change moves the row\'s version on, so a second change before the list reloads is not refused', async () => {
        actions.page.mockResolvedValueOnce(result(product('active', V1)))
        mount()
        const toggle = await switchEl()

        // the list reload after the first change is still in flight: the row only has the version the action returned
        actions.page.mockReturnValueOnce(new Promise(() => {}))
        actions.update.mockResolvedValueOnce({ id: '1', status: 'archived', updatedAt: V2 })
        fireEvent.click(toggle)
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))

        actions.update.mockResolvedValueOnce({ id: '1', status: 'active', updatedAt: V3 })
        actions.page.mockResolvedValue(result(product('active', V3)))
        fireEvent.click(screen.getAllByRole('switch')[0]!)
        await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(2))
        expect(actions.update.mock.calls[0]![2]).toBe(V1)
        expect(actions.update.mock.calls[1]).toEqual(['1', { status: 'active' }, V2])
        expect(toast.error).not.toHaveBeenCalled()
    })
})
