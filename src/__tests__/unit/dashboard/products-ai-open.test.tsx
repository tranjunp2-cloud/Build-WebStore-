import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { bulkCreateProps, mockRouterPush } = vi.hoisted(() => ({
    bulkCreateProps: [] as Array<{
        categories: Array<{ id: string | number; name: string }>
        initialPrompt: string
        onClose: () => void
        onPartialSuccess?: () => void
        onSuccess: () => void
    }>,
    mockRouterPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: mockRouterPush, refresh: vi.fn() })),
}))

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: {
        href: string
        children: React.ReactNode
        [key: string]: unknown
    }) => React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/image', () => ({
    default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt ?? ''} {...props} />
    ),
}))

vi.mock('react-dom', async importOriginal => {
    const actual = await importOriginal<typeof import('react-dom')>()
    return { ...actual, createPortal: (node: React.ReactNode) => node }
})

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks/use-auto-resize-textarea', () => ({
    useAutoResizeTextarea: vi.fn(),
}))

vi.mock('@/app/(dashboard)/products/actions', () => ({
    getProductsAction: vi.fn(),
    updateProductFieldAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesAction: vi.fn(),
    getAiCategoriesAction: vi.fn(),
}))

vi.mock('@/components/dashboard/BulkCreateModal', () => ({
    BulkCreateModal: (props: {
        categories: Array<{ id: string | number; name: string }>
        initialPrompt: string
        onClose: () => void
        onPartialSuccess?: () => void
        onSuccess: () => void
    }) => {
        bulkCreateProps.push(props)
        return <div data-testid="bulk-create-modal" />
    },
}))

import ProductsPage from '@/app/(dashboard)/products/page'
import { getProductsAction } from '@/app/(dashboard)/products/actions'
import {
    getAiCategoriesAction,
    getCategoriesAction,
} from '@/app/(dashboard)/products/categories/actions'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'

function renderPage() {
    return render(
        <I18nProvider>
            <TooltipProvider>
                <ProductsPage />
            </TooltipProvider>
        </I18nProvider>,
    )
}

function makeProduct(id: string, name: string) {
    return {
        id,
        name,
        slug: id,
        price: 10,
        currency: 'MYR',
        status: 'draft' as const,
        inventory: 1,
        createdAt: '2026-07-29T00:00:00.000Z',
    }
}

