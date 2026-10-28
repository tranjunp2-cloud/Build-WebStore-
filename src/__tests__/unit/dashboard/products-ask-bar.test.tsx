/**
 * TC-AIREL-187/188/189 — the products page's way into the copilot: the ask bar hands the request to the mascot
 * (event the dock listens to) with no Product Master / "source of truth" talk; on a deployment with the copilot
 * the bar replaces the inline bulk-create prompt, without it the inline prompt stays; the page decides on the
 * server and the products route still renders the staging list.
 * Real: ProductStoreAskBar, ProductsPageClient (+ page.tsx), the en.json strings. Faked: server actions, bulk modal.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('next/image', () => ({ default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} /> }))
vi.mock('react-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-dom')>()), createPortal: (node: React.ReactNode) => node }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/use-auto-resize-textarea', () => ({ useAutoResizeTextarea: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => ({
    getProductsPageAction: vi.fn(async () => ({ ids: [], docs: [], total: 0, counts: { all: 0, active: 0, draft: 0, archived: 0 }, page: 1, pageCount: 1 })),
    updateProductFieldAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: vi.fn(async () => []), getAiCategoriesAction: vi.fn() }))
vi.mock('@/components/dashboard/BulkCreateModal', () => ({ BulkCreateModal: () => <div data-testid="bulk-create-modal" /> }))
const flag = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: () => flag.on }))

import ProductsPage from '@/app/(dashboard)/products/page'
import { ProductStoreAskBar } from '@/components/dashboard/ProductStoreAskBar'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'

const wrap = (node: React.ReactNode) => render(<I18nProvider><TooltipProvider>{node}</TooltipProvider></I18nProvider>)

let opened: Array<{ prompt?: string }> = []
const onOpen = (e: Event) => opened.push((e as CustomEvent).detail)

beforeEach(() => {
    opened = []
    flag.on = false
    window.addEventListener('ech-agent:open', onOpen)
})
afterEach(() => {
    window.removeEventListener('ech-agent:open', onOpen)
    cleanup()
})

describe('ProductStoreAskBar [TC-AIREL-187]', () => {
    it('hands the typed request to the mascot and clears the field once it was picked up', async () => {
        wrap(<ProductStoreAskBar />)

        const input = screen.getByLabelText('Describe products to add')
        fireEvent.change(input, { target: { value: '3 summer dresses, RM 120 each' } })
        fireEvent.submit(input.closest('form')!)

        expect(opened).toEqual([expect.objectContaining({ prompt: '3 summer dresses, RM 120 each' })])
        expect(input).toHaveValue('')
        await act(async () => {
            window.dispatchEvent(new CustomEvent('ech-agent:picked'))
        })
    })

    it('does not send an empty request', () => {
        wrap(<ProductStoreAskBar />)

        fireEvent.submit(screen.getByLabelText('Describe products to add').closest('form')!)

        expect(opened).toEqual([])
        expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
    })

    it('offers photos and an example, and speaks of no Product Master or source of truth', () => {
        const { container } = wrap(<ProductStoreAskBar />)

        fireEvent.click(screen.getByRole('button', { name: /From photos/ }))
        expect(opened).toEqual([expect.objectContaining({ prompt: 'Create a product from the photos I attach.' })])
        fireEvent.click(screen.getByRole('button', { name: /3 summer dresses/ }))
        expect(screen.getByLabelText('Describe products to add')).toHaveValue('3 summer dresses, RM 120 each, sizes S–L')
        expect(container.textContent).not.toMatch(/Product Master|source of truth|SSOT/i)
        expect(container.textContent).toMatch(/nothing goes on sale until you approve/)
    })
})

describe('products page gate [TC-AIREL-188/189]', () => {
    it('with the copilot: the ask bar, not the inline bulk-create prompt [TC-AIREL-188]', async () => {
        flag.on = true
        wrap(<ProductsPage />)

        expect(await screen.findByLabelText('Describe products to add')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Generate Drafts' })).not.toBeInTheDocument()
    })

    it('without the copilot: the staging inline prompt stays [TC-AIREL-189]', async () => {
        flag.on = false
        wrap(<ProductsPage />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Generate Drafts' })).toBeInTheDocument())
        expect(screen.queryByLabelText('Describe products to add')).not.toBeInTheDocument()
    })
})
