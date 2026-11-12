// @vitest-environment jsdom
// GH-2262: saving a category whose name is only spaces did nothing and showed no error.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const i18nState = vi.hoisted(() => ({ t: {} as unknown }))

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/products/categories',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/i18n', async (importOriginal) => {
    const { interpolateTranslation } = await importOriginal<typeof import('@/i18n')>()
    return { useI18n: () => ({ t: i18nState.t, ti: interpolateTranslation }) }
})

vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesAction: vi.fn(),
    saveCategoryAction: vi.fn(),
    deleteCategoryAction: vi.fn(),
    checkCategoryNameAvailable: vi.fn(),
}))

import CategoryManager from '@/app/(dashboard)/products/categories/components/CategoryManager'
import * as actions from '@/app/(dashboard)/products/categories/actions'

const LOCALES = [
    { lang: 'en', dict: en, message: 'Category name is required.' },
    { lang: 'ms', dict: ms, message: 'Nama kategori diperlukan.' },
] as const

async function openAddForm(dict: typeof en) {
    render(<CategoryManager />)
    const strings = dict.dashboard.products.categories
    fireEvent.click(await screen.findByRole('button', { name: strings.addCategory }))
    return {
        nameInput: screen.getByPlaceholderText(strings.form.namePlaceholder),
        saveButton: screen.getByRole('button', { name: strings.form.save }),
    }
}

describe('[TC-F08-05-04] Blank category name shows a required error', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
        vi.mocked(actions.getCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.checkCategoryNameAvailable).mockResolvedValue(true)
        vi.mocked(actions.saveCategoryAction).mockResolvedValue({ id: 'cat-1', name: 'Shoes' })
    })

    it.each(LOCALES)('$lang: a name of only spaces shows "$message" and does not save', async ({ dict, message }) => {
        // Arrange
        i18nState.t = dict
        const { nameInput, saveButton } = await openAddForm(dict)
        fireEvent.change(nameInput, { target: { value: '   ' } })

        // Act
        fireEvent.click(saveButton)

        // Assert
        expect(await screen.findByText(message)).toBeInTheDocument()
        expect(nameInput).toHaveAttribute('aria-invalid', 'true')
        expect(actions.saveCategoryAction).not.toHaveBeenCalled()
    })

    it('typing a real name clears the error at once and lets the category save', async () => {
        // Arrange
        i18nState.t = en
        const { nameInput, saveButton } = await openAddForm(en)
        fireEvent.change(nameInput, { target: { value: '   ' } })
        fireEvent.click(saveButton)
        await screen.findByText('Category name is required.')

        // Act
        fireEvent.change(nameInput, { target: { value: 'Shoes' } })

        // Assert — gone before the 400ms duplicate check runs, and Save works again
        expect(screen.queryByText('Category name is required.')).not.toBeInTheDocument()
        expect(saveButton).toBeEnabled()
        fireEvent.click(saveButton)
        await waitFor(() => expect(actions.saveCategoryAction).toHaveBeenCalledTimes(1))
        expect(vi.mocked(actions.saveCategoryAction).mock.calls[0][0]).toMatchObject({ name: 'Shoes' })
    })
})
