/**
 * TC-AICP-318 — the sidebar badge counts (computed by the dashboard layout on the server) render again when the
 * assistant applies or undoes a change that can alter a count: orders, discounts, an active/archived status of a
 * product. Edits that leave every count as it is (product fields, new draft products, blog, categories, customers and
 * leads, web builder) refresh nothing. The layout and a page that refreshes for the same burst share ONE refresh.
 * Real: CMSLayoutClient, sidebar-badge-refresh, AgentRefresh, the change bus. Faked: next/navigation, sidebar, header.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => {
    const router = { refresh: nav.refresh, push: vi.fn() }
    return { usePathname: () => '/orders', useRouter: () => router }
})
vi.mock('@/components/dashboard/Sidebar', () => ({ DashboardSidebar: () => <nav /> }))
vi.mock('@/components/dashboard/TopHeader', () => ({ TopHeader: () => <header /> }))
vi.mock('@/components/dashboard/TenantAccessWatcher', () => ({ TenantAccessWatcher: () => null }))
vi.mock('@/components/dashboard/DashboardEmptyState', () => ({ DashboardEmptyState: () => <div /> }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))

import { CMSLayoutClient } from '@/app/(dashboard)/_components/CMSLayoutClient'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

let seq = 0
const change = (kind: string, entityKind: string, action: AgentChange['action'] = 'applied'): AgentChange =>
    ({ action, kind, entities: [{ kind: entityKind, id: '*' }], changeSetId: `cs-${++seq}`, at: Date.now() })
const announce = (...changes: AgentChange[]) => act(() => { changes.forEach(announceAgentChange); vi.advanceTimersByTime(150); vi.advanceTimersByTime(50) })

describe('sidebar badge counts refresh with the assistant [TC-AICP-318]', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        nav.refresh.mockClear()
        render(<CMSLayoutClient userName="A" userInitial="A" userEmail="a@x.my"><div /></CMSLayoutClient>)
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it.each([
        ['store.orders_patch', 'store_order'],
        ['store.discounts_patch', 'store_discount'],
        ['shop_product.set_status', 'product'],
        ['store.add_products', 'product'],
    ])('TC-AICP-318 refreshes once for %s', (kind, entityKind) => {
        announce(change(kind, entityKind))

        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-318 refreshes for the undo of an order change', () => {
        announce(change('store.orders_patch', 'store_order', 'undone'))

        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['shop_product.update', 'product'],
        ['shop_product.create_drafts', 'product'],
        ['product.create_drafts', 'product'],
        ['blog.update', 'blog_post'],
        ['store.categories_patch', 'store_category'],
        ['store.customers_patch', 'store_customer'],
        ['store.customers_patch', 'contact_lead'],
        ['site.page_patch', 'site_page'],
    ])('TC-AICP-318 leaves the badges alone for %s on %s', (kind, entityKind) => {
        announce(change(kind, entityKind))

        expect(nav.refresh).not.toHaveBeenCalled()
    })

    it('TC-AICP-318 refreshes once for a burst mixing a count change with edits that change none', () => {
        announce(change('shop_product.update', 'product'), change('store.orders_patch', 'store_order'), change('shop_product.update', 'product'))

        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })
})

describe('layout and page refresh together [TC-AICP-318]', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        nav.refresh.mockClear()
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('TC-AICP-318 renders the route once when the layout badges and the page both listen for the burst', () => {
        render(
            <CMSLayoutClient userName="A" userInitial="A" userEmail="a@x.my">
                <AgentRefresh kinds={['store_order']} />
            </CMSLayoutClient>,
        )

        announce(change('store.orders_patch', 'store_order'), change('store.orders_patch', 'store_order'))

        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })
})
