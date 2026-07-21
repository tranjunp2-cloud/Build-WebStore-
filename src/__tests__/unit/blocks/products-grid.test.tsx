import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockScrollIntoView = vi.fn()
let mockPathname = '/sites/demo/products'
let mockSearchParams = new URLSearchParams('site=1')

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => mockPathname),
    useRouter: vi.fn(() => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() })),
    useSearchParams: vi.fn(() => mockSearchParams),
}))

vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        t: {
            storefront: {
                products: {
                    filterHeading: 'Filters',
                    categoriesHeading: 'Categories',
                    allCategories: 'All',
                    priceHeading: 'Price',
                    priceMin: 'Min',
                    priceMax: 'Max',
                    priceApply: 'Apply',
                    attributesHeading: 'Specifications',
                    layoutGrid: 'Layout Grid',
                    layoutList: 'Layout List',
                    noMatch: 'No products match your filters.',
                    clearFilters: 'Clear all filters',
                    noProductsYet: 'No products yet. Check back soon!',
                    updatingProducts: 'Updating products...',
                    searchHeading: 'Search Products',
                    searchPlaceholder: 'Search your keyword...',
                    searchButtonLabel: 'Search products',
                    saveFilters: 'Save Filters',
                    closeFilters: 'Close filters',
                    clearSearch: 'Clear search',
                    expandCategory: 'Expand',
                    collapseCategory: 'Collapse',
                },
            },
        },
    })),
}))

vi.mock('@/lib/storefront/editor-intercept', () => ({
    handleCartClick: vi.fn(),
    isInEditorPreview: vi.fn(() => false),
}))

vi.mock('@/blocks/shared/SectionWrapper', () => ({
    SectionWrapper: ({ children }: { children: React.ReactNode }) => <section data-testid="section-wrapper">{children}</section>,
}))

vi.mock('@/blocks/shared/animations', () => ({
    AnimatedSection: 'section',
    StaggerGrid: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div data-testid="stagger-grid" className={className} {...props}>{children}</div>
    ),
    StaggerItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/blocks/shared/decorative', () => ({
    SectionLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    GradientBlob: () => null,
}))

vi.mock('@/blocks/shared/RichText', () => ({
    RichText: ({ text }: { text: string }) => <>{text}</>,
}))

vi.mock('@/blocks/shared/Typography', () => ({
    Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    Body: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/blocks/products-grid/ProductCard', () => ({
    ProductCard: ({ product }: { product: { name: string } }) => <article data-testid="product-card">{product.name}</article>,
}))

import { ProductsGridBlock } from '@/blocks/products-grid'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { normalizeSidebarCategory } from '@/blocks/products-grid/filter-utils'
import { ProductFilterSidebar } from '@/blocks/products-grid/ProductFilterSidebar'
import { CategoryTree } from '@/blocks/products-grid/filters/CategoryTree'
import { PriceRangeFilter } from '@/blocks/products-grid/filters/PriceRangeFilter'
import { AttributeFilters } from '@/blocks/products-grid/filters/AttributeFilters'
import { SearchFilter } from '@/blocks/products-grid/filters/SearchFilter'

function createJsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

function createProductDoc(name = 'Demo Product') {
    return {
        id: 1,
        slug: 'demo-product',
        name,
        price: 49.9,
        currency: 'MYR',
        inventory: 5,
        images: [],
        category: { id: 10, name: 'Fashion', slug: 'fashion' },
        shortDescription: 'A product description for storefront previews.',
    }
}

function mockStorefrontFetch({
    products = [createProductDoc()],
    categories = [],
    bounds = { minPrice: 0, maxPrice: 0, attributes: [] },
    page = 1,
    totalPages = 1,
    totalDocs = products.length,
}: {
    products?: unknown[]
    categories?: unknown[]
    bounds?: { minPrice: number; maxPrice: number; attributes: Array<{ key: string; values: string[] }> }
    page?: number
    totalPages?: number
    totalDocs?: number
} = {}) {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('/api/storefront/products/bounds?')) return createJsonResponse(bounds)
        if (url.includes('/api/storefront/categories?')) return createJsonResponse({ docs: categories })
        if (url.includes('/api/storefront/products?')) return createJsonResponse({ docs: products, page, totalPages, totalDocs })

        throw new Error(`Unexpected fetch: ${url}`)
    })

    global.fetch = fetchMock as typeof fetch
    return fetchMock
}

