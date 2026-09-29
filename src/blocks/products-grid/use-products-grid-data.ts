'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EMPTY_FILTER_BOUNDS, getActiveProductFilters, normalizeSidebarCategory } from './filter-utils'
import type { ActiveProductFilters, ProductFilterBounds, ProductItem, SidebarCategory } from './filter-types'

const CURRENCY_DISPLAY: Record<string, string> = { MYR: 'RM', USD: 'USD', SGD: 'SGD' }

interface UseProductsGridDataArgs {
    localFilters?: string
    localPage?: number
    selectionMode?: 'all' | 'fixed' | 'random'
    selectedProductIds?: string[]
    includeOutOfStock?: boolean
    category?: string
    filtersEnabled: boolean
    limit: number
    siteId: string | null
}

interface UseProductsGridDataResult {
    activeFilters: ActiveProductFilters
    bounds: ProductFilterBounds
    categories: SidebarCategory[]
    displayFilters: ActiveProductFilters
    currentPage: number
    totalPages: number
    totalDocs: number
    filtersLoading: boolean
    loading: boolean
    refreshing: boolean
    products: ProductItem[]
}

const EMPTY_FILTERS: ActiveProductFilters = {
    categoryIds: [],
    minPrice: null,
    maxPrice: null,
    search: null,
    attributeFilters: {},
    serializedAttributes: '',
}

