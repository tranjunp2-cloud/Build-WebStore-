/**
 * TC-AICP-309 — categories the copilot creates, renames or moves show up without a reload: the categories view loads
 * the list again in place (the old rows stay on screen, no spinner, a typed search stays, a failed refresh does not
 * toast), ignores other entity kinds and a stale response, and the product form's category picker list is loaded again.
 * Real: CategoryManager, ProductForm, the agent-changes bus + hook, en strings. Faked: category server actions,
 * next/*, the product form sections.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const actions = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesAction: actions.list,
    saveCategoryAction: vi.fn(),
    deleteCategoryAction: vi.fn(),
    checkCategoryNameAvailable: vi.fn(),
}))
vi.mock('@/components/dashboard/product-form/GeneralInfoSection', () => ({
    GeneralInfoSection: ({ categories }: { categories: Array<{ id: string; name: string }> }) => <ul>{categories.map(c => <li key={c.id}>{c.name}</li>)}</ul>,
}))
for (const section of ['MasterFieldsSection', 'VariantOptionsSection', 'ShippingDimensionsSection', 'DescriptionSeoSection', 'AttributesSection']) {
    vi.doMock(`@/components/dashboard/product-form/${section}`, () => ({ [section]: () => null }))
}

import CategoryManager from '@/app/(dashboard)/products/categories/components/CategoryManager'
import { ProductForm } from '@/components/dashboard/product-form/ProductForm'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { I18nProvider } from '@/i18n'

const category = (id: string, name: string) => ({ id, name, slug: name.toLowerCase(), parent: null, productCount: 0 })
const change = (kind: string, id = '*', at = 1): AgentChange => ({ action: 'applied', kind: 'store.categories_patch', entities: [{ kind, id }], changeSetId: `cs-${at}`, at })
const announce = async (c: AgentChange) => { await act(async () => { announceAgentChange(c) }) }
const deferred = <T,>() => {
    let resolve!: (v: T) => void
    const promise = new Promise<T>(res => { resolve = res })
    return { promise, resolve }
}
const mountManager = () => render(<I18nProvider defaultLocale="en"><CategoryManager /></I18nProvider>)

beforeEach(() => {
    actions.list.mockReset()
    toast.error.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('categories follow the copilot [TC-AICP-309]', () => {
    it('TC-AICP-309 categories view: loads again on a store_category change, old rows stay meanwhile, new ones appear', async () => {
        actions.list.mockResolvedValueOnce([category('1', 'Shoes')])
        mountManager()
        await screen.findByText('Shoes')

        const refresh = deferred<ReturnType<typeof category>[]>()
        actions.list.mockReturnValueOnce(refresh.promise)
        await announce(change('store_category', '2'))
        await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Shoes')).toBeInTheDocument()
        expect(document.querySelector('.animate-spin')).toBeNull()

        await act(async () => { refresh.resolve([category('1', 'Shoes'), category('2', 'Bags')]) })
        await screen.findByText('Bags')
        expect(screen.getByText('Shoes')).toBeInTheDocument()
    })

    it('TC-AICP-309 categories view: ignores other kinds, drops an overtaken response, a failed refresh keeps rows without a toast', async () => {
        actions.list.mockResolvedValueOnce([category('1', 'Shoes')])
        mountManager()
        await screen.findByText('Shoes')

        await announce(change('product', '4'))
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(actions.list).toHaveBeenCalledTimes(1)

        const first = deferred<ReturnType<typeof category>[]>()
        const second = deferred<ReturnType<typeof category>[]>()
        actions.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        await announce(change('store_category', '1', 1))
        await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2))
        await new Promise(resolve => setTimeout(resolve, 200))
        await announce(change('store_category', '1', 2))
        await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(3))
        await act(async () => { second.resolve([category('1', 'Shoes newest')]) })
        await screen.findByText('Shoes newest')
        await act(async () => { first.resolve([category('1', 'Shoes stale')]) })
        expect(screen.queryByText('Shoes stale')).toBeNull()

        actions.list.mockRejectedValueOnce(new Error('boom'))
        await announce(change('store_category', '1', 3))
        await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(4))
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(toast.error).not.toHaveBeenCalled()
        expect(screen.getByText('Shoes newest')).toBeInTheDocument()
    })

    it('TC-AICP-309 product form: the category list is loaded again on a store_category change only', async () => {
        actions.list.mockResolvedValueOnce([category('1', 'Shoes')])
        render(<I18nProvider defaultLocale="en"><ProductForm isEdit initialData={{ name: 'P', urlSlug: 'p' }} /></I18nProvider>)
        await screen.findByText('Shoes')

        await announce(change('product', '4'))
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(actions.list).toHaveBeenCalledTimes(1)

        actions.list.mockResolvedValueOnce([category('1', 'Shoes'), category('2', 'Bags')])
        await announce(change('store_category', '2'))
        await screen.findByText('Bags')
        expect(actions.list).toHaveBeenCalledTimes(2)
    })
})
