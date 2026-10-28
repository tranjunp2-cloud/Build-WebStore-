/**
 * TC-AICP-303 — blog list: when the assistant changes a post, the CURRENT page is fetched again with the same search /
 * filters / sort / page; the rows stay on screen while it loads (no skeleton, no error page when it fails), and a slow
 * answer that is overtaken by a newer one never replaces it.
 * TC-AICP-304 — blog list: changes of other kinds are ignored; three announcements in one burst give ONE refetch.
 * Real: the blog list page, useAgentChanges, announceAgentChange (the bus), en strings. Faked: the server actions,
 * next/navigation, the category modal.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/blog',
    useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/(dashboard)/blog/_components/CategoryModal', () => ({ CategoryModal: () => null }))
vi.mock('@/app/(dashboard)/blog/actions', () => ({
    listBlogsAction: vi.fn(),
    getBlogCategoriesAction: vi.fn(),
    deleteBlogAction: vi.fn(),
    bulkDeleteBlogsAction: vi.fn(),
    updateBlogStatusAction: vi.fn(),
}))

import BlogListPage from '@/app/(dashboard)/blog/page'
import * as actions from '@/app/(dashboard)/blog/actions'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const list = vi.mocked(actions.listBlogsAction)
const post = (id: string, title: string) => ({
    id, title, slug: id, status: 'draft', author: 'Ana', category: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
})
const answer = (...titles: string[]) => ({
    data: titles.map((t, i) => post(`p${i + 1}`, t)),
    meta: { totalDocs: titles.length, totalPages: 1, page: 1, limit: 10, hasNextPage: false, hasPrevPage: false },
})
const change = (changeSetId: string, kind = 'blog_post'): AgentChange => ({
    action: 'applied', kind: 'blog.update', entities: [{ kind, id: 'p1' }], changeSetId, at: Date.now(),
})
const mount = () => render(<I18nProvider defaultLocale="en"><TooltipProvider><BlogListPage /></TooltipProvider></I18nProvider>)
const settle = () => act(() => new Promise((r) => setTimeout(r, 250)))

describe('blog list refreshes when the assistant changes a post', () => {
    beforeEach(() => {
        list.mockReset()
        vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('TC-AICP-303: refetches the current search, keeps rows visible meanwhile, and ignores a stale answer', async () => {
        list.mockResolvedValue(answer('Old title'))
        mount()
        await waitFor(() => expect(screen.getAllByText('Old title').length).toBeGreaterThan(0))

        fireEvent.change(screen.getByPlaceholderText('Search by title...'), { target: { value: 'old' } })
        await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'old', page: 1, sort: '-updatedAt' })), { timeout: 2000 })
        await waitFor(() => expect(screen.getAllByText('Old title').length).toBeGreaterThan(0))

        // first change: its answer is slow; a second change overtakes it
        let slow!: (v: ReturnType<typeof answer>) => void
        list.mockClear()
        list.mockImplementationOnce(() => new Promise((r) => { slow = r as typeof slow }))
        list.mockResolvedValueOnce(answer('Newest title'))
        act(() => announceAgentChange(change('cs-1')))
        await waitFor(() => expect(list).toHaveBeenCalledTimes(1), { timeout: 1000 })
        expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'old', page: 1, limit: 10, sort: '-updatedAt' }))
        // rows stay, no skeleton while it loads
        expect(screen.getAllByText('Old title').length).toBeGreaterThan(0)
        expect(document.querySelector('.animate-pulse')).toBeNull()

        act(() => announceAgentChange(change('cs-2')))
        await waitFor(() => expect(screen.getAllByText('Newest title').length).toBeGreaterThan(0), { timeout: 1000 })
        await act(async () => slow(answer('Stale title')))
        expect(screen.queryByText('Stale title')).toBeNull()
        expect(screen.getAllByText('Newest title').length).toBeGreaterThan(0)
    })

    it('TC-AICP-303: a failed background refresh keeps the rows and shows no error page', async () => {
        list.mockResolvedValueOnce(answer('Kept title'))
        mount()
        await waitFor(() => expect(screen.getAllByText('Kept title').length).toBeGreaterThan(0))

        list.mockRejectedValueOnce(new Error('boom'))
        act(() => announceAgentChange(change('cs-1')))
        await waitFor(() => expect(console.error).toHaveBeenCalled(), { timeout: 1000 })
        expect(screen.getAllByText('Kept title').length).toBeGreaterThan(0)
        expect(screen.queryByText('boom')).toBeNull()
    })

    it('TC-AICP-304: ignores other kinds and refetches once for a burst of three announcements', async () => {
        list.mockResolvedValue(answer('Title'))
        mount()
        await waitFor(() => expect(screen.getAllByText('Title').length).toBeGreaterThan(0))
        list.mockClear()

        act(() => announceAgentChange(change('cs-0', 'shop_product')))
        await settle()
        expect(list).not.toHaveBeenCalled()

        act(() => {
            announceAgentChange(change('cs-1'))
            announceAgentChange(change('cs-2'))
            announceAgentChange(change('cs-3'))
        })
        await settle()
        expect(list).toHaveBeenCalledTimes(1)
    })
})