export function useProductsGridData({ filtersEnabled, limit, siteId, localFilters = '', localPage = 1, category: configuredCategory, selectionMode = 'all', selectedProductIds, includeOutOfStock = true }: UseProductsGridDataArgs): UseProductsGridDataResult {
    const category = selectionMode === 'random' ? configuredCategory : undefined
    const searchParams = useSearchParams()
    // Depend on filter values, not the router object's identity or unrelated blog/view params.
    const productQuery = new URLSearchParams()
    searchParams.forEach((value, key) => {
        if (['categoryId', 'minPrice', 'maxPrice', 'search'].includes(key) || key.startsWith('attr_')) productQuery.append(key, value)
    })
    const productFilterQuery = productQuery.toString()
    const pageQuery = searchParams.get('page')
    const [randomSeed] = useState(() => Math.random().toString(36).slice(2))
    const selectedIdsKey = JSON.stringify(selectedProductIds ?? [])
    const [products, setProducts] = useState<ProductItem[]>([])
    const [categories, setCategories] = useState<SidebarCategory[]>([])
    const [bounds, setBounds] = useState<ProductFilterBounds>(EMPTY_FILTER_BOUNDS)
    const [displayFilters, setDisplayFilters] = useState<ActiveProductFilters>(EMPTY_FILTERS)
    const [totalPages, setTotalPages] = useState(1)
    const [totalDocs, setTotalDocs] = useState(0)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filtersLoading, setFiltersLoading] = useState(filtersEnabled)
    const hasResolvedInitialProductsLoadRef = useRef(false)

    const activeFilters = useMemo(() => {
        const filters = selectionMode === 'all' ? getActiveProductFilters(new URLSearchParams(productFilterQuery)) : filtersEnabled ? getActiveProductFilters(new URLSearchParams(localFilters)) : EMPTY_FILTERS
        return filters
    }, [selectionMode, productFilterQuery, localFilters, filtersEnabled])
    const currentPage = useMemo(() => {
        if (selectionMode !== 'all') return localPage
        const rawPage = Number(pageQuery || '1')
        return Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1
    }, [pageQuery, selectionMode, localPage])

    useEffect(() => {
        if (!siteId) {
            setDisplayFilters(EMPTY_FILTERS)
            setLoading(false)
            setRefreshing(false)
            return
        }

        const controller = new AbortController()
        if (hasResolvedInitialProductsLoadRef.current) setRefreshing(true)
        else setLoading(true)

        const loadProducts = async () => {
            let didLoadProducts = false

            try {
                const params = new URLSearchParams({ site: siteId, limit: String(limit), sort: '-createdAt' })
                if (category) params.set('fixedCategoryId', category)
                if (selectionMode !== 'all') params.set('selectionMode', selectionMode)
                if (!includeOutOfStock) params.set('includeOutOfStock', 'false')
                if (selectionMode === 'random') params.set('seed', randomSeed)
                if (selectionMode === 'fixed') (JSON.parse(selectedIdsKey) as string[]).forEach(id => params.append('productId', id))
                if (currentPage > 1) params.set('page', String(currentPage))
                activeFilters.categoryIds.forEach((categoryId) => params.append('categoryId', categoryId))
                if (selectionMode === 'all' || filtersEnabled) {
                    if (activeFilters.minPrice) params.set('minPrice', activeFilters.minPrice)
                    if (activeFilters.maxPrice) params.set('maxPrice', activeFilters.maxPrice)
                    if (activeFilters.search) params.set('search', activeFilters.search)
                    Object.entries(activeFilters.attributeFilters).forEach(([key, values]) => {
                        values.forEach((value) => params.append(`attr_${key}`, value))
                    })
                }

                const response = await fetch(`/api/storefront/products?${params.toString()}`, { signal: controller.signal })
                if (!response.ok) throw new Error(`Products request failed: ${response.status}`)

                const json = await response.json()
                if (controller.signal.aborted) return
                const docs = Array.isArray(json.docs) ? json.docs : []
                setTotalPages(typeof json.totalPages === 'number' && json.totalPages > 0 ? json.totalPages : 1)
                setTotalDocs(typeof json.totalDocs === 'number' && json.totalDocs >= 0 ? json.totalDocs : docs.length)
                setProducts(docs.map((doc: Record<string, unknown>) => {
                    const images = doc.images as Array<{ image?: { url?: string }; alt?: string }> | undefined
                    const category = doc.category as { id?: string | number; name?: string; slug?: string } | null | undefined
                    const currencyCode = typeof doc.currency === 'string' ? doc.currency : 'MYR'
                    const currency = CURRENCY_DISPLAY[currencyCode] ?? currencyCode
                    const price = typeof doc.price === 'number' ? doc.price : parseFloat(String(doc.price)) || 0

                    return {
                        id: String(doc.id),
                        slug: String(doc.slug || ''),
                        name: String(doc.name || ''),
                        price: `${currency} ${price.toFixed(2)}`,
                        priceRaw: price,
                        currency: currencyCode,
                        inventory: Number(doc.inventory) || 0,
                        compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : undefined,
                        image: images?.[0]?.image?.url ?? null,
                        imageAlt: images?.[0]?.alt,
                        shortDescription: typeof doc.shortDescription === 'string' ? doc.shortDescription : undefined,
                        category: category && typeof category === 'object'
                            ? {
                                id: String(category.id ?? ''),
                                name: String(category.name ?? ''),
                                slug: String(category.slug ?? ''),
                            }
                            : null,
                    }
                }))
                didLoadProducts = true
            } catch (error) {
                if (!(error instanceof Error && error.name === 'AbortError')) {
                    console.error('[ProductsGridBlock] Failed to fetch products:', error)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                    setRefreshing(false)
                    if (didLoadProducts) {
                        setDisplayFilters(activeFilters)
                        hasResolvedInitialProductsLoadRef.current = true
                    }
                }
            }
        }

        void loadProducts()
        return () => controller.abort()
    }, [activeFilters, currentPage, filtersEnabled, limit, siteId, selectionMode, selectedIdsKey, includeOutOfStock, randomSeed, category])

    useEffect(() => {
        if (!filtersEnabled || !siteId) {
            setCategories([])
            return
        }

        const controller = new AbortController()

        const loadCategories = async () => {
            try {
                const response = await fetch(`/api/storefront/categories?site=${siteId}`, { signal: controller.signal })
                if (!response.ok) throw new Error(`Categories request failed: ${response.status}`)

                const json = await response.json()
                if (controller.signal.aborted) return
                const all: SidebarCategory[] = Array.isArray(json.docs) ? json.docs.map((doc: Record<string, unknown>) => normalizeSidebarCategory(doc)) : []
                const descendants = new Set(category ? [category] : [])
                if (category) {
                    let changed = true
                    while (changed) {
                        changed = false
                        for (const item of all) if (item.parent && descendants.has(item.parent) && !descendants.has(item.id)) { descendants.add(item.id); changed = true }
                    }
                }
                setCategories(category ? all.filter(item => item.id !== category && descendants.has(item.id)).map(item => ({ ...item, parent: item.parent === category ? null : item.parent })) : all)
            } catch (error) {
                if (!(error instanceof Error && error.name === 'AbortError')) {
                    console.error('[ProductsGridBlock] Failed to fetch categories:', error)
                }
            }
        }

        void loadCategories()
        return () => controller.abort()
    }, [filtersEnabled, siteId, category])

    useEffect(() => {
        if (!filtersEnabled || !siteId) {
            setBounds(EMPTY_FILTER_BOUNDS)
            setFiltersLoading(false)
            return
        }

        const controller = new AbortController()
        setFiltersLoading(true)

        const loadBounds = async () => {
            try {
                const params = new URLSearchParams({ site: siteId, selectionMode, includeOutOfStock: String(includeOutOfStock) })
                if (category) params.set('fixedCategoryId', category)
                if (selectionMode === 'fixed') (JSON.parse(selectedIdsKey) as string[]).forEach(id => params.append('productId', id))
                const response = await fetch(`/api/storefront/products/bounds?${params}`, { signal: controller.signal })
                if (!response.ok) throw new Error(`Bounds request failed: ${response.status}`)

                const json = await response.json()
                if (controller.signal.aborted) return
                setBounds({
                    categoryIds: Array.isArray(json.categoryIds) ? json.categoryIds.map(String) : [],
                    currency: typeof json.currency === 'string' ? json.currency : undefined,
                    minPrice: typeof json.minPrice === 'number' ? json.minPrice : 0,
                    maxPrice: typeof json.maxPrice === 'number' ? json.maxPrice : 0,
                    attributes: Array.isArray(json.attributes) ? json.attributes : [],
                })
            } catch (error) {
                if (!(error instanceof Error && error.name === 'AbortError')) {
                    console.error('[ProductsGridBlock] Failed to fetch filter bounds:', error)
                }
            } finally {
                if (!controller.signal.aborted) setFiltersLoading(false)
            }
        }

        void loadBounds()
        return () => controller.abort()
    }, [filtersEnabled, siteId, category, selectionMode, selectedIdsKey, includeOutOfStock])

    const scopedCategories = useMemo(() => {
        if (selectionMode === 'all') return categories
        const eligible = new Set(bounds.categoryIds ?? [])
        if (selectionMode === 'fixed' && eligible.size <= 1) return []
        // Keep ancestors of eligible categories so the category tree stays navigable.
        const lookup = new Map(categories.map(item => [item.id, item]))
        for (const id of [...eligible]) {
            let parent = lookup.get(id)?.parent
            const visited = new Set<string>()
            while (parent && !visited.has(parent)) { visited.add(parent); eligible.add(parent); parent = lookup.get(parent)?.parent }
        }
        return categories.filter(item => eligible.has(item.id))
    }, [categories, bounds.categoryIds, selectionMode])
    return { activeFilters, bounds, categories: scopedCategories, displayFilters, currentPage, totalPages, totalDocs, filtersLoading, loading, refreshing, products }
}