describe('ProductsPage — AI category preparation (GH-1588 Scope 02)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        bulkCreateProps.length = 0
        vi.mocked(getProductsAction).mockReset().mockResolvedValue([])
        vi.mocked(getCategoriesAction).mockReset().mockResolvedValue([])
        vi.mocked(getAiCategoriesAction).mockReset()
    })

    afterEach(() => {
        cleanup()
    })

    it('TC-F08-04-104: keeps a newer prompt when the submitted AI session completes', async () => {
        const aiCategories = [{ id: 'primary', name: 'Primary tenant category' }]
        let resolveCategories!: (value: typeof aiCategories) => void
        const categoryRequest = new Promise<typeof aiCategories>(resolve => {
            resolveCategories = resolve
        })
        vi.mocked(getProductsAction).mockResolvedValue([
            makeProduct('existing', 'Existing draft'),
        ] as unknown as Awaited<ReturnType<typeof getProductsAction>>)
        vi.mocked(getAiCategoriesAction).mockReturnValue(categoryRequest)
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())

        const prompt = screen.getByPlaceholderText(/Leather jacket/)
        fireEvent.change(prompt, { target: { value: 'prompt A' } })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        fireEvent.change(prompt, { target: { value: 'prompt B' } })

        expect(getAiCategoriesAction).toHaveBeenCalledOnce()
        expect(screen.queryByTestId('bulk-create-modal')).not.toBeInTheDocument()

        await act(async () => {
            resolveCategories(aiCategories)
            await categoryRequest
        })

        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())
        expect(bulkCreateProps.at(-1)).toMatchObject({
            categories: aiCategories,
            initialPrompt: 'prompt A',
        })
        expect(getCategoriesAction).toHaveBeenCalledOnce()

        act(() => {
            bulkCreateProps.at(-1)?.onSuccess()
        })

        await waitFor(() => expect(screen.getByPlaceholderText(/Leather jacket/)).toHaveValue('prompt B'))
        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(2))
        expect(screen.getByRole('tab', { name: /Draft/ })).toHaveAttribute('data-state', 'active')
        expect(getCategoriesAction).toHaveBeenCalledOnce()
    })

    it('[TC-F08-04-125] clears filters that could hide a verified AI Draft', async () => {
        // Arrange
        const excludedCategory = { id: 'excluded', name: 'Excluded category' }
        const visibleDraft = {
            ...makeProduct('visible-ai-draft', 'Visible AI draft'),
            inventory: 10,
            category: [],
        }
        vi.mocked(getCategoriesAction).mockResolvedValue([excludedCategory] as never)
        vi.mocked(getAiCategoriesAction).mockResolvedValue([excludedCategory])
        vi.mocked(getProductsAction)
            .mockResolvedValueOnce([
                makeProduct('existing', 'Existing draft'),
            ] as unknown as Awaited<ReturnType<typeof getProductsAction>>)
            .mockResolvedValueOnce([
                visibleDraft,
            ] as unknown as Awaited<ReturnType<typeof getProductsAction>>)
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        await waitFor(() => expect(screen.getAllByPlaceholderText(/search by name or sku/i).length).toBeGreaterThan(0))
        fireEvent.change(screen.getAllByPlaceholderText(/search by name or sku/i).at(-1)!, {
            target: { value: 'does-not-match-the-created-draft' },
        })

        const filterButtons = screen.getAllByRole('button', { name: /^Filter/i })
        fireEvent.click(filterButtons.at(-1)!)
        await waitFor(() => expect(screen.getByText('Excluded category')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Excluded category'))
        fireEvent.click(screen.getByText(/On sale/i))
        fireEvent.click(screen.getByText(/Show low or out of stock/i))
        expect(screen.getByText(/Active Filters/i)).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText(/Leather jacket/), {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())

        // Act
        act(() => {
            bulkCreateProps.at(-1)?.onSuccess()
        })

        // Assert
        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getAllByText('Visible AI draft').length).toBeGreaterThan(0))
        for (const searchInput of screen.getAllByPlaceholderText(/search by name or sku/i)) {
            expect(searchInput).toHaveValue('')
        }
        expect(screen.queryByText(/Active Filters/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/Advanced Filters/i)).not.toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /Draft/ })).toHaveAttribute('data-state', 'active')
    })

    it('TC-F08-04-104: does not open the modal when tenant categories cannot be loaded', async () => {
        vi.mocked(getAiCategoriesAction).mockRejectedValue(new Error('category load failed'))
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        fireEvent.change(screen.getByPlaceholderText(/Leather jacket/), {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))

        await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
        expect(screen.queryByTestId('bulk-create-modal')).not.toBeInTheDocument()
    })

    it('TC-F08-04-107: refreshes products in the background without unmounting the AI modal', async () => {
        let resolveRefresh!: (value: never[]) => void
        const refreshRequest = new Promise<never[]>(resolve => {
            resolveRefresh = resolve
        })
        vi.mocked(getAiCategoriesAction).mockResolvedValue([{ id: 123, name: 'Fashion' }])
        vi.mocked(getProductsAction)
            .mockResolvedValueOnce([
                makeProduct('existing', 'Existing draft'),
            ] as unknown as Awaited<ReturnType<typeof getProductsAction>>)
            .mockReturnValueOnce(refreshRequest)
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        fireEvent.change(screen.getByPlaceholderText(/Leather jacket/), {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())

        act(() => {
            bulkCreateProps.at(-1)?.onPartialSuccess?.()
        })

        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(2))
        expect(screen.getByRole('tab', { name: /Draft/ })).toHaveAttribute('data-state', 'active')
        expect(getCategoriesAction).toHaveBeenCalledOnce()
        expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument()

        await act(async () => {
            resolveRefresh([])
            await refreshRequest
        })
        expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument()
    })

    it('TC-F08-04-107: keeps the AI modal mounted when a background product refresh fails', async () => {
        vi.mocked(getAiCategoriesAction).mockResolvedValue([{ id: 123, name: 'Fashion' }])
        vi.mocked(getProductsAction)
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('refresh failed'))
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        fireEvent.change(await screen.findByPlaceholderText(/Leather jacket/), {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())

        act(() => {
            bulkCreateProps.at(-1)?.onPartialSuccess?.()
        })

        await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
        expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument()
    })

    it('TC-F08-04-107: preserves background mode when retrying a failed partial refresh', async () => {
        // Arrange
        type ProductsResult = Awaited<ReturnType<typeof getProductsAction>>
        let resolveRetry!: (value: ProductsResult) => void
        const retryRequest = new Promise<ProductsResult>(resolve => {
            resolveRetry = resolve
        })
        vi.mocked(getAiCategoriesAction).mockResolvedValue([{ id: 123, name: 'Fashion' }])
        vi.mocked(getProductsAction)
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('refresh failed'))
            .mockReturnValueOnce(retryRequest)
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        fireEvent.change(screen.getByPlaceholderText(/Leather jacket/), {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())
        act(() => {
            bulkCreateProps.at(-1)?.onPartialSuccess?.()
        })
        await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())

        // Act
        const retryOptions = vi.mocked(toast.error).mock.calls.at(-1)?.[1] as {
            action?: { onClick?: () => Promise<void> }
        }
        await act(async () => {
            void retryOptions.action?.onClick?.()
            await Promise.resolve()
        })

        // Assert — modal stays mounted while the retried request is still pending.
        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(3))
        expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument()

        await act(async () => {
            resolveRetry([] as unknown as ProductsResult)
            await retryRequest
        })
        expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument()
    })

    it('TC-F08-04-107: ignores a stale partial refresh that resolves after the final refresh', async () => {
        type ProductsResult = Awaited<ReturnType<typeof getProductsAction>>
        let resolvePartial!: (value: ProductsResult) => void
        const partialRequest = new Promise<ProductsResult>(resolve => {
            resolvePartial = resolve
        })
        let resolveFinal!: (value: ProductsResult) => void
        const finalRequest = new Promise<ProductsResult>(resolve => {
            resolveFinal = resolve
        })
        const staleResult = [makeProduct('stale', 'Stale snapshot')] as unknown as ProductsResult
        const freshResult = [makeProduct('fresh', 'Fresh product')] as unknown as ProductsResult

        vi.mocked(getAiCategoriesAction).mockResolvedValue([{ id: 123, name: 'Fashion' }])
        vi.mocked(getProductsAction)
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(partialRequest)
            .mockReturnValueOnce(finalRequest)
        renderPage()

        const prompt = await screen.findByPlaceholderText(/Leather jacket/)
        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        fireEvent.change(prompt, {
            target: { value: 'prompt A' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))
        await waitFor(() => expect(screen.getByTestId('bulk-create-modal')).toBeInTheDocument())
        const modalProps = bulkCreateProps.at(-1)

        act(() => {
            modalProps?.onPartialSuccess?.()
        })
        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(2))

        act(() => {
            modalProps?.onSuccess()
            modalProps?.onClose()
        })
        await waitFor(() => expect(getProductsAction).toHaveBeenCalledTimes(3))

        await act(async () => {
            resolveFinal(freshResult)
            await finalRequest
        })
        await waitFor(() => expect(screen.getAllByText('Fresh product').length).toBeGreaterThan(0))

        await act(async () => {
            resolvePartial(staleResult)
            await partialRequest
        })
        expect(screen.getAllByText('Fresh product').length).toBeGreaterThan(0)
        expect(screen.queryByText('Stale snapshot')).not.toBeInTheDocument()
    })

    it('TC-F08-04-106: blocks AI parsing and offers category management when no active category exists', async () => {
        vi.mocked(getAiCategoriesAction).mockResolvedValue([])
        renderPage()

        await waitFor(() => expect(getCategoriesAction).toHaveBeenCalledOnce())
        const prompt = screen.getByPlaceholderText(/Leather jacket/)
        fireEvent.change(prompt, { target: { value: 'prompt without categories' } })
        fireEvent.click(screen.getByRole('button', { name: 'Generate Drafts' }))

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
            'Create a category before generating AI drafts',
            expect.objectContaining({
                description: 'AI products need an existing category. Add one, then try again.',
                action: expect.objectContaining({ label: 'Manage Categories' }),
            }),
        ))
        expect(screen.queryByTestId('bulk-create-modal')).not.toBeInTheDocument()
        expect(prompt).toHaveValue('prompt without categories')
        expect(screen.getByRole('button', { name: 'Generate Drafts' })).toBeEnabled()

        const toastOptions = vi.mocked(toast.error).mock.calls.at(-1)?.[1] as {
            action?: { onClick: () => void }
        } | undefined
        toastOptions?.action?.onClick()
        expect(mockRouterPush).toHaveBeenCalledWith('/products/categories')
    })
})
