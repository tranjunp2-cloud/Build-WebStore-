// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ProductDetailPage, { generateMetadata } from '../../../app/sites/[slug]/products/[productSlug]/page'
import { ProductImageGallery } from '../../../components/storefront/ProductImageGallery'
import { getPayload } from 'payload'
// #2179: store availability has its own tests (store-unavailable.test.ts); every store is available here.
vi.mock('@/lib/storefront/cached-store-availability', () => ({
    isCachedStoreUnavailable: vi.fn(async () => false),
    storeUnavailableLocaleOf: vi.fn(async () => 'en'),
    storeUnavailableResponse: vi.fn(async () => null),
    storefrontUnavailableFor: vi.fn(async () => null),
}))

// Mock getPayload
vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: vi.fn().mockImplementation(async ({ collection }) => {
            if (collection === 'tenants') return { docs: [{ id: 't1', slug: 'demo' }] }
            if (collection === 'sites') return { docs: [{ id: 's1', tenant: 't1', name: 'Demo Site', status: 'published', theme: { primaryColor: '#000' } }] }
            if (collection === 'products') return {
                docs: [{
                    id: 'p1',
                    name: 'Áo thun Test',
                    slug: 'ao-thun-test',
                    status: 'active',
                    price: 150000,
                    inventory: 10,
                    currency: 'VND',
                    category: { id: 'c1', name: 'Fashion', breadcrumbs: 'Apparel > Fashion' },
                    attributes: [
                        { key: 'Chất liệu', value: 'Cotton 100%' },
                        { key: 'Thương hiệu', value: 'Prime Local' }
                    ]
                }]
            }
            return { docs: [] }
        })
    })
}))

// Mock payload config
vi.mock('@payload-config', () => ({
    default: {}
}))

// Mock components
vi.mock('@/components/storefront/AddToCartButton', () => ({
    AddToCartButton: () => <div data-testid="add-to-cart-button" />
}))
vi.mock('@/components/storefront/quantity-stepper', () => ({
    QuantityStepper: () => <div data-testid="quantity-stepper" />
}))
vi.mock('@/components/storefront/ProductVariantSelector', () => ({
    ProductVariantSelector: ({ variants }: { variants: Array<{ name: string; stock: number }> }) => (
        <div data-testid="variant-selector">
            {variants.map(v => (
                <button key={v.name} disabled={v.stock === 0}>{v.name}</button>
            ))}
        </div>
    )
}))
vi.mock('@/components/storefront/CartDrawer', () => ({
    CartDrawer: () => <div data-testid="cart-drawer" />
}))
vi.mock('next/link', () => ({
    default: ({ children }: any) => <a>{children}</a>
}))
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
    usePathname: vi.fn().mockReturnValue('/sites/demo/products/test-product'),
}))
vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Map([
        ['x-tenant-slug', 'demo'],
    ])),
    cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(null),
    getCurrentTenantId: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/components/site-renderer/OwnerContext', () => ({
    OwnerProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/storefront/I18nText', () => ({
    I18nText: ({ render }: { render: (t: Record<string, unknown>) => React.ReactNode }) => {
        const en = require('../../../i18n/locales/en.json')
        return render(en)
    },
}))

describe('Storefront Product Detail Page (US-F08-06)', () => {
    it('renders attributes grid when attributes are present (AC-2)', async () => {
        const jsx = await ProductDetailPage({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })
        const { getByText } = render(jsx)
        
        expect(getByText('Specifications')).toBeInTheDocument()
        expect(getByText('Chất liệu')).toBeInTheDocument()
        expect(getByText('Cotton 100%')).toBeInTheDocument()
        expect(getByText('Thương hiệu')).toBeInTheDocument()
        expect(getByText('Prime Local')).toBeInTheDocument()
    })

    it('injects JSON-LD script with additionalProperty mapped from attributes (SEO)', async () => {
        const jsx = await ProductDetailPage({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })
        const { container } = render(jsx)
        
        // Find the script tag for JSON-LD
        const script = container.querySelector('script[type="application/ld+json"]')
        expect(script).toBeInTheDocument()
        
        const jsonLd = JSON.parse(script!.innerHTML)
        expect(jsonLd['@type']).toBe('Product')
        expect(jsonLd.name).toBe('Áo thun Test')
        
        // Assert additionalProperty is accurately mapped
        expect(jsonLd.additionalProperty).toBeDefined()
        expect(jsonLd.additionalProperty).toHaveLength(2)
        expect(jsonLd.additionalProperty[0]).toEqual({
            '@type': 'PropertyValue',
            name: 'Chất liệu',
            value: 'Cotton 100%'
        })
        expect(jsonLd.additionalProperty[1]).toEqual({
            '@type': 'PropertyValue',
            name: 'Thương hiệu',
            value: 'Prime Local'
        })
    })

    it('[TC-PERF-064] reads tenant, site, product and navigation one statement each, tenants trimmed to public fields', async () => {
        // Arrange
        const payload = await getPayload({} as never)
        const find = vi.mocked(payload.find)
        find.mockClear()

        // Act
        await generateMetadata({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })

        // Assert
        const calls = find.mock.calls.map(([args]) => args as unknown as Record<string, unknown>)
        expect(calls.map((args) => args.collection)).toEqual(['tenants', 'sites', 'products', 'pages'])
        for (const args of calls) expect(args.pagination).toBe(false)
        expect(calls[0]).toMatchObject({ depth: 0 })
        for (const args of calls.slice(1)) {
            expect((args.populate as { tenants: Record<string, boolean> }).tenants).toEqual({ name: true, slug: true, customDomains: true, status: true })
        }
    })

    it('generates correct metadata title with SEO fallback', async () => {
        const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })
        expect(metadata.title).toBe('Áo thun Test — Demo Site')
    })

    // TC-F08-02-10 — Variant selector integration (storefront)
    it('TC-F08-02-10 — renders variant buttons when product hasVariants', async () => {
        vi.mocked(getPayload).mockResolvedValueOnce({
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 't1', slug: 'demo' }] }
                if (collection === 'sites') return { docs: [{ id: 's1', tenant: 't1', name: 'Demo', status: 'published', theme: {} }] }
                if (collection === 'products') return {
                    docs: [{
                        id: 'p2', name: 'Áo thun Variant', slug: 'ao-thun-variant',
                        status: 'active', price: 150000, inventory: 5, currency: 'MYR',
                        hasVariants: true,
                        variants: [
                            { name: 'Trắng - M', price: 150000, stock: 5 },
                            { name: 'Trắng - L', price: 150000, stock: 0 },
                            { name: 'Đen - M', price: 155000, stock: 3 },
                        ],
                    }]
                }
                return { docs: [] }
            })
        } as any)

        const jsx = await ProductDetailPage({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-variant' }) })
        const { getByTestId, getByRole } = render(jsx)

        expect(getByTestId('variant-selector')).toBeInTheDocument()

        // All three variant buttons rendered
        expect(getByRole('button', { name: 'Trắng - M' })).toBeInTheDocument()
        expect(getByRole('button', { name: 'Trắng - L' })).toBeInTheDocument()
        expect(getByRole('button', { name: 'Đen - M' })).toBeInTheDocument()

        // Out-of-stock variant is disabled
        expect(getByRole('button', { name: 'Trắng - L' })).toBeDisabled()
    })

    it('TC-F08-02-11 — does not render variant selector when hasVariants=false', async () => {
        const jsx = await ProductDetailPage({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })
        const { queryByTestId } = render(jsx)

        expect(queryByTestId('variant-selector')).not.toBeInTheDocument()
    })
})

