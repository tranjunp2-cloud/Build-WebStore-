// @vitest-environment jsdom
// GH-2265: adding or renaming a blog category onto a name that already exists showed
// "Couldn't create the category. Please try again." — now it says the name is taken.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const i18nState = vi.hoisted(() => ({ t: {} as unknown }))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => '/blog/categories',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/i18n', async (importOriginal) => {
    const { interpolateTranslation } = await importOriginal<typeof import('@/i18n')>()
    return { useI18n: () => ({ t: i18nState.t, ti: interpolateTranslation, locale: 'en' }) }
})

vi.mock('@/app/(dashboard)/blog/actions', () => ({
    getBlogCategoriesAction: vi.fn(),
    createBlogCategoryAction: vi.fn(),
    updateBlogCategoryAction: vi.fn(),
    deleteBlogCategoryAction: vi.fn(),
    getCategoryPublishedPostCountAction: vi.fn(),
}))

import { CategoryModal } from '@/app/(dashboard)/blog/_components/CategoryModal'
import BlogCategoriesPage from '@/app/(dashboard)/blog/categories/page'
import * as actions from '@/app/(dashboard)/blog/actions'
import { toast } from 'sonner'

const DUPLICATE = { error: 'A category with this name already exists', code: 'DUPLICATE_SLUG' }
const existing = { id: 'cat-1', name: 'Recent News', slug: 'recent-news', createdAt: '2026-01-01T00:00:00.000Z' }
const other = { id: 'cat-2', name: 'Tips', slug: 'tips', createdAt: '2026-01-02T00:00:00.000Z' }

const pencilOf = (name: string) =>
    screen.getByText(name).closest('div.flex-row.justify-between')!.querySelector('svg.lucide-pencil')!.closest('button')!

describe('[TC-F17-05-02] Manage categories modal — name already taken', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
        vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([existing, other])
    })

    it.each([
        { lang: 'en', dict: en, message: 'A category with this name already exists.' },
        { lang: 'ms', dict: ms, message: 'Kategori dengan nama ini sudah wujud.' },
    ])('$lang: adding "recent news" shows "$message"', async ({ dict, message }) => {
        // Arrange
        i18nState.t = dict
        vi.mocked(actions.createBlogCategoryAction).mockResolvedValue(DUPLICATE)
        const m = dict.dashboard.blog.categoryModal
        render(<CategoryModal onClose={vi.fn()} />)
        fireEvent.click(await screen.findByText(m.addNewBtn))
        fireEvent.change(screen.getByPlaceholderText(m.categoryNamePlaceholder), { target: { value: 'recent news' } })

        // Act
        fireEvent.click(screen.getByRole('button', { name: m.saveBtn }))

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message))
        expect(toast.error).not.toHaveBeenCalledWith(m.toastCreateFail)
    })

    it('renaming onto an existing name shows the same message', async () => {
        // Arrange
        i18nState.t = en
        vi.mocked(actions.updateBlogCategoryAction).mockResolvedValue(DUPLICATE)
        render(<CategoryModal onClose={vi.fn()} />)
        await screen.findByText('Tips')
        fireEvent.click(pencilOf('Tips'))
        const input = screen.getByDisplayValue('Tips')
        fireEvent.change(input, { target: { value: 'recent news' } })

        // Act
        fireEvent.keyDown(input, { key: 'Enter' })

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A category with this name already exists.'))
        expect(actions.updateBlogCategoryAction).toHaveBeenCalledWith('cat-2', { name: 'recent news' })
    })

    it('other failures still show the generic create error', async () => {
        // Arrange
        i18nState.t = en
        vi.mocked(actions.createBlogCategoryAction).mockResolvedValue({ error: 'Failed to create category' })
        const m = en.dashboard.blog.categoryModal
        render(<CategoryModal onClose={vi.fn()} />)
        fireEvent.click(await screen.findByText(m.addNewBtn))
        fireEvent.change(screen.getByPlaceholderText(m.categoryNamePlaceholder), { target: { value: 'Events' } })

        // Act
        fireEvent.click(screen.getByRole('button', { name: m.saveBtn }))

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(m.toastCreateFail))
    })
})

describe('[TC-F17-05-02] Blog categories page — name already taken', () => {
    const fetchMock = vi.fn()
    const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }))
    const conflict = () => reply(409, { success: false, error: { code: 'DUPLICATE_SLUG', details: 'Category with this name already exists' } })

    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
        i18nState.t = en
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('adding a name that exists (409 DUPLICATE_SLUG) shows the duplicate message', async () => {
        // Arrange
        fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
            init?.method === 'POST' ? conflict() : reply(200, { success: true, data: [existing] }))
        const cp = en.dashboard.blog.categoryPage
        render(<BlogCategoriesPage />)
        fireEvent.click(await screen.findByText(cp.addNew))
        const input = screen.getByPlaceholderText(cp.namePlaceholder)
        fireEvent.change(input, { target: { value: 'recent news' } })

        // Act
        fireEvent.keyDown(input, { key: 'Enter' })

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A category with this name already exists.'))
        expect(toast.error).not.toHaveBeenCalledWith(cp.toastCreateFail)
    })

    it('renaming onto a name that exists (409) shows the duplicate message', async () => {
        // Arrange
        fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
            init?.method === 'PATCH' ? conflict() : reply(200, { success: true, data: [existing, other] }))
        render(<BlogCategoriesPage />)
        await screen.findByText('Tips')
        fireEvent.click(pencilOf('Tips'))
        const input = screen.getByDisplayValue('Tips')
        fireEvent.change(input, { target: { value: 'Recent News' } })

        // Act
        fireEvent.keyDown(input, { key: 'Enter' })

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A category with this name already exists.'))
        expect(fetchMock).toHaveBeenCalledWith('/api/blog-categories/cat-2', expect.objectContaining({ method: 'PATCH' }))
    })
})
