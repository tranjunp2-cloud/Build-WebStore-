/**
 * TC-AICP-332 — the blog editor against a stale save: it sends the updatedAt it loaded; after the copilot changed the post
 * and the merchant chose Keep mine, Save is refused -> ONE conflict notice, the title edit stays, no error toast;
 * Load the latest drops the edits and takes the current post + version; Save mine anyway sends the current version again
 * with the same status (draft / publish); a post whose version is unknown saves unchecked.
 * Real: BlogEditorPageClient, useSaveVersion, useAgentChanges, the bus, the notices, en strings. Faked: the blog server
 * actions (a fake server applying the real version check), next/*, the rich editor, the copilot provider.
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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/blog/actions', () => ({
    getBlogCategoriesAction: vi.fn(),
    getCurrentUserAction: vi.fn(),
    saveBlogAction: vi.fn(),
    getBlogByIdAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/actions/media', () => ({ uploadMediaAction: vi.fn() }))
vi.mock('@/app/(dashboard)/blog/_components/CategoryModal', () => ({ CategoryModal: () => null }))
vi.mock('@/app/(dashboard)/blog/_components/ai/blog-agent', () => ({
    BlogAgentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    blogThreadKey: (id: string) => `thread:${id}`,
    useBlogAgent: () => ({
        enabled: false, draft: undefined, busy: false, decide: vi.fn(), undo: undefined, askAgainFor: vi.fn(), threadId: undefined, panel: null,
        setHandlers: vi.fn(),
    }),
}))

import BlogEditorPageClient from '@/app/(dashboard)/blog/[id]/BlogEditorPageClient'
import * as actions from '@/app/(dashboard)/blog/actions'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import { COALESCE_MS } from '@/lib/agent-changes/use-agent-changes'
import { isStaleVersion } from '@/lib/save-version/save-version'

const V1 = '2026-10-22T01:00:00.000Z'
const V2 = '2026-10-22T02:00:00.000Z'
const copy = en.dashboard.agentChanged
const db = { title: 'Original', updatedAt: V1 as string | undefined, clock: 0 }
const post = () => ({ id: 'p1', title: db.title, slug: 'a-post', content: '<p>Body</p>', status: 'draft', category: null, seo: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: db.updatedAt })
const titleInput = () => screen.getByPlaceholderText('e.g. E-commerce marketing strategies') as HTMLInputElement
const saveDraft = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(en.dashboard.blog.editor.saveDraft, 'i') }))
const copilotRetitles = async () => {
    db.title = 'Copilot title'
    db.updatedAt = V2
    await act(async () => {
        announceAgentChange({ action: 'applied', kind: 'blog.update', entities: [{ kind: 'blog_post', id: 'p1' }], changeSetId: `cs-${Math.random()}`, at: Date.now() })
        // the screen hears it once the change window closes: let that land before the next step
        await new Promise((resolve) => setTimeout(resolve, COALESCE_MS + 20))
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    db.title = 'Original'
    db.updatedAt = V1
    db.clock = 0
    localStorage.clear()
    vi.mocked(actions.getBlogByIdAction).mockImplementation(async () => post())
    vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
    vi.mocked(actions.getCurrentUserAction).mockResolvedValue(null)
    vi.mocked(actions.saveBlogAction).mockImplementation((async (input: { title: string; expectedUpdatedAt?: string | null }) => {
        if (isStaleVersion(input.expectedUpdatedAt, db.updatedAt)) return { ok: false, code: 'VERSION_CONFLICT', current: db.updatedAt }
        db.title = input.title
        db.updatedAt = new Date(Date.parse(V2) + ++db.clock * 60_000).toISOString()
        return post()
    }) as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

const mount = async () => {
    render(<I18nProvider defaultLocale="en"><BlogEditorPageClient /></I18nProvider>)
    await waitFor(() => expect(titleInput().value).toBe('Original'))
}

describe('blog editor against a stale save [TC-AICP-332]', () => {
    it('TC-AICP-332: saves with the version it loaded and shows no notice', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My title' } })

        saveDraft()

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveBlogAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'My title', expectedUpdatedAt: V1 }))
        expect(screen.queryByRole('status')).toBeNull()
    })

    it('TC-AICP-332: Keep mine, then Save is refused: one conflict notice, the edit stays, no error toast', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My title' } })
        await copilotRetitles()
        fireEvent.click(await screen.findByText(copy.keepMine))

        saveDraft()

        expect(await screen.findByText(copy.conflict.post)).toBeInTheDocument()
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(titleInput().value).toBe('My title')
        expect(db.title).toBe('Copilot title')
        expect(toast.error).not.toHaveBeenCalled()
        expect(toast.success).not.toHaveBeenCalled()
    })

    it('TC-AICP-332: Save mine anyway sends the current version (same status) and saves the edit', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My title' } })
        await copilotRetitles()
        saveDraft()
        await screen.findByText(copy.conflict.post)

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveBlogAction).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'My title', status: 'draft', expectedUpdatedAt: V2 }))
        expect(db.title).toBe('My title')
        expect(screen.queryByText(copy.conflict.post)).toBeNull()
    })

    it('TC-AICP-332: Load the latest drops the edit and shows the current post; the next save carries the current version', async () => {
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My title' } })
        await copilotRetitles()
        saveDraft()
        await screen.findByText(copy.conflict.post)

        fireEvent.click(screen.getByRole('button', { name: copy.loadLatest }))

        await waitFor(() => expect(titleInput().value).toBe('Copilot title'))
        expect(screen.queryByRole('status')).toBeNull()
        fireEvent.change(titleInput(), { target: { value: 'After load' } })
        saveDraft()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveBlogAction).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'After load', expectedUpdatedAt: V2 }))
    })

    it('TC-AICP-332: a post without a known version is saved unchecked', async () => {
        db.updatedAt = undefined
        await mount()
        fireEvent.change(titleInput(), { target: { value: 'My title' } })
        saveDraft()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveBlogAction).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: undefined }))
    })
})
