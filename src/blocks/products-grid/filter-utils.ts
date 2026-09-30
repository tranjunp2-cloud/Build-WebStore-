import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { ActiveProductFilters, ProductFilterBounds, SidebarCategory } from './filter-types'

export const EMPTY_FILTER_BOUNDS: ProductFilterBounds = {
    minPrice: 0,
    maxPrice: 0,
    attributes: [],
}

export function serializeAttributeFilters(attributeFilters: Record<string, string[]>): string {
    return Object.entries(attributeFilters)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => `${key}:${values.slice().sort().join(',')}`)
        .join('|')
}

export function getActiveProductFilters(searchParams: Pick<ReadonlyURLSearchParams, 'forEach' | 'getAll' | 'get'>): ActiveProductFilters {
    const attributeFilters: Record<string, string[]> = {}

    searchParams.forEach((_value, key) => {
        if (!key.startsWith('attr_') || key.length <= 5) return

        const attrKey = key.slice(5).trim()
        const values = searchParams.getAll(key).map((value) => value.trim()).filter(Boolean)
        if (attrKey && values.length > 0) {
            attributeFilters[attrKey] = values
        }
    })

    const categoryIds = Array.from(new Set(
        searchParams
            .getAll('categoryId')
            .map((value) => value.trim())
            .filter(Boolean),
    ))
    const search = searchParams.get('search')?.trim() || null

    return {
        categoryIds,
        minPrice: searchParams.get('minPrice'),
        maxPrice: searchParams.get('maxPrice'),
        search,
        attributeFilters,
        serializedAttributes: serializeAttributeFilters(attributeFilters),
    }
}

export function normalizeSidebarCategory(doc: Record<string, unknown>): SidebarCategory {
    const parentRaw = doc.parent as string | number | { id?: string | number } | null | undefined
    const parentId = typeof parentRaw === 'object' && parentRaw !== null ? parentRaw.id : parentRaw

    return {
        id: String(doc.id),
        name: String(doc.name ?? ''),
        slug: String(doc.slug ?? ''),
        parent: parentId ? String(parentId) : null,
        breadcrumbs: typeof doc.breadcrumbs === 'string' ? doc.breadcrumbs : undefined,
    }
}

export function hasFilterFacets(categories: SidebarCategory[], bounds: ProductFilterBounds): boolean {
    return categories.length > 0 || bounds.attributes.length > 0 || bounds.maxPrice > bounds.minPrice
}

export function hasActiveProductFilters(activeFilters: ActiveProductFilters): boolean {
    return Boolean(
        activeFilters.categoryIds.length > 0
        || activeFilters.minPrice
        || activeFilters.maxPrice
        || activeFilters.search
        || activeFilters.serializedAttributes
    )
}
