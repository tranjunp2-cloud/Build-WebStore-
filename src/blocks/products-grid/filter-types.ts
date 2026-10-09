export interface ProductItem {
    id: string
    slug: string
    name: string
    price: string
    priceRaw: number
    currency: string
    inventory: number
    compareAtPrice?: number
    image: string | null
    imageAlt?: string
    shortDescription?: string
    category?: {
        id: string
        name: string
        slug: string
    } | null
}

export interface SidebarCategory {
    id: string
    name: string
    slug: string
    parent: string | null
    breadcrumbs?: string
}

export interface AttributeFilter {
    key: string
    values: string[]
}

export interface ProductFilterBounds {
    currency?: string
    categoryIds?: string[]
    minPrice: number
    maxPrice: number
    attributes: AttributeFilter[]
}

export interface ActiveProductFilters {
    categoryIds: string[]
    minPrice: string | null
    maxPrice: string | null
    search: string | null
    attributeFilters: Record<string, string[]>
    serializedAttributes: string
}
