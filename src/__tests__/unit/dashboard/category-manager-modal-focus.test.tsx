// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                products: {
                    categories: {
                        title: 'Category Management',
                        subtitle: 'Manage product categories',
                        addCategory: 'Add Category',
                        backToProducts: 'Products',
                        search: 'Search categories...',
                        emptyState: 'Start by creating a new category.',
                        form: {
                            newTitle: 'New Category',
                            editTitle: 'Edit Category',
                            addSubcategoryTitle: 'Add Subcategory',
                            name: 'Category Name',
                            namePlaceholder: 'Type a category name',
                            parent: 'Parent Category',
                            parentNone: '--None--',
                            description: 'Description',
                            descriptionPlaceholder: 'Description',
                            optional: '(Optional)',
                            slug: 'URL Slug',
                            slugPlaceholder: 'category-url',
                            cancel: 'Cancel',
                            save: 'Save',
                            errors: {
                                nameDuplicate: 'Category name already exists in this level.',
                            },
                        },
                        table: {
                            noCategories: 'No Categories',
                            level: 'LEVEL',
                            products: 'PRODUCTS',
                            actions: 'ACTIONS',
                            noResults: 'No results found',
                            tryAdjusting: 'Try adjusting your search terms.',
                        },
                        toast: {
                            loadError: 'Failed to load categories',
                            created: 'Created {name}',
                            updated: 'Updated {name}',
                            saveError: 'Failed to save category',
                            deleteError: 'Failed to delete category',
                            cycleError: 'Cycle error',
                            maxDepthError: 'Max depth error',
                            parentTenantMismatch: 'Parent tenant mismatch',
                            parentSoftDeleted: 'Parent soft deleted',
                            deleted: 'Deleted {name}',
                        },
                        deleteModal: {
                            hasProductsError: 'Has products {count}',
                            tooManyChildrenError: 'Too many children {count}',
                            reparentNameConflictError: 'Name conflict {count}',
                        },
                    },
                },
            },
        },
    }),
}))

vi.mock('@/lib/utils', () => ({
    cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
        <span className={className}>{children}</span>
    ),
}))

vi.mock('@/components/ui/table-search', () => ({
    TableSearch: ({ value, onSearch, placeholder, className = '' }: { value: string; onSearch: (value: string) => void; placeholder?: string; className?: string }) => (
        <input
            value={value}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className={className}
        />
    ),
}))

vi.mock('@/components/ui/label', () => ({
    Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
    Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/confirm-modal', () => ({
    ConfirmModal: () => null,
}))

vi.mock('@/components/ui/table-empty-state', () => ({
    TableEmptyState: ({ title, subtitle }: { title: string; subtitle: string }) => (
        <div>
            <div>{title}</div>
            <div>{subtitle}</div>
        </div>
    ),
}))

vi.mock('@/components/ui/table-pagination', () => ({
    TablePagination: () => null,
    shouldShowTablePagination: () => false,
    useTablePageClamp: () => undefined,
}))

vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesAction: vi.fn(),
    saveCategoryAction: vi.fn(),
    deleteCategoryAction: vi.fn(),
    checkCategoryNameAvailable: vi.fn(),
}))

import CategoryManager from '@/app/(dashboard)/products/categories/components/CategoryManager'
import * as actions from '@/app/(dashboard)/products/categories/actions'

describe('CategoryManager modal focus regression', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(actions.getCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.checkCategoryNameAvailable).mockResolvedValue(true)
        vi.mocked(actions.saveCategoryAction).mockResolvedValue(undefined)
    })

    it('keeps focus on the category name input while typing multiple characters', async () => {
        render(<CategoryManager />)

        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))

        const nameInput = screen.getByPlaceholderText('Type a category name')

        await waitFor(() => {
            expect(nameInput).toHaveFocus()
        })

        fireEvent.change(nameInput, { target: { value: 'F' } })
        expect(nameInput).toHaveValue('F')
        expect(nameInput).toHaveFocus()

        fireEvent.change(nameInput, { target: { value: 'Fa' } })
        expect(nameInput).toHaveValue('Fa')
        expect(nameInput).toHaveFocus()

        fireEvent.change(nameInput, { target: { value: 'Fas' } })
        expect(nameInput).toHaveValue('Fas')
        expect(nameInput).toHaveFocus()
    })

    it('does not submit the form when Enter is pressed inside a text input', async () => {
        render(<CategoryManager />)

        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))

        const nameInput = screen.getByPlaceholderText('Type a category name')
        fireEvent.change(nameInput, { target: { value: 'Fashion' } })
        fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', charCode: 13 })

        await waitFor(() => {
            expect(nameInput).toHaveValue('Fashion')
        })
        expect(actions.saveCategoryAction).not.toHaveBeenCalled()
    })

    it('submits the form only when Save Category is clicked', async () => {
        render(<CategoryManager />)

        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))

        const nameInput = screen.getByPlaceholderText('Type a category name')
        const saveButton = screen.getByRole('button', { name: 'Save' })

        expect(saveButton).toHaveAttribute('form', 'cat-form')
        expect(saveButton).toHaveAttribute('type', 'submit')

        fireEvent.change(nameInput, { target: { value: 'Fashion' } })
        fireEvent.click(saveButton)

        await waitFor(() => {
            expect(actions.saveCategoryAction).toHaveBeenCalledWith({
                name: 'Fashion',
                description: '',
                slug: 'fashion',
                parent: null,
            }, undefined)
        })
    })
})
