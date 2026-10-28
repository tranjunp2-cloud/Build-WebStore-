/**
 * TC-AICP-305 — blog editor follows assistant changes to the open post (from another tab or another chat):
 *   - no unsaved edits: the post is loaded again silently, no notice;
 *   - unsaved edits: nothing is overwritten, the notice shows; Reload fetches and resets the form, Keep mine dismisses
 *     without fetching;
 *   - a change this editor already handled through its own approve/undo handlers does not trigger a second load.
 * Real: the blog editor, useAgentChanges, announceAgentChange (the bus), AgentChangedNotice, en strings. Faked: the
 * server actions, next/navigation + dynamic (rich editor stub), the copilot provider (captures the editor's handlers).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useParams: () => ({ id: 'p1' }),
}))
vi.mock('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="rich-editor" /> }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/app/(dashboard)/blog/actions', () => ({
    getBlogCategoriesAction: vi.fn(),
    getCurrentUserAction: vi.fn(),
    saveBlogAction: vi.fn(),
    getBlogByIdAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/actions/media', () => ({ uploadMediaAction: vi.fn() }))
vi.mock('@/app/(dashboard)/blog/_components/CategoryModal', () => ({ CategoryModal: () => null }))

const agent = vi.hoisted(() => ({ handlers: {} as Record<string, (c: { id: string }) => void> }))
vi.mock('@/app/(dashboard)/blog/_components/ai/blog-agent', () => ({
    BlogAgentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    blogThreadKey: (id: string) => `thread:${id}`,
    useBlogAgent: () => ({
        enabled: false, draft: undefined, busy: false, decide: vi.fn(), undo: undefined, askAgainFor: vi.fn(), threadId: undefined, panel: null,
        setHandlers: (h: typeof agent.handlers) => { agent.handlers = h },
    }),
}))

import BlogEditorPageClient from '@/app/(dashboard)/blog/[id]/BlogEditorPageClient'
import * as actions from '@/app/(dashboard)/blog/actions'
import { I18nProvider } from '@/i18n'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const load = vi.mocked(actions.getBlogByIdAction)
const server = (title: string) => ({
    id: 'p1', title, slug: 'a-post', content: '<p>Body</p>', status: 'draft', category: null, seo: {}, createdAt: '2026-01-01T00:00:00Z',
})
const change = (changeSetId: string, action: AgentChange['action'] = 'applied'): AgentChange => ({
    action, kind: 'blog.update', entities: [{ kind: 'blog_post', id: 'p1' }], changeSetId, at: Date.now(),
})
const titleInput = () => screen.getByPlaceholderText('e.g. E-commerce marketing strategies') as HTMLInputElement
const settle = () => act(() => new Promise((r) => setTimeout(r, 250)))

describe('blog editor follows assistant changes to the open post', () => {
    beforeEach(() => {
        load.mockReset()
        load.mockResolvedValue(server('Original'))
        vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.getCurrentUserAction).mockResolvedValue(null)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        localStorage.clear()
    })
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    const mount = async () => {
        render(<I18nProvider defaultLocale="en"><BlogEditorPageClient /></I18nProvider>)
        await waitFor(() => expect(titleInput().value).toBe('Original'))
        load.mockClear()
    }

    it('TC-AICP-305: no unsaved edits reloads silently, without a notice', async () => {
        await mount()
        load.mockResolvedValue(server('Changed by assistant'))
        act(() => announceAgentChange(change('cs-1')))
        await waitFor(() => expect(titleInput().value).toBe('Changed by assistant'), { timeout: 1000 })
        expect(load).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('The assistant updated this post.')).toBeNull()
    })

    it('TC-AICP-305: unsaved edits show the notice; Reload re-fetches and resets the form', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My edit' } })
        load.mockResolvedValue(server('Changed by assistant'))
        act(() => announceAgentChange(change('cs-1')))
        await screen.findByText('The assistant updated this post.', {}, { timeout: 1000 })
        expect(load).not.toHaveBeenCalled()
        expect(titleInput().value).toBe('My edit')

        fireEvent.click(screen.getByText('Reload'))
        await waitFor(() => expect(titleInput().value).toBe('Changed by assistant'))
        expect(load).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('The assistant updated this post.')).toBeNull()
    })

    it('TC-AICP-305: Keep mine dismisses the notice without fetching and keeps the edit', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My edit' } })
        act(() => announceAgentChange(change('cs-1')))
        await screen.findByText('The assistant updated this post.', {}, { timeout: 1000 })

        fireEvent.click(screen.getByText('Keep mine'))
        expect(screen.queryByText('The assistant updated this post.')).toBeNull()
        expect(load).not.toHaveBeenCalled()
        expect(titleInput().value).toBe('My edit')
    })

    it('TC-AICP-305: a change the editor handled itself does not load the post a second time', async () => {
        await mount()
        // the editor's own approve handler refreshes the form once...
        load.mockResolvedValue(server('Written by assistant'))
        await act(async () => agent.handlers.onUpdated?.({ id: 'cs-1' }))
        await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
        // ...and the gateway's announcement of the same change set adds nothing
        act(() => announceAgentChange(change('cs-1')))
        await settle()
        expect(load).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('The assistant updated this post.')).toBeNull()

        // undo handled by the editor is skipped too; a different change set still loads
        await act(async () => agent.handlers.onReverted?.({ id: 'cs-9' }))
        await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
        act(() => announceAgentChange(change('cs-9', 'undone')))
        await settle()
        expect(load).toHaveBeenCalledTimes(2)
        act(() => announceAgentChange(change('cs-2')))
        await waitFor(() => expect(load).toHaveBeenCalledTimes(3), { timeout: 1000 })
    })
})