// TC-F09-1451 — ProductImageGallery client component
describe('ProductImageGallery (TC-F09-1451)', () => {
    const mockImages = [
        { image: { url: 'https://cdn.example.com/img1.jpg' }, alt: 'Ảnh 1' },
        { image: { url: 'https://cdn.example.com/img2.jpg' }, alt: 'Ảnh 2' },
        { image: { url: 'https://cdn.example.com/img3.jpg' }, alt: 'Ảnh 3' },
    ]

    it('TC-F09-1451-01 — first thumbnail is selected (aria-selected=true) by default', () => {
        const { getByLabelText } = render(
            <ProductImageGallery images={mockImages} productName="Test Product" primaryColor="#0ea5e9" />
        )
        expect(getByLabelText('View image 1')).toHaveAttribute('aria-selected', 'true')
        expect(getByLabelText('View image 2')).toHaveAttribute('aria-selected', 'false')
    })

    it('TC-F09-1451-02 — does not render thumbnail strip when only 1 image', () => {
        const { queryByLabelText } = render(
            <ProductImageGallery images={[mockImages[0]]} productName="Test Product" primaryColor="#0ea5e9" />
        )
        expect(queryByLabelText('View image 2')).not.toBeInTheDocument()
    })

    it('TC-F09-1451-03 — renders thumbnail buttons for all images when multiple', () => {
        const { getByLabelText } = render(
            <ProductImageGallery images={mockImages} productName="Test Product" primaryColor="#0ea5e9" />
        )
        expect(getByLabelText('View image 1')).toBeInTheDocument()
        expect(getByLabelText('View image 2')).toBeInTheDocument()
        expect(getByLabelText('View image 3')).toBeInTheDocument()
    })

    it('TC-F09-1451-04 — clicking thumbnail marks it as selected (aria-selected=true)', () => {
        const { getByLabelText } = render(
            <ProductImageGallery images={mockImages} productName="Test Product" primaryColor="#0ea5e9" />
        )
        const btn2 = getByLabelText('View image 2')
        expect(btn2).toHaveAttribute('aria-selected', 'false')
        fireEvent.click(btn2)
        expect(btn2).toHaveAttribute('aria-selected', 'true')
        // first thumbnail deselected
        expect(getByLabelText('View image 1')).toHaveAttribute('aria-selected', 'false')
    })

    it('TC-F09-1451-05 — renders placeholder icon when images array is empty', () => {
        const { container } = render(
            <ProductImageGallery images={[]} productName="Test Product" primaryColor="#0ea5e9" />
        )
        // Package icon rendered as svg aria-hidden
        const svg = container.querySelector('svg[aria-hidden]')
        expect(svg).toBeInTheDocument()
    })

    it('TC-F09-1451-06 — renders all 5 thumbnails when product has 5 images', () => {
        const fiveImages = Array.from({ length: 5 }, (_, i) => ({
            image: { url: `https://cdn.example.com/img${i + 1}.jpg` },
            alt: `Photo ${i + 1}`,
        }))
        const { getByLabelText } = render(
            <ProductImageGallery images={fiveImages} productName="Test Product" primaryColor="#0ea5e9" />
        )
        for (let i = 1; i <= 5; i++) {
            expect(getByLabelText(`View image ${i}`)).toBeInTheDocument()
        }
    })

    it('TC-F09-1451-07 — thumbnail <img alt> does not append an index to a real merchant-authored alt (code-review fix)', () => {
        // The parent <button> already carries aria-label={`View image ${i+1}`} — appending the
        // index to the <img>'s own alt as well corrupted real alt text (e.g. "Front view 2").
        const { getByLabelText } = render(
            <ProductImageGallery images={mockImages} productName="Test Product" primaryColor="#0ea5e9" />
        )
        const thumb2 = getByLabelText('View image 2').querySelector('img')
        expect(thumb2).toHaveAttribute('alt', 'Ảnh 2')
    })
})
