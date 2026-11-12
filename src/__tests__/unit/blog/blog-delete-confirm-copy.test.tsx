import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import React from 'react'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

// ── Mocks (must be before all imports) ────────────────────────────────────────

// The dialog must render with the real locale files: the bug (GH-2264) is in the
// copy itself, so a hand-written translation mock would hide it.
const i18nState = vi.hoisted(() => ({ dict: {} as Record<string, unknown>, locale: 'en' }))

vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({ t: i18nState.dict, locale: i18nState.locale })),
}))

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    usePathname: vi.fn(() => '/blog'),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

vi.mock('next/link', () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        React.createElement('a', { href, className }, children),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/(dashboard)/blog/actions', () => ({
    listBlogsAction: vi.fn(),
    getBlogCategoriesAction: vi.fn(),
    deleteBlogAction: vi.fn(),
    bulkDeleteBlogsAction: vi.fn(),
    updateBlogStatusAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/blog/_components/CategoryModal', () => ({
    CategoryModal: () => <div data-testid="category-modal" />,
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import BlogListPage from '@/app/(dashboard)/blog/page'
import * as actions from '@/app/(dashboard)/blog/actions'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardQueryProvider, resetQueryCache } from '../../helpers/query-provider'

const POST_TITLE = 'QA-TEST Mẹo Chọn Xi Măng'

const renderPage = async () => {
    await act(async () => {
        render(<DashboardQueryProvider><TooltipProvider><BlogListPage /></TooltipProvider></DashboardQueryProvider>)
    })
}

const countOccurrences = (text: string, sentence: string) => text.split(sentence).length - 1

// ═══════════════════════════════════════════════════════════════════════════
// TC-F17-04-05 — Delete confirmation dialog (GH-2264: sentence was repeated)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F17-04-05] Delete post dialog states the cannot-undo warning once', () => {
    beforeEach(() => {
        resetQueryCache()
        vi.clearAllMocks()
        vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.listBlogsAction).mockResolvedValue({
            data: [{
                id: 'post-1',
                title: POST_TITLE,
                slug: 'qa-test',
                status: 'published',
                author: { name: 'QA', email: 'qa@yopmail.com' },
                category: null,
                thumbnail: null,
                createdAt: '2026-11-04T00:00:00.000Z',
                updatedAt: '2026-11-04T00:00:00.000Z',
            }],
            meta: { totalDocs: 1, totalPages: 1, page: 1, limit: 20, hasPrevPage: false, hasNextPage: false },
        } as never)
    })

    // `cannotUndo` is the phrase both old sentences shared (ms used two different
    // verbs, "diperbetulkan" and "dipulihkan", so match the common part).
    it.each([
        ['en', en, "can't be undone", 'Delete "QA-TEST Mẹo Chọn Xi Măng"?'],
        ['ms', ms, 'tidak boleh', 'Padam "QA-TEST Mẹo Chọn Xi Măng"?'],
    ])('%s: asks once and states the cannot-undo warning once', async (locale, dict, cannotUndo, question) => {
        // Arrange
        i18nState.dict = dict as Record<string, unknown>
        i18nState.locale = locale
        await renderPage()
        const deleteLabel = (dict as typeof en).dashboard.blog.actions.delete

        // Act — open the confirm dialog from the post's Delete button
        const deleteButton = await waitFor(() => screen.getAllByRole('button', { name: deleteLabel })[0])
        fireEvent.click(deleteButton)

        // Assert
        const dialog = await screen.findByRole('dialog')
        const text = dialog.textContent ?? ''
        expect(text).toContain(question)
        expect(countOccurrences(text, POST_TITLE)).toBe(1)
        expect(countOccurrences(text, cannotUndo)).toBe(1)
        expect(within(dialog).getByText(/permanently|kekal/)).toBeInTheDocument()
    })
})
