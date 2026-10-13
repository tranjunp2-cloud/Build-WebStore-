'use client'

import type React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/i18n'
import { handleCartClick, isInEditorPreview } from '@/lib/storefront/editor-intercept'
import type { ActiveProductFilters, ProductFilterBounds, SidebarCategory } from './filter-types'
import { AttributeFilters } from './filters/AttributeFilters'
import { CategoryTree } from './filters/CategoryTree'
import { PriceRangeFilter } from './filters/PriceRangeFilter'
import { SearchFilter } from './filters/SearchFilter'

interface ProductFilterSidebarProps {
    controls?: { category: boolean; price: boolean; search: boolean; attributes: boolean }
    localSearchParams?: string
    onLocalFilterChange?: (params: URLSearchParams) => void
    pricePrefix?: string
    categories: SidebarCategory[]
    bounds: ProductFilterBounds
    activeFilters: ActiveProductFilters
    primaryColor: string
}

export function ProductFilterSidebar({ controls, categories, bounds, activeFilters, primaryColor, pricePrefix, localSearchParams, onLocalFilterChange }: ProductFilterSidebarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { t } = useI18n()
    const previewMode = isInEditorPreview()
    const productText = t.storefront.products as Record<string, string | undefined>

    const updateFilter = (params: URLSearchParams, event?: React.SyntheticEvent<HTMLElement>) => {
        params.delete('page')

        if (previewMode && event) {
            handleCartClick(event as unknown as React.MouseEvent)
            return
        }

        if (onLocalFilterChange) { onLocalFilterChange(params); return }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <aside className="sticky top-6 space-y-10">
            {controls?.category !== false && categories.length > 0 && (
                <CategoryTree
                    categories={categories}
                    activeCategoryIds={activeFilters.categoryIds}
                    onUpdateFilter={updateFilter}
                    primaryColor={primaryColor}
                    searchParams={localSearchParams ?? searchParams.toString()}
                    title={t.storefront.products.categoriesHeading}
                />
            )}

            {controls?.price !== false && bounds.maxPrice > bounds.minPrice && (
                <PriceRangeFilter
                    pricePrefix={pricePrefix}
                    activeMinPrice={activeFilters.minPrice}
                    activeMaxPrice={activeFilters.maxPrice}
                    bounds={bounds}
                    onUpdateFilter={updateFilter}
                    primaryColor={primaryColor}
                    searchParams={localSearchParams ?? searchParams.toString()}
                    title={t.storefront.products.priceHeading}
                    minLabel={t.storefront.products.priceMin}
                    maxLabel={t.storefront.products.priceMax}
                />
            )}

            {controls?.search !== false && <SearchFilter
                activeSearch={activeFilters.search}
                onUpdateFilter={updateFilter}
                primaryColor={primaryColor}
                searchParams={localSearchParams ?? searchParams.toString()}
                title={productText.searchHeading || 'Search Products'}
                placeholder={productText.searchPlaceholder || 'Search your keyword...'}
                submitAriaLabel={productText.searchButtonLabel || 'Search products'}
            />}

            {controls?.attributes !== false && bounds.attributes.length > 0 && (
                <AttributeFilters
                    attributes={bounds.attributes}
                    attributeFilters={activeFilters.attributeFilters}
                    onUpdateFilter={updateFilter}
                    primaryColor={primaryColor}
                    searchParams={localSearchParams ?? searchParams.toString()}
                    title={t.storefront.products.attributesHeading}
                />
            )}
        </aside>
    )
}