const baseBlock = {
    blockType: 'products-grid',
    headline: 'Featured Products',
    limit: 6,
    variant: 'grid-3',
} as const

const baseSite = {
    id: 1,
    name: 'Demo Site',
    tenantSlug: 'demo',
} as const

function setViewportWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: width,
    })
}

describe('[TC-F09.239–241] ProductsGridBlock filter shell', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPush.mockReset()
        mockReplace.mockReset()
        mockScrollIntoView.mockReset()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: mockScrollIntoView,
        })
        mockPathname = '/sites/demo/products'
        mockSearchParams = new URLSearchParams('site=1')
        setViewportWidth(1280)
    })

    it('[TC-F09.239] renders plain grid and skips category/bounds fetches when the filter flag is off', async () => {
        const fetchMock = mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [{ key: 'color', values: ['red'] }] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: false }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())
        expect(screen.queryByText('Filters')).not.toBeInTheDocument()

        const urls = fetchMock.mock.calls.map(([url]) => String(url))
        expect(urls).toHaveLength(1)
        expect(urls[0]).toContain('/api/storefront/products?')
    })

    it('[TC-F09.239a] uses the configured limit without filters, 9 on desktop filters, and 10 on mobile filters', async () => {
        const plainFetch = mockStorefrontFetch()
        const plainView = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: false, limit: 20 }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())
        const plainUrls = plainFetch.mock.calls.map(([url]) => String(url))
        expect(plainUrls.some((url) => url.includes('/api/storefront/products?') && url.includes('limit=20'))).toBe(true)

        plainView.unmount()

        const filteredFetch = mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })
        const filteredView = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true, limit: 2 }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Search Products')).toBeInTheDocument())
        const filteredUrls = filteredFetch.mock.calls.map(([url]) => String(url))
        expect(filteredUrls.some((url) => url.includes('/api/storefront/products?') && url.includes('limit=9'))).toBe(true)

        filteredView.unmount()

        setViewportWidth(390)
        const mobileFetch = mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })
        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true, limit: 2 }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Search Products')).toBeInTheDocument())
        const mobileUrls = mobileFetch.mock.calls.map(([url]) => String(url))
        expect(mobileUrls.some((url) => url.includes('/api/storefront/products?') && url.includes('limit=10'))).toBe(true)
    })

    it('[TC-F09.239b] hides pagination completely when showCategoryFilter is off', async () => {
        mockStorefrontFetch()

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: false }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())
        expect(screen.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
    })

    it('[TC-F09.239c] includes the full Product Grid translation key set in both storefront locales', () => {
        const keys = ['searchHeading', 'searchPlaceholder', 'searchButtonLabel', 'saveFilters', 'closeFilters', 'clearSearch', 'expandCategory', 'collapseCategory'] as const

        keys.forEach((key) => {
            expect(en.storefront.products[key]).toBeTruthy()
            expect(ms.storefront.products[key]).toBeTruthy()
        })
    })

    it('[TC-F09.239d] still renders a single-page pagination bar when filters are enabled', async () => {
        mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page'))
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('[TC-F09.240] renders localized sidebar groups when filters are enabled and facets exist', async () => {
        const fetchMock = mockStorefrontFetch({
            categories: [
                { id: 10, name: 'Fashion', slug: 'fashion', parent: null, breadcrumbs: 'Fashion' },
            ],
            bounds: {
                minPrice: 10,
                maxPrice: 80,
                attributes: [{ key: 'material', values: ['cotton'] }],
            },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Categories')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Grid view' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'List view' })).toBeInTheDocument()
        expect(screen.getByText('Price')).toBeInTheDocument()
        expect(screen.getByText('Your range:')).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: 'Min' })).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: 'Max' })).toBeInTheDocument()
        expect(screen.getByText('Search Products')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search your keyword...')).toBeInTheDocument()
        expect(screen.getByText('Specifications')).toBeInTheDocument()

        const urls = fetchMock.mock.calls.map(([url]) => String(url))
        expect(urls).toEqual(expect.arrayContaining([
            expect.stringContaining('/api/storefront/products?'),
            expect.stringContaining('/api/storefront/categories?site=1'),
            expect.stringContaining('/api/storefront/products/bounds?site=1'),
        ]))
    })

    it('[TC-F09.240bb] keeps the previous products visible while a filtered refetch is in flight', async () => {
        mockSearchParams = new URLSearchParams('site=1')

        let resolveSecondProducts
        let productRequestCount = 0
        const fetchMock = vi.fn((input: string | URL | Request) => {
            const url = typeof input === 'string' ? input : input.toString()

            if (url.includes('/api/storefront/products/bounds?')) return Promise.resolve(createJsonResponse({ minPrice: 10, maxPrice: 80, attributes: [] }))
            if (url.includes('/api/storefront/categories?')) return Promise.resolve(createJsonResponse({ docs: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }] }))
            if (url.includes('/api/storefront/products?')) {
                productRequestCount += 1
                if (productRequestCount === 1) {
                    return Promise.resolve(createJsonResponse({ docs: [createProductDoc('Original Product')], page: 1, totalPages: 1, totalDocs: 1 }))
                }

                return new Promise((resolve) => {
                    resolveSecondProducts = () => resolve(createJsonResponse({ docs: [createProductDoc('Filtered Product')], page: 1, totalPages: 1, totalDocs: 1 }))
                })
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        global.fetch = fetchMock as typeof fetch

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Original Product')).toBeInTheDocument())

        mockSearchParams = new URLSearchParams('site=1&categoryId=10')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/storefront/products?site=1&limit=9&sort=-createdAt&categoryId=10'), expect.anything()))
        expect(screen.getByText('Original Product')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Updating products...')

        resolveSecondProducts?.()

        await waitFor(() => expect(screen.getByText('Filtered Product')).toBeInTheDocument())
    })

    it('[TC-F09.240bc2] keeps the settled filter chips when a replacement products fetch fails', async () => {
        mockSearchParams = new URLSearchParams('site=1&categoryId=10')

        let rejectSecondProducts
        let productRequestCount = 0
        const fetchMock = vi.fn((input: string | URL | Request) => {
            const url = typeof input === 'string' ? input : input.toString()

            if (url.includes('/api/storefront/products/bounds?')) return Promise.resolve(createJsonResponse({ minPrice: 10, maxPrice: 80, attributes: [] }))
            if (url.includes('/api/storefront/categories?')) return Promise.resolve(createJsonResponse({ docs: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }] }))
            if (url.includes('/api/storefront/products?')) {
                productRequestCount += 1
                if (productRequestCount === 1) {
                    return Promise.resolve(createJsonResponse({ docs: [createProductDoc('Category Product')], page: 1, totalPages: 1, totalDocs: 1 }))
                }

                return new Promise((_resolve, reject) => {
                    rejectSecondProducts = () => reject(new Error('Products request failed: 500'))
                })
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        global.fetch = fetchMock as typeof fetch

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Category Product')).toBeInTheDocument())
        await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Fashion' })).toBeInTheDocument())

        mockSearchParams = new URLSearchParams('site=1')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/storefront/products?site=1&limit=9&sort=-createdAt'), expect.anything()))
        rejectSecondProducts?.()

        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
        expect(screen.getByText('Category Product')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove Fashion' })).toBeInTheDocument()
    })

    it('[TC-F09.240bc] keeps the previous category chip visible while clearing the last category filter is refetching', async () => {
        mockSearchParams = new URLSearchParams('site=1&categoryId=10')

        let resolveSecondProducts
        let productRequestCount = 0
        const fetchMock = vi.fn((input: string | URL | Request) => {
            const url = typeof input === 'string' ? input : input.toString()

            if (url.includes('/api/storefront/products/bounds?')) return Promise.resolve(createJsonResponse({ minPrice: 10, maxPrice: 80, attributes: [] }))
            if (url.includes('/api/storefront/categories?')) return Promise.resolve(createJsonResponse({ docs: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }] }))
            if (url.includes('/api/storefront/products?')) {
                productRequestCount += 1
                if (productRequestCount === 1) {
                    return Promise.resolve(createJsonResponse({ docs: [createProductDoc('Category Product')], page: 1, totalPages: 1, totalDocs: 1 }))
                }

                return new Promise((resolve) => {
                    resolveSecondProducts = () => resolve(createJsonResponse({ docs: [createProductDoc('All Products')], page: 1, totalPages: 1, totalDocs: 1 }))
                })
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        global.fetch = fetchMock as typeof fetch

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Category Product')).toBeInTheDocument())
        await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Fashion' })).toBeInTheDocument())

        mockSearchParams = new URLSearchParams('site=1')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/storefront/products?site=1&limit=9&sort=-createdAt'), expect.anything()))
        expect(screen.getByText('Category Product')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove Fashion' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Updating products...')

        resolveSecondProducts?.()

        await waitFor(() => expect(screen.getByText('All Products')).toBeInTheDocument())
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Fashion' })).not.toBeInTheDocument())
    })

    it('[TC-F09.240be] scrolls back to the top of the block when filter params change, but not when only the view mode changes', async () => {
        mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())
        expect(mockScrollIntoView).not.toHaveBeenCalled()

        mockSearchParams = new URLSearchParams('site=1&categoryId=10')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }))

        mockScrollIntoView.mockClear()
        mockSearchParams = new URLSearchParams('site=1&categoryId=10&view=list')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        expect(mockScrollIntoView).not.toHaveBeenCalled()
    })

    it('[TC-F09.240bd] remounts the stagger grid when the resolved product set changes after filtering', async () => {
        let resolveSecondProducts
        let productRequestCount = 0
        const fetchMock = vi.fn((input: string | URL | Request) => {
            const url = typeof input === 'string' ? input : input.toString()

            if (url.includes('/api/storefront/products/bounds?')) return Promise.resolve(createJsonResponse({ minPrice: 10, maxPrice: 80, attributes: [] }))
            if (url.includes('/api/storefront/categories?')) return Promise.resolve(createJsonResponse({ docs: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }] }))
            if (url.includes('/api/storefront/products?')) {
                productRequestCount += 1
                if (productRequestCount === 1) {
                    return Promise.resolve(createJsonResponse({ docs: [createProductDoc('Original Product')], page: 1, totalPages: 1, totalDocs: 1 }))
                }

                return new Promise((resolve) => {
                    resolveSecondProducts = () => resolve(createJsonResponse({ docs: [{ ...createProductDoc('Filtered Product'), id: 2, slug: 'filtered-product' }], page: 1, totalPages: 1, totalDocs: 1 }))
                })
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        global.fetch = fetchMock as typeof fetch

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByText('Original Product')).toBeInTheDocument())
        expect(screen.getByTestId('stagger-grid')).toHaveAttribute('data-grid-seed', '1:demo-product')

        mockSearchParams = new URLSearchParams('site=1&categoryId=10')
        view.rerender(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/storefront/products?site=1&limit=9&sort=-createdAt&categoryId=10'), expect.anything()))
        resolveSecondProducts?.()

        await waitFor(() => expect(screen.getByText('Filtered Product')).toBeInTheDocument())
        expect(screen.getByTestId('stagger-grid')).toHaveAttribute('data-grid-seed', '2:filtered-product')
    })

    it('[TC-F09.240b] includes the search query param in the products request when present', async () => {
        mockSearchParams = new URLSearchParams('site=1&search=volley')
        const fetchMock = mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)
        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())

        const urls = fetchMock.mock.calls.map(([url]) => String(url))
        expect(urls.some((url) => url.includes('/api/storefront/products?') && url.includes('search=volley'))).toBe(true)
    })

    it('[TC-F09.240c] includes the page query param in the products request and renders pagination controls', async () => {
        mockSearchParams = new URLSearchParams('site=1&page=2')
        const fetchMock = mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
            page: 2,
            totalPages: 10,
            totalDocs: 60,
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page'))

        const urls = fetchMock.mock.calls.map(([url]) => String(url))
        expect(urls.some((url) => url.includes('/api/storefront/products?') && url.includes('page=2'))).toBe(true)
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
        expect(screen.getByText('...')).toBeInTheDocument()
    })

    it('[TC-F09.240] layout switcher pushes the selected variant view into the URL', async () => {
        mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'List view' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'List view' }))

        expect(mockPush).toHaveBeenCalledWith('/sites/demo/products?site=1&view=list', { scroll: false })
    })

    it('[TC-F09.240d] clicking a pagination button pushes the selected page into the URL', async () => {
        mockStorefrontFetch({
            categories: [{ id: 10, name: 'Fashion', slug: 'fashion', parent: null }],
            bounds: { minPrice: 10, maxPrice: 80, attributes: [] },
            totalPages: 10,
            totalDocs: 60,
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))

        expect(mockPush).toHaveBeenCalledWith('/sites/demo/products?site=1&page=2', { scroll: false })
    })

    it('[TC-F09.240e] renders active category/price chips above the product list, supports remove buttons, and exposes a desktop clear-all chip', async () => {
        mockSearchParams = new URLSearchParams('site=1&categoryId=10&categoryId=11&minPrice=20&maxPrice=80')
        mockStorefrontFetch({
            categories: [
                { id: 10, name: 'Fashion', slug: 'fashion', parent: null },
                { id: 11, name: 'Tops', slug: 'tops', parent: null },
            ],
            bounds: { minPrice: 10, maxPrice: 120, attributes: [] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Fashion' })).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Remove Tops' })).toBeInTheDocument()
        expect(screen.getByText('Price: $20 - $80')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Clear all filters' })[0]).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Remove Fashion' }))
        const removeCategoryHref = mockReplace.mock.calls[0][0] as string
        expect(removeCategoryHref).toContain('/sites/demo/products?')
        expect(removeCategoryHref).not.toContain('categoryId=10')
        expect(removeCategoryHref).toContain('categoryId=11')
        expect(removeCategoryHref).toContain('minPrice=20')
        expect(removeCategoryHref).toContain('maxPrice=80')

        fireEvent.click(screen.getByRole('button', { name: 'Remove Price: $20 - $80' }))
        const removePriceHref = mockReplace.mock.calls[1][0] as string
        expect(removePriceHref).toContain('/sites/demo/products?')
        expect(removePriceHref).toContain('categoryId=10')
        expect(removePriceHref).toContain('categoryId=11')
        expect(removePriceHref).not.toContain('minPrice=20')
        expect(removePriceHref).not.toContain('maxPrice=80')

        fireEvent.click(screen.getAllByRole('button', { name: 'Clear all filters' })[0])
        expect(mockReplace).toHaveBeenLastCalledWith('/sites/demo/products?site=1', { scroll: false })
    })

    it('[TC-F09.240f] stages mobile drawer filters and only pushes them when Save Filters is pressed', async () => {
        mockSearchParams = new URLSearchParams('site=1&page=3')
        mockStorefrontFetch({
            categories: [
                { id: 10, name: 'Fashion', slug: 'fashion', parent: null },
                { id: 11, name: 'Tops', slug: 'tops', parent: 10 },
            ],
            bounds: { minPrice: 10, maxPrice: 120, attributes: [] },
        })

        render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }))

        const dialog = await screen.findByRole('dialog', { name: 'Filters' })
        fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search your keyword...' }), {
            target: { value: 'volley' },
        })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Expand Fashion' }))
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Tops' }))
        expect(mockReplace).not.toHaveBeenCalled()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Save Filters' }))

        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('/sites/demo/products?'),
            { scroll: false },
        )
        const nextHref = mockReplace.mock.calls[0][0] as string
        expect(nextHref).toContain('search=volley')
        expect(nextHref).toContain('categoryId=11')
        expect(nextHref).not.toContain('page=3')
    })

    it('[TC-F09.241] keeps the filter column visible when the flag is enabled even without facet data', async () => {
        mockStorefrontFetch()

        const view = render(<ProductsGridBlock block={{ ...baseBlock, showCategoryFilter: true }} theme={{} as never} site={baseSite as never} />)

        await waitFor(() => expect(screen.getByTestId('product-card')).toBeInTheDocument())
        expect(view.container.querySelector('aside')).toBeTruthy()
        expect(screen.queryByText('Categories')).not.toBeInTheDocument()
        expect(screen.queryByText('Price')).not.toBeInTheDocument()
        expect(screen.getByText('Search Products')).toBeInTheDocument()
    })
})

