'use client'

import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { BlockProps } from '../types'
import type { ProductsGridConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import { SectionLabel, GradientBlob } from '../shared/decorative'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { useI18n } from '@/i18n'
import { handleCartClick, isInEditorPreview } from '@/lib/storefront/editor-intercept'
import { ProductCard } from './ProductCard'
import { ProductFilterSidebar } from './ProductFilterSidebar'
import { MobileFilterDrawer } from './MobileFilterDrawer'
import { ProductsPagination } from './ProductsPagination'
import { hasActiveProductFilters } from './filter-utils'
import { useProductsGridData } from './use-products-grid-data'

type GridNavigationIntent = 'filter' | 'pagination' | 'view'

function formatPriceChipLabel(minPrice: string | null, maxPrice: string | null, fallbackMin: number, fallbackMax: number, heading: string, prefix: string) {
    const resolvedMin = minPrice ?? String(Math.floor(fallbackMin))
    const resolvedMax = maxPrice ?? String(Math.max(Math.ceil(fallbackMax), Math.floor(fallbackMin) + 1))
    return `${heading}: ${prefix}${resolvedMin} - ${prefix}${resolvedMax}`
}

export function ProductsGridBlock({ block, theme, site }: BlockProps<ProductsGridConfig>) {
    const { headline = 'Featured Products', subheadline } = block
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { t } = useI18n()
    const previewMode = isInEditorPreview()
    const productText = t.storefront.products as Record<string, string | undefined>
    const selectionMode = block.selectionMode ?? 'all'
    const filtersEnabled = block.showCategoryFilter === true
    const [localFilters, setLocalFilters] = useState('')
    const [localPage, setLocalPage] = useState(1)
    const [localView, setLocalView] = useState('grid-3')
    const productsPerPage = block.limit ?? 6
    const siteId = site?.id ? String(site.id) : null
    const resultsTopRef = useRef<HTMLDivElement>(null)
    // Pagination reposition lifecycle (TC-F09.257): idle -> requested -> observed (request busy) -> settled.
    const repositionRef = useRef<'idle' | 'requested' | 'observed'>('idle')
    const repositionTargetRef = useRef(1)
    const { bounds, categories, currentPage, displayFilters, filtersLoading, loading, refreshing, products, totalPages } = useProductsGridData({
        filtersEnabled,
        localPage,
        localFilters,
        category: block.category,
        selectionMode: block.selectionMode,
        selectedProductIds: block.selectedProductIds,
        includeOutOfStock: block.includeOutOfStock,
        limit: productsPerPage,
        siteId,
    })
    const resultsBusy = loading || refreshing
    const scrollToResultsTop = () => resultsTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    useEffect(() => {
        if (repositionRef.current === 'requested' && resultsBusy) {
            // Busy cycle for a different page = unrelated refresh (filter/search); disarm so it never scrolls.
            repositionRef.current = currentPage === repositionTargetRef.current ? 'observed' : 'idle'
        } else if (repositionRef.current === 'observed' && !resultsBusy) {
            // Shorter result set can shift the anchor; reposition once more after it settles.
            repositionRef.current = 'idle'
            scrollToResultsTop()
        }
    }, [resultsBusy, currentPage])
    useEffect(() => setLocalPage(1), [selectionMode, block.category, block.selectedProductIds, productsPerPage])
    const requestedView = selectionMode === 'all' ? searchParams.get('view') : localView
    const viewMode: ProductsGridConfig['variant'] = requestedView === 'list' ? 'list' : 'grid-3'
    const cardVariant = viewMode
    const hasActiveFilters = hasActiveProductFilters(displayFilters) || (selectionMode === 'all' && searchParams.getAll('categoryId').includes('0'))

    const showSidebar = filtersEnabled
    const showViewToggle = !loading && products.length > 0
    const showMobileFilterButton = showSidebar && !filtersLoading

    const gridCols = {
        'grid-3': 'grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-8',
        'grid-4': 'grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6',
        'list': 'grid-cols-1 max-w-5xl mx-auto gap-4 lg:gap-8',
    }[cardVariant] || 'grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-8'

    const siteRec = site as Record<string, unknown>
    const siteBasePath = typeof siteRec?.siteBasePath === 'string'
        ? (siteRec.siteBasePath as string)
        : (siteRec?.tenantSlug ? `/sites/${String(siteRec.tenantSlug)}` : '')
    const categoryLookup = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
    const pricePrefix = useMemo(() => {
        const currency = bounds.currency || products[0]?.currency
        if (currency === 'MYR') return 'RM '
        if (currency === 'SGD') return 'S$ '
        if (currency === 'USD') return '$ '
        return currency ? `${currency} ` : ''
    }, [products, bounds.currency])
    const gridAnimationSeed = useMemo(() => (
        products.map((product) => `${product.id}:${product.slug}`).join('|') || `empty-${currentPage}-${viewMode}`
    ), [currentPage, products, viewMode])

    const navigateParams = (
        mutate: (params: URLSearchParams) => void,
        event?: React.SyntheticEvent<HTMLElement>,
        historyMode: 'push' | 'replace' = 'replace',
        intent: GridNavigationIntent = 'filter',
    ) => {
        if (previewMode && event && intent !== 'view') {
            handleCartClick(event as unknown as React.MouseEvent<HTMLElement>)
            return
        }

        const params = new URLSearchParams(selectionMode === 'all' ? searchParams.toString() : localFilters)
        if (intent !== 'view' && params.getAll('categoryId').includes('0')) {
            const categoryIds = params.getAll('categoryId').filter(id => id !== '0')
            params.delete('categoryId')
            categoryIds.forEach(id => params.append('categoryId', id))
        }
        mutate(params)
        if (selectionMode !== 'all' && intent === 'view') { setLocalView(params.get('view') || 'grid-3'); return }
        if (selectionMode !== 'all') { setLocalFilters(params.toString()); setLocalPage(1); return }
        const nextHref = `${pathname}?${params.toString()}`
        if (historyMode === 'replace') router.replace(nextHref, { scroll: false })
        else router.push(nextHref, { scroll: false })
    }

    const clearFilters = (event: React.MouseEvent<HTMLButtonElement>) => {
        navigateParams((params) => {
            params.delete('categoryId')
            params.delete('minPrice')
            params.delete('maxPrice')
            params.delete('search')
            params.delete('page')
            const keys = Array.from(params.keys()).filter((key) => key.startsWith('attr_'))
            keys.forEach((key) => params.delete(key))
        }, event, 'replace')
    }

    const removeCategoryFilter = (categoryId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        navigateParams((params) => {
            const nextIds = params.getAll('categoryId').filter((id) => id !== categoryId)
            params.delete('categoryId')
            nextIds.forEach((id) => params.append('categoryId', id))
            params.delete('page')
        }, event, 'replace')
    }

    const removePriceFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
        navigateParams((params) => {
            params.delete('minPrice')
            params.delete('maxPrice')
            params.delete('page')
        }, event, 'replace')
    }

    const activeFilterChips = [
        ...displayFilters.categoryIds.filter(id => id !== '0').map((categoryId) => ({
            key: `category-${categoryId}`,
            label: categoryLookup.get(categoryId)?.name || categoryId,
            onRemove: (event: React.MouseEvent<HTMLButtonElement>) => removeCategoryFilter(categoryId, event),
        })),
        ...((displayFilters.minPrice || displayFilters.maxPrice) ? [{
            key: 'price',
            label: formatPriceChipLabel(displayFilters.minPrice, displayFilters.maxPrice, bounds.minPrice, bounds.maxPrice, t.storefront.products.priceHeading, pricePrefix),
            onRemove: (event: React.MouseEvent<HTMLButtonElement>) => removePriceFilter(event),
        }] : []),
    ]

    const viewToggle = showViewToggle ? (
        <div className="inline-flex items-center gap-2">
            <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid-3'}
                className="flex size-8 items-center justify-center rounded-[6px] transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                style={{
                    background: viewMode === 'grid-3' ? 'rgba(var(--brand-primary-rgb), 0.14)' : 'transparent',
                    color: viewMode === 'grid-3' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                }}
                onClick={(event) => navigateParams((params) => params.set('view', 'grid-3'), event, 'push', 'view')}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="10" y="1" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="1" y="10" width="5" height="5" rx="1" fill="currentColor" />
                    <rect x="10" y="10" width="5" height="5" rx="1" fill="currentColor" />
                </svg>
            </button>
            <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className="flex size-8 items-center justify-center rounded-[6px] transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)]"
                style={{
                    background: viewMode === 'list' ? 'rgba(var(--brand-primary-rgb), 0.14)' : 'transparent',
                    color: viewMode === 'list' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                }}
                onClick={(event) => navigateParams((params) => params.set('view', 'list'), event, 'push', 'view')}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="1" y="2" width="2" height="2" rx="0.5" fill="currentColor" />
                    <rect x="1" y="7" width="2" height="2" rx="0.5" fill="currentColor" />
                    <rect x="1" y="12" width="2" height="2" rx="0.5" fill="currentColor" />
                    <rect x="5" y="2" width="10" height="2" rx="0.75" fill="currentColor" />
                    <rect x="5" y="7" width="10" height="2" rx="0.75" fill="currentColor" />
                    <rect x="5" y="12" width="10" height="2" rx="0.75" fill="currentColor" />
                </svg>
            </button>
        </div>
    ) : null

    const filtersToolbar = (activeFilterChips.length > 0 || showViewToggle || showMobileFilterButton) ? (
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
            {(showViewToggle || showMobileFilterButton) ? (
                <div className={`order-1 flex w-full items-center ${showSidebar ? 'justify-between border-b pb-2 lg:order-2 lg:ml-auto lg:w-auto lg:justify-end lg:border-0 lg:pb-0' : 'justify-end lg:order-2 lg:ml-auto lg:w-auto'}`}>
                    {showViewToggle ? viewToggle : <div />}
                    {showMobileFilterButton ? (
                        <div className="lg:hidden">
                            <MobileFilterDrawer
                                controls={block.filterControls}
                                activeFilters={displayFilters}
                                bounds={bounds}
                                categories={categories}
                                filterButtonLabel={productText.filterHeading || 'Filter'}
                                onApplyFilters={(mutate, event) => navigateParams(mutate, event, 'replace')}
                                pricePrefix={pricePrefix}
                                primaryColor={CSS_VARS.primary}
                                saveButtonLabel={productText.saveFilters || 'Save Filters'}
                                sections={{
                                    title: productText.filterHeading || 'Filter',
                                    search: productText.searchHeading || 'Search Products',
                                    categories: t.storefront.products.categoriesHeading,
                                    price: t.storefront.products.priceHeading,
                                }}
                                searchPlaceholder={productText.searchPlaceholder || 'Search your keyword...'}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {activeFilterChips.length > 0 ? (
                <div className="order-2 hidden flex-wrap gap-3 lg:order-1 lg:flex lg:flex-1">
                    {activeFilterChips.map((chip) => (
                        <div
                            key={chip.key}
                            className="flex min-h-11 items-center gap-3 rounded-md px-3.5 py-2.5 lg:min-h-12 lg:px-4 lg:py-3"
                            style={{ border: '1.5px solid rgba(var(--brand-primary-rgb), 0.28)' }}
                        >
                            <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-[var(--text-primary)]">{chip.label}</span>
                            <button
                                type="button"
                                aria-label={`Remove ${chip.label}`}
                                className="shrink-0 text-base leading-none text-[var(--text-secondary)] transition-colors hover:text-[var(--brand-primary)]"
                                onClick={chip.onRemove}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="flex min-h-11 items-center rounded-md px-3.5 py-2.5 text-sm font-semibold leading-5 transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)] lg:min-h-12 lg:px-4 lg:py-3"
                        style={{ border: '1.5px solid rgba(var(--brand-primary-rgb), 0.28)', color: 'var(--brand-primary)' }}
                        onClick={clearFilters}
                    >
                        {t.storefront.products.clearFilters}
                    </button>
                </div>
            ) : null}
        </div>
    ) : null

    const handlePageChange = (page: number, event: React.MouseEvent<HTMLButtonElement>) => {
        if (selectionMode !== 'all') {
            if (previewMode) { handleCartClick(event); return }
            setLocalPage(page)
            scrollToResultsTop()
            return
        }
        if (previewMode) { handleCartClick(event); return }
        repositionRef.current = page !== currentPage ? 'requested' : 'idle'
        repositionTargetRef.current = page
        scrollToResultsTop()
        navigateParams((params) => {
            if (page <= 1) params.delete('page')
            else params.set('page', String(page))
        }, event, 'push', 'pagination')
    }

    const gridContent = loading ? (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-testid="products-grid-skeleton"
            className={`grid min-w-0 motion-safe:animate-pulse ${gridCols}`}
        >
            <span className="sr-only">Loading products...</span>
            {Array.from({ length: 6 }, (_, index) => (
                <div
                    key={index}
                    data-testid="product-card-skeleton"
                    aria-hidden="true"
                    style={cardVariant === 'list' ? undefined : { minHeight: 'clamp(260px, 28vw, 360px)' }}
                    className={`pointer-events-none min-w-0 select-none overflow-hidden border border-[var(--divider)] bg-[var(--surface-primary)] ${cardVariant === 'list' ? 'flex h-[126px] rounded-[16px] md:h-40 md:rounded-2xl' : 'flex min-h-[260px] flex-col rounded-[12px] sm:min-h-[360px] sm:rounded-2xl'}`}
                >
                    <div className={`bg-[var(--surface-secondary)] ${cardVariant === 'list' ? 'h-full w-[112px] shrink-0 md:w-44' : 'h-[110px] sm:aspect-square sm:h-auto'}`} />
                    <div className={`flex min-w-0 flex-1 flex-col ${cardVariant === 'list' ? 'p-3 md:p-6' : 'p-2.5 sm:p-4 md:p-5'}`}>
                        <div className="h-3 w-1/3 rounded bg-[rgba(var(--brand-primary-rgb),0.12)]" />
                        <div className="mt-3 h-4 w-4/5 rounded bg-[rgba(var(--brand-primary-rgb),0.16)]" />
                        <div className="mt-2 h-3 w-full rounded bg-[rgba(var(--brand-primary-rgb),0.08)]" />
                        <div className="mt-auto h-4 w-2/5 rounded bg-[rgba(var(--brand-primary-rgb),0.14)]" />
                    </div>
                </div>
            ))}
        </div>
    ) : products.length === 0 ? (
        <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-secondary)] px-6 py-14 text-center">
            <p className="mb-4 text-5xl opacity-20">🛍️</p>
            <p className="text-lg opacity-75">
                {hasActiveFilters ? t.storefront.products.noMatch : (productText.noProductsYet || 'No products yet. Check back soon!')}
            </p>
            {hasActiveFilters && (
                <button
                    type="button"
                    className="mt-5 text-sm font-semibold underline decoration-transparent underline-offset-4 transition hover:decoration-current"
                    style={{ color: 'var(--brand-primary)' }}
                    onClick={clearFilters}
                >
                    {t.storefront.products.clearFilters}
                </button>
            )}
        </div>
    ) : (
        <>
            <StaggerGrid key={gridAnimationSeed} data-grid-seed={gridAnimationSeed} className={`grid ${gridCols}`}>
                {products.map((product) => (
                    <StaggerItem key={product.id}>
                        <ProductCard
                            product={product}
                            variant={cardVariant}
                            theme={theme}
                            siteBasePath={siteBasePath}
                            siteName={site?.name ?? undefined}
                            site={site}
                        />
                    </StaggerItem>
                ))}
            </StaggerGrid>

            {filtersEnabled ? (
                <ProductsPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    primaryColor={CSS_VARS.primary}
                    onPageChange={handlePageChange}
                />
            ) : null}
        </>
    )

    const gridPanel = (
        <div className="relative">
            {refreshing && !loading ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
                    <div
                        role="status"
                        aria-live="polite"
                        className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                        style={{
                            backgroundColor: 'rgba(var(--brand-primary-rgb), 0.12)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.18)',
                        }}
                    >
                        {productText.updatingProducts || 'Updating products...'}
                    </div>
                </div>
            ) : null}
            <div className={refreshing && !loading ? 'opacity-80 transition-opacity duration-200' : undefined}>
                {gridContent}
            </div>
        </div>
    )

    const resultsContent = (
        <>
            <div ref={resultsTopRef} data-testid="products-grid-results-top" className="scroll-mt-24" aria-hidden="true" />
            {filtersToolbar}
            {gridPanel}
        </>
    )

    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
            <GradientBlob color={CSS_VARS.primary} className="bottom-[10%] left-[-5%]" size="min(500px, 100vw)" opacity={0.04} />

            <div className="text-center max-w-2xl mx-auto mb-16">
                {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                <Heading level={2} className="mb-4">
                    <RichText text={headline} as="span" />
                </Heading>
                {subheadline && (
                    <Body size="lg" className="opacity-60">
                        <RichText text={subheadline} as="span" />
                    </Body>
                )}
            </div>

            {showSidebar ? (
                <div className="grid items-start gap-8 lg:grid-cols-[260px_1fr]">
                    <div className="hidden lg:block">
                        <ProductFilterSidebar
                            controls={block.filterControls}
                            localSearchParams={selectionMode === 'all' ? undefined : localFilters}
                            onLocalFilterChange={selectionMode === 'all' ? undefined : params => { setLocalFilters(params.toString()); setLocalPage(1) }}
                            pricePrefix={pricePrefix}
                            categories={categories}
                            bounds={bounds}
                            activeFilters={displayFilters}
                            primaryColor={CSS_VARS.primary}
                        />
                    </div>
                    <div>
                        {resultsContent}
                    </div>
                </div>
            ) : (
                <div>
                    {resultsContent}
                </div>
            )}
        </SectionWrapper>
    )
}
