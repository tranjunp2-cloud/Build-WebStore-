// @vitest-environment jsdom

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
        ti: (template: string, values: Record<string, string | number>) => (
            Object.entries(values).reduce(
                (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
                template,
            )
        ),
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
                            subcategoryContext: 'Adding a subcategory under {parentName} (L{currentLevel}) → new category will be Level {newLevel}.',
                            parentLockedHelp: 'Locked — you are adding under this category.',
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
                            parentInvalid: 'The selected parent category is invalid. Please choose it again.',
                            parentSoftDeleted: 'Parent soft deleted',
                            deleted: 'Deleted {name}',
                        },
                        deleteModal: {
                            title: 'Delete Category',
                            confirm: 'Delete',
                            cancel: 'Cancel',
                            warning1: 'Are you sure you want to delete',
                            hasProductsError: 'Cannot delete this category. There are {count} products still assigned to it. Please reassign your products first.',
                            tooManyChildrenError: 'Too many children {count}',
                            reparentNameConflictError: 'Name conflict {count}',
                        },
                        addSubcategory: 'Add Subcategory',
                        edit: 'Edit',
                        delete: 'Delete',
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
    Select: ({
        children,
        disabled = false,
        value,
    }: {
        children: React.ReactNode
        disabled?: boolean
        value?: string
    }) => (
        <div data-testid="parent-select" data-value={value}>
            {React.Children.map(children, child => (
                React.isValidElement<{ disabled?: boolean }>(child)
                    ? React.cloneElement(child, { disabled })
                    : child
            ))}
        </div>
    ),
    SelectTrigger: ({ children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button type="button" disabled={disabled} {...props}>{children}</button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/confirm-modal', () => ({
    ConfirmModal: ({
        open,
        onConfirm,
        title,
        confirmLabel,
    }: {
        open: boolean
        onConfirm: () => void
        title: string
        confirmLabel: string
    }) => open ? (
        <div role="dialog" aria-label={title}>
            <button type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
    ) : null,
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
import { toast } from 'sonner'

const categoryFixture = [
    { id: 'root', name: 'Accessories', parent: null, productCount: 0 },
    { id: 'child', name: 'Bags', parent: 'root', productCount: 0 },
    { id: 'grandchild', name: 'Clutches', parent: 'child', productCount: 0 },
]

describe('CategoryManager modal focus regression', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(actions.getCategoriesAction).mockResolvedValue([])
        vi.mocked(actions.checkCategoryNameAvailable).mockResolvedValue(true)
        vi.mocked(actions.saveCategoryAction).mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        vi.mocked(actions.deleteCategoryAction).mockResolvedValue({ success: true })
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

    it('TC-F08-05-18: maps an invalid parent sentinel to a localized error', async () => {
        // Arrange
        vi.mocked(actions.saveCategoryAction).mockResolvedValueOnce({ success: false, error: 'CATEGORY_PARENT_ID_INVALID' })
        render(<CategoryManager />)
        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))

        const nameInput = screen.getByPlaceholderText('Type a category name')
        fireEvent.change(nameInput, { target: { value: 'Invalid Child' } })

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'The selected parent category is invalid. Please choose it again.',
            )
        })
        expect(toast.error).not.toHaveBeenCalledWith('CATEGORY_PARENT_ID_INVALID')
        expect(screen.getByRole('dialog')).toBeVisible()
    })

    it('TC-F08-05-39: explains the L1 to L2 transition and locks the selected parent', async () => {
        // Arrange
        vi.mocked(actions.getCategoriesAction).mockResolvedValue(categoryFixture)
        render(<CategoryManager />)
        const rootName = await screen.findByText('Accessories')
        const rootRow = rootName.closest('.group')
        expect(rootRow).not.toBeNull()

        // Act
        fireEvent.click(within(rootRow as HTMLElement).getByRole('button', { name: 'Add Subcategory' }))

        // Assert
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('heading', { name: 'Add Subcategory' })).toBeVisible()
        expect(within(dialog).getByRole('note')).toHaveTextContent(
            'Adding a subcategory under Accessories (L1) → new category will be Level 2.',
        )
        expect(within(within(dialog).getByRole('note')).getByText('Accessories', { exact: true }).tagName).toBe('STRONG')
        expect(within(dialog).getByText('Locked — you are adding under this category.')).toBeVisible()
        expect(within(dialog).getByTestId('parent-select')).toHaveAttribute('data-value', 'root')
        expect(within(dialog).getByRole('button', { name: '--None--' })).toBeDisabled()
        expect(within(dialog).getByRole('button', { name: '--None--' })).toHaveAttribute(
            'aria-describedby',
            'category-parent-locked-help',
        )
    })

    it('TC-F08-05-39: explains the L2 to L3 transition from the child row action', async () => {
        // Arrange
        vi.mocked(actions.getCategoriesAction).mockResolvedValue(categoryFixture)
        render(<CategoryManager />)
        const rootName = await screen.findByText('Accessories')
        const rootRow = rootName.closest('.group')
        expect(rootRow).not.toBeNull()
        fireEvent.click(within(rootRow as HTMLElement).getByRole('button', { expanded: false }))
        const childName = await screen.findByText('Bags')
        const childRow = childName.closest('.group')
        expect(childRow).not.toBeNull()

        // Act
        fireEvent.click(within(childRow as HTMLElement).getByRole('button', { name: 'Add Subcategory' }))

        // Assert
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('note')).toHaveTextContent(
            'Adding a subcategory under Bags (L2) → new category will be Level 3.',
        )
        expect(within(dialog).getByTestId('parent-select')).toHaveAttribute('data-value', 'child')
        expect(within(dialog).getByRole('button', { name: '--None--' })).toBeDisabled()
    })

    it('TC-F08-05-39: omits subcategory guidance from toolbar create and edit flows', async () => {
        // Arrange
        vi.mocked(actions.getCategoriesAction).mockResolvedValue(categoryFixture)
        render(<CategoryManager />)
        await screen.findByText('Accessories')

        // Act + Assert: toolbar create.
        fireEvent.click(screen.getByRole('button', { name: 'Add Category' }))
        let dialog = screen.getByRole('dialog')
        expect(within(dialog).queryByRole('note')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Locked — you are adding under this category.')).not.toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: '--None--' })).toBeEnabled()

        fireEvent.keyDown(dialog, { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

        // Act + Assert: edit.
        const rootRow = screen.getByText('Accessories').closest('.group')
        expect(rootRow).not.toBeNull()
        fireEvent.click(within(rootRow as HTMLElement).getByRole('button', { name: 'Edit' }))
        dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('heading', { name: 'Edit Category' })).toBeVisible()
        expect(within(dialog).queryByRole('note')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Locked — you are adding under this category.')).not.toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: '--None--' })).toBeEnabled()
    })

    it('TC-F08-05-38: applies distinct authoritative classes to L1, L2, and L3 badges', async () => {
        // Arrange
        vi.mocked(actions.getCategoriesAction).mockResolvedValue(categoryFixture)
        render(<CategoryManager />)
        const rootName = await screen.findByText('Accessories')
        const rootRow = rootName.closest('.group')
        expect(rootRow).not.toBeNull()

        // Act
        fireEvent.click(within(rootRow as HTMLElement).getByRole('button', { expanded: false }))
        const childName = await screen.findByText('Bags')
        const childRow = childName.closest('.group')
        expect(childRow).not.toBeNull()
        fireEvent.click(within(childRow as HTMLElement).getByRole('button', { expanded: false }))

        // Assert
        expect(within(rootRow as HTMLElement).getByText('L1')).toHaveClass('!text-[hsl(var(--primary))]')
        expect(within(childRow as HTMLElement).getByText('L2')).toHaveClass('!text-[hsl(var(--info))]')
        const grandchildRow = (await screen.findByText('Clutches')).closest('.group')
        expect(grandchildRow).not.toBeNull()
        expect(within(grandchildRow as HTMLElement).getByText('L3')).toHaveClass('!text-[hsl(var(--p-violet-300))]')
    })

    it('TC-F08-05-06: reports the exact assigned-product count and keeps delete confirmation open', async () => {
        // Arrange
        vi.mocked(actions.getCategoriesAction).mockResolvedValue([categoryFixture[0]])
        vi.mocked(actions.deleteCategoryAction).mockResolvedValueOnce({
            success: false,
            error: 'CATEGORY_HAS_PRODUCTS',
            count: 1,
        })
        render(<CategoryManager />)
        const rootName = await screen.findByText('Accessories')
        const rootRow = rootName.closest('.group')
        expect(rootRow).not.toBeNull()
        fireEvent.click(within(rootRow as HTMLElement).getByRole('button', { name: 'Delete' }))

        // Act
        const deleteDialog = screen.getByRole('dialog', { name: 'Delete Category' })
        fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Delete' }))

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'Cannot delete this category. There are 1 products still assigned to it. Please reassign your products first.',
            )
        })
        expect(toast.error).not.toHaveBeenCalledWith('Failed to delete category')
        expect(screen.getByRole('dialog', { name: 'Delete Category' })).toBeVisible()
    })

})