describe('[TC-F09.243–246] ProductsGridBlock filter interactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPush.mockReset()
        mockReplace.mockReset()
        mockScrollIntoView.mockReset()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: mockScrollIntoView,
        })
        mockPathname = '/sites/demo/products'
        mockSearchParams = new URLSearchParams('site=1')
    })

    it('[TC-F09.243] builds a 3-level category tree from flat categories with collapsible child branches', () => {
        const categories = [
            normalizeSidebarCategory({ id: 10, name: 'Fashion', slug: 'fashion', parent: null, breadcrumbs: 'Fashion' }),
            normalizeSidebarCategory({ id: 11, name: 'Tops', slug: 'tops', parent: { id: 10 }, breadcrumbs: 'Fashion > Tops' }),
            normalizeSidebarCategory({ id: 12, name: 'Shirts', slug: 'shirts', parent: 11, breadcrumbs: 'Fashion > Tops > Shirts' }),
            normalizeSidebarCategory({ id: 13, name: 'Pants', slug: 'pants', parent: 11, breadcrumbs: 'Fashion > Tops > Pants' }),
        ]

        const { container } = render(
            <CategoryTree
                categories={categories}
                activeCategoryIds={[]}
                onUpdateFilter={vi.fn()}
                primaryColor="#111111"
                searchParams="site=1"
                title="Categories"
            />,
        )

        expect(screen.getAllByRole('list')).toHaveLength(1)
        expect(screen.getByRole('button', { name: 'Fashion' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Tops' })).not.toBeInTheDocument()

        const rootList = screen.getAllByRole('list')[0]
        expect(rootList.className).toContain('space-y-0')

        fireEvent.click(screen.getByRole('button', { name: 'Expand Fashion' }))
        expect(screen.getAllByRole('list')).toHaveLength(2)
        expect(screen.getByRole('button', { name: 'Tops' })).toBeInTheDocument()

        const childRow = screen.getByRole('button', { name: 'Tops' }).closest('div')
        expect(childRow?.getAttribute('style')).toContain('padding-left: 16px')
        expect(childRow?.getAttribute('style')).toContain('border-top: 1px solid rgba(var(--brand-primary-rgb), 0.16)')
        const nestedList = container.querySelector('ul[style*="margin-left: 4px"]')
        expect(nestedList).toBeTruthy()
        expect(nestedList?.getAttribute('style')).toContain('margin-left: 4px')

        fireEvent.click(screen.getByRole('button', { name: 'Expand Tops' }))
        expect(screen.getAllByRole('list')).toHaveLength(3)
        expect(screen.getByRole('button', { name: 'Shirts' })).toBeInTheDocument()
        const grandChildRow = screen.getByRole('button', { name: 'Shirts' }).closest('div')
        expect(grandChildRow?.getAttribute('style')).toContain('border-top: 1px solid rgba(var(--brand-primary-rgb), 0.16)')
    })

    it('[TC-F09.244] clicking a category pushes a categoryId query param onto the current URL', () => {
        mockSearchParams = new URLSearchParams('site=1&sort=-createdAt')
        render(
            <ProductFilterSidebar
                categories={[{ id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' }]}
                bounds={{ minPrice: 0, maxPrice: 0, attributes: [] }}
                activeFilters={{ categoryIds: [], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tops' }))

        expect(mockReplace).toHaveBeenCalledWith('/sites/demo/products?site=1&sort=-createdAt&categoryId=11', { scroll: false })
    })

    it('[TC-F09.244a] changing a category removes the page query param so filters restart from page 1', () => {
        mockSearchParams = new URLSearchParams('site=1&sort=-createdAt&page=3')
        render(
            <ProductFilterSidebar
                categories={[{ id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' }]}
                bounds={{ minPrice: 0, maxPrice: 0, attributes: [] }}
                activeFilters={{ categoryIds: [], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tops' }))

        expect(mockReplace).toHaveBeenCalledWith('/sites/demo/products?site=1&sort=-createdAt&categoryId=11', { scroll: false })
    })
    it('[TC-F09.244b] clicking a leaf category label pushes a categoryId query param onto the current URL', () => {
        mockSearchParams = new URLSearchParams('site=1&sort=-createdAt')
        render(
            <ProductFilterSidebar
                categories={[{ id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' }]}
                bounds={{ minPrice: 0, maxPrice: 0, attributes: [] }}
                activeFilters={{ categoryIds: [], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tops' }))

        expect(mockReplace).toHaveBeenCalledWith('/sites/demo/products?site=1&sort=-createdAt&categoryId=11', { scroll: false })
    })

    it('[TC-F09.244c] clicking an unselected category appends it to the current categoryId list', () => {
        mockSearchParams = new URLSearchParams('site=1&sort=-createdAt&categoryId=11')
        render(
            <ProductFilterSidebar
                categories={[
                    { id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' },
                    { id: '12', name: 'Pants', slug: 'pants', parent: null, breadcrumbs: 'Pants' },
                ]}
                bounds={{ minPrice: 0, maxPrice: 0, attributes: [] }}
                activeFilters={{ categoryIds: ['11'], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Pants' }))

        expect(mockReplace).toHaveBeenCalledWith('/sites/demo/products?site=1&sort=-createdAt&categoryId=11&categoryId=12', { scroll: false })
    })

    it('[TC-F09.244d] clicking an active category removes it from the current categoryId list', () => {
        mockSearchParams = new URLSearchParams('site=1&sort=-createdAt&categoryId=11')
        render(
            <ProductFilterSidebar
                categories={[{ id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' }]}
                bounds={{ minPrice: 0, maxPrice: 0, attributes: [] }}
                activeFilters={{ categoryIds: ['11'], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tops' }))

        expect(mockReplace).toHaveBeenCalledWith('/sites/demo/products?site=1&sort=-createdAt', { scroll: false })
    })


    it('[TC-F09.244e] typing in the search box does not submit until the user leaves the field', () => {
        const onUpdateFilter = vi.fn()
        render(
            <SearchFilter
                activeSearch={null}
                onUpdateFilter={onUpdateFilter}
                primaryColor="#84bd00"
                searchParams="site=1&sort=-createdAt"
                title="Search Products"
                placeholder="Search your keyword..."
                submitAriaLabel="Search products"
            />,
        )

        const input = screen.getByRole('searchbox', { name: 'Search your keyword...' })
        fireEvent.change(input, { target: { value: 'volley' } })
        expect(onUpdateFilter).not.toHaveBeenCalled()

        fireEvent.blur(input)

        const params = onUpdateFilter.mock.calls[0][0] as URLSearchParams
        expect(params.get('search')).toBe('volley')
        expect(params.get('site')).toBe('1')
        expect(params.get('sort')).toBe('-createdAt')
    })

    it('[TC-F09.244f] pressing Enter applies the keyword immediately', () => {
        const onUpdateFilter = vi.fn()
        render(
            <SearchFilter
                activeSearch={null}
                onUpdateFilter={onUpdateFilter}
                primaryColor="#84bd00"
                searchParams="site=1&sort=-createdAt"
                title="Search Products"
                placeholder="Search your keyword..."
                submitAriaLabel="Search products"
            />,
        )

        const input = screen.getByRole('searchbox', { name: 'Search your keyword...' })
        fireEvent.change(input, { target: { value: 'volley' } })
        fireEvent.submit(input.closest('form') as HTMLFormElement)

        expect(onUpdateFilter).toHaveBeenCalledTimes(1)
        const params = onUpdateFilter.mock.calls[0][0] as URLSearchParams
        expect(params.get('search')).toBe('volley')
        expect(params.get('site')).toBe('1')
        expect(params.get('sort')).toBe('-createdAt')
    })

    it('[TC-F09.245] price slider commits params on drag without rendering a reset button', () => {
        const onUpdateFilter = vi.fn()
        render(
            <PriceRangeFilter
                activeMinPrice="20"
                activeMaxPrice="90"
                bounds={{ minPrice: 10, maxPrice: 120, attributes: [] }}
                onUpdateFilter={onUpdateFilter}
                primaryColor="#111111"
                searchParams="site=1&minPrice=20&maxPrice=90"
                title="Price"
                minLabel="Min"
                maxLabel="Max"
            />,
        )

        fireEvent.change(screen.getByRole('slider', { name: 'Min' }), { target: { value: '30' } })
        fireEvent.pointerUp(screen.getByRole('slider', { name: 'Min' }))

        const applyParams = onUpdateFilter.mock.calls[0][0] as URLSearchParams

        expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
        expect(applyParams.get('minPrice')).toBe('30')
        expect(applyParams.get('maxPrice')).toBe('90')
    })


    it('[TC-F09.247] sidebar cards match the product-card border treatment instead of relying on heavy shadows', () => {
        const { container } = render(
            <ProductFilterSidebar
                categories={[{ id: '11', name: 'Tops', slug: 'tops', parent: null, breadcrumbs: 'Tops' }]}
                bounds={{ minPrice: 10, maxPrice: 120, attributes: [{ key: 'color', values: ['red'] }] }}
                activeFilters={{ categoryIds: [], minPrice: null, maxPrice: null, search: null, attributeFilters: {}, serializedAttributes: '' }}
                primaryColor="#111111"
            />,
        )

        const sections = Array.from(container.querySelectorAll('section'))
        expect(sections.length).toBeGreaterThan(0)
        sections.forEach((section) => {
            expect(section.className).toContain('border')
            expect(section.className).not.toContain('bg-[var(--surface-card)]')
            expect(section.className).not.toContain('bg-[hsl(var(--card))]')
            expect(section.className).not.toContain('bg-white')
            expect(section.className).not.toContain('border-[var(--divider)]')
            expect(section.className).not.toContain('border-[hsl(var(--border))]')
            expect(section.className).not.toContain('border-black/10')
            expect(section.className).not.toContain('shadow-[0_18px_48px_rgba(15,45,51,0.06)]')
            expect(section.getAttribute('style')).toContain('border: 1.5px solid rgba(var(--brand-primary-rgb), 0.2)')
        })
    })

    it('[TC-F09.246] attribute checkbox toggles append and remove repeatable attr params', () => {
        const onUpdateFilter = vi.fn()

        const firstRender = render(
            <AttributeFilters
                attributes={[{ key: 'color', values: ['red', 'blue'] }]}
                attributeFilters={{ color: ['red'] }}
                onUpdateFilter={onUpdateFilter}
                primaryColor="#111111"
                searchParams="site=1&attr_color=red"
                title="Specifications"
            />,
        )

        fireEvent.click(screen.getByRole('checkbox', { name: 'blue' }))
        const appendParams = onUpdateFilter.mock.calls[0][0] as URLSearchParams

        firstRender.unmount()

        render(
            <AttributeFilters
                attributes={[{ key: 'color', values: ['red', 'blue'] }]}
                attributeFilters={{ color: ['red', 'blue'] }}
                onUpdateFilter={onUpdateFilter}
                primaryColor="#111111"
                searchParams="site=1&attr_color=red&attr_color=blue"
                title="Specifications"
            />,
        )
        fireEvent.click(screen.getByRole('checkbox', { name: 'red' }))

        const removeParams = onUpdateFilter.mock.calls[1][0] as URLSearchParams
        expect(appendParams.getAll('attr_color')).toEqual(['red', 'blue'])
        expect(removeParams.getAll('attr_color')).toEqual(['blue'])
    })
})
