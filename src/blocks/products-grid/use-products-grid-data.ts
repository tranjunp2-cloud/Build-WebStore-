'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EMPTY_FILTER_BOUNDS, getActiveProductFilters, normalizeSidebarCategory } from './filter-utils'
import type { ActiveProductFilters, ProductFilterBounds, ProductItem, SidebarCategory } from './filter-types'

const CURRENCY_DISPLAY: Record<string, string> = { MYR: 'RM', USD: 'USD', SGD: 'SGD' }

interface UseProductsGridDataArgs {
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

export function useProductsGridData({ filtersEnabled, limit, siteId }: UseProductsGridDataArgs): UseProductsGridDataResult {
    const searchParams = useSearchParams()
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

    const activeFilters = useMemo(() => (
        filtersEnabled ? getActiveProductFilters(searchParams) : EMPTY_FILTERS
    ), [filtersEnabled, searchParams])
    const currentPage = useMemo(() => {
        const rawPage = Number(searchParams.get('page') || '1')
        return Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1
    }, [searchParams])

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
                if (currentPage > 1) params.set('page', String(currentPage))
                if (filtersEnabled) {
                    activeFilters.categoryIds.forEach((categoryId) => params.append('categoryId', categoryId))
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
    }, [activeFilters, currentPage, filtersEnabled, limit, siteId])

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
                setCategories(Array.isArray(json.docs) ? json.docs.map((doc: Record<string, unknown>) => normalizeSidebarCategory(doc)) : [])
            } catch (error) {
                if (!(error instanceof Error && error.name === 'AbortError')) {
                    console.error('[ProductsGridBlock] Failed to fetch categories:', error)
                }
            }
        }

        void loadCategories()
        return () => controller.abort()
    }, [filtersEnabled, siteId])

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
                const response = await fetch(`/api/storefront/products/bounds?site=${siteId}`, { signal: controller.signal })
                if (!response.ok) throw new Error(`Bounds request failed: ${response.status}`)

                const json = await response.json()
                setBounds({
                    minPrice: typeof json.minPrice === 'number' ? json.minPrice : 0,
                    maxPrice: typeof json.maxPrice === 'number' ? json.maxPrice : 0,
                    attributes: Array.isArray(json.attributes) ? json.attributes : [],
                })
            } catch (error) {
                if (!(error instanceof Error && error.name === 'AbortError')) {
                    console.error('[ProductsGridBlock] Failed to fetch filter bounds:', error)
                }
            } finally {
                setFiltersLoading(false)
            }
        }

        void loadBounds()
        return () => controller.abort()
    }, [filtersEnabled, siteId])

    return { activeFilters, bounds, categories, displayFilters, currentPage, totalPages, totalDocs, filtersLoading, loading, refreshing, products }
}
