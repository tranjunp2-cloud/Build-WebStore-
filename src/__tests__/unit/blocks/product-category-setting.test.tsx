import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('categoryId=999') }))
import { ProductCategorySetting } from '@/components/editor/ProductCategorySetting'
import { useProductsGridData } from '@/blocks/products-grid/use-products-grid-data'
// Radix Select uses browser APIs absent in jsdom.
HTMLElement.prototype.scrollIntoView = vi.fn()
HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('[TC-F35.M58] loads site categories and changes selected category', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [{ id: 12, name: 'Mixer' }] }) })
    vi.stubGlobal('fetch', fetcher)
    const change = vi.fn()
    render(<ProductCategorySetting siteId="1066" value="" locale="en" onChange={change} />)
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled())
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('option', { name: 'Mixer' }))
    expect(fetcher.mock.calls[0][0]).toBe('/api/storefront/categories?site=1066')
    expect(change).toHaveBeenCalledWith('12')
})
it.each([true, false])('[TC-F35.M58] pins category with sidebar=%s', async filtersEnabled => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [], totalPages: 1 }) })
    vi.stubGlobal('fetch', fetcher)
    renderHook(() => useProductsGridData({ siteId: '1066', category: '8384', selectionMode: 'random', limit: 3, filtersEnabled }))
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.get('fixedCategoryId')).toBe('8384')
    expect(url.searchParams.getAll('categoryId')).toEqual([])
    expect(url.searchParams.get('site')).toBe('1066')
})

import React, { useState } from 'react'
import { ProductListingSettings } from '@/components/editor/ProductListingSettings'
it('[TC-F35.M59] selects and reorders products in block settings', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ docs: url.includes('/categories?') ? [] : [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }] }) })))
    const changes = vi.fn()
    function Harness() {
        const [block, setBlock] = useState<Record<string, unknown>>({ selectionMode: 'fixed', selectedProductIds: [] })
        return <ProductListingSettings siteId="1" block={block} locale="en" onChange={(field, value) => { changes(field, value); setBlock(previous => ({ ...previous, [field]: value })) }} />
    }
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: '+ One' }))
    fireEvent.click(await screen.findByRole('button', { name: '+ Two' }))
    expect(screen.getByRole('button', { name: 'Drag to reorder Two' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Move up Two' })).not.toBeInTheDocument()
    expect(changes).toHaveBeenLastCalledWith('selectedProductIds', ['1', '2'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show out-of-stock products' }))
    expect(changes).toHaveBeenLastCalledWith('includeOutOfStock', false)
})

it('[TC-F35.M58] exposes only child categories and never marks the block category as a customer filter', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ docs: url.includes('/categories?') ? [
        { id: 10, name: 'Parent' }, { id: 11, name: 'Child', parent: 10 },
        { id: 12, name: 'Grandchild', parent: 11 }, { id: 20, name: 'Other' },
    ] : [], categoryIds: ['12'], totalPages: 1 }) })))
    const { result, rerender } = renderHook(({ category }) => useProductsGridData({ siteId: '1', category, selectionMode: 'random', limit: 12, filtersEnabled: true }), { initialProps: { category: '10' } })
    await waitFor(() => expect(result.current.categories.map(item => item.id)).toEqual(['11', '12']))
    expect(result.current.categories[0].parent).toBeNull()
    expect(result.current.activeFilters.categoryIds).not.toContain('10')
    expect(result.current.displayFilters.categoryIds).not.toContain('10')
    rerender({ category: '12' })
    await waitFor(() => expect(result.current.categories).toEqual([]))
})

it.each(['fixed', 'random'] as const)('[TC-F35.M59] %s ignores URL category and uses local pagination', async selectionMode => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [], totalPages: 3 }) })
    vi.stubGlobal('fetch', fetcher)
    const { result } = renderHook(() => useProductsGridData({ siteId: '1', category: '10', selectionMode, selectedProductIds: ['1'], localPage: 2, limit: 6, filtersEnabled: false }))
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.get('categoryId')).toBeNull()
    expect(url.searchParams.get('fixedCategoryId')).toBe(selectionMode === 'random' ? '10' : null)
    expect(url.searchParams.get('page')).toBe('2')
    expect(result.current.activeFilters.categoryIds).toEqual([])
})

it.each(['fixed', 'random'] as const)('[TC-F35.M59] %s applies local filters without URL leakage', async selectionMode => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [], totalPages: 1, categoryIds: [] }) })
    vi.stubGlobal('fetch', fetcher)
    const { result } = renderHook(() => useProductsGridData({ siteId: '1', selectionMode, category: '10', selectedProductIds: ['1'], localFilters: 'categoryId=12&search=mixer&minPrice=20', limit: 6, filtersEnabled: true }))
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    const request = fetcher.mock.calls.find(([url]) => url.includes('/products?'))!
    const url = new URL(request[0], 'http://localhost')
    expect(url.searchParams.getAll('categoryId')).toEqual(['12'])
    expect(url.searchParams.get('search')).toBe('mixer')
    expect(url.searchParams.get('minPrice')).toBe('20')
    expect(url.searchParams.get('fixedCategoryId')).toBe(selectionMode === 'random' ? '10' : null)
    expect(result.current.activeFilters.categoryIds).toEqual(['12'])
})

it('[TC-F35.M60] changes a filter criterion without losing the other migrated criteria', () => {
    const change = vi.fn()
    render(<ProductListingSettings siteId="1" locale="en" block={{ selectionMode: 'all', showCategoryFilter: true, filterControls: { category: true, price: false, search: false, attributes: false } }} onChange={change} />)
    expect(screen.getByRole('checkbox', { name: 'Categories', exact: true })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Price', exact: true }))
    expect(change).toHaveBeenCalledWith('filterControls', { category: true, price: true, search: false, attributes: false })
})
