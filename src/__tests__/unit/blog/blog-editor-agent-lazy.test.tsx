/**
 * TC-AIREL-266 — the blog editor loads its copilot (blog-agent → @ech/agent-react, the chat panel and its styles)
 * only when the copilot is switched on: with it off the module is never evaluated, so none of it reaches the editor.
 * Real: BlogEditorPageClient (its on-demand shell), en strings. Faked: the server actions, next/navigation + dynamic
 * (rich editor stub), the copilot module (records that it was evaluated, renders a panel stand-in).
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

const copilot = vi.hoisted(() => ({ evaluated: 0 }))
vi.mock('@/app/(dashboard)/blog/_components/ai/blog-agent', () => {
    // runs only when the module is imported
    copilot.evaluated += 1
    return {
        BlogAgentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        blogThreadKey: (id: string) => `thread:${id}`,
        useBlogAgent: () => ({
            enabled: true, draft: undefined, busy: false, decide: vi.fn(), undo: undefined, askAgainFor: vi.fn(),
            threadId: undefined, setHandlers: vi.fn(), panel: <div data-testid="copilot-panel" />,
        }),
    }
})

import BlogEditorPageClient from '@/app/(dashboard)/blog/[id]/BlogEditorPageClient'
import * as actions from '@/app/(dashboard)/blog/actions'
import { I18nProvider } from '@/i18n'

const titleInput = () => screen.getByPlaceholderText('e.g. E-commerce marketing strategies') as HTMLInputElement

describe('blog editor loads its copilot on demand [TC-AIREL-266]', () => {
    beforeEach(() => {
        vi.mocked(actions.getBlogByIdAction).mockResolvedValue({
            id: 'p1', title: 'Original', slug: 'a-post', content: '<p>Body</p>', status: 'draft', category: null, seo: {}, createdAt: '2026-01-01T00:00:00Z',
        } as never)
        vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.getCurrentUserAction).mockResolvedValue(null)
        localStorage.clear()
    })
    afterEach(() => {
        cleanup()
    })

    it('TC-AIREL-266: with the copilot off the editor works and blog-agent is never evaluated', async () => {
        // Act
        render(<I18nProvider defaultLocale="en"><BlogEditorPageClient /></I18nProvider>)

        // Assert
        await waitFor(() => expect(titleInput().value).toBe('Original'))
        expect(copilot.evaluated).toBe(0)
        expect(screen.queryByTestId('copilot-panel')).toBeNull()
    })

    it('TC-AIREL-266: with the copilot on blog-agent is loaded and its panel shows in the editor', async () => {
        // Act
        render(<I18nProvider defaultLocale="en"><BlogEditorPageClient agentEnabled /></I18nProvider>)

        // Assert
        expect(await screen.findByTestId('copilot-panel')).toBeInTheDocument()
        await waitFor(() => expect(titleInput().value).toBe('Original'))
        expect(copilot.evaluated).toBe(1)
    })
})
