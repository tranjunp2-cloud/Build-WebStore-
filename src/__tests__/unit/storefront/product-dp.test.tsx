// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ProductDetailPage, { generateMetadata } from '../../../app/sites/[slug]/products/[productSlug]/page'

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
vi.mock('@/components/storefront/CartDrawer', () => ({
    CartDrawer: () => <div data-testid="cart-drawer" />
}))
vi.mock('next/link', () => ({
    default: ({ children }: any) => <a>{children}</a>
}))
vi.mock('next/navigation', () => ({
    notFound: vi.fn()
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
    I18nText: ({ render }: { render: (t: Record<string, any>) => React.ReactNode }) => {
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

    it('generates correct metadata title with SEO fallback', async () => {
        const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'demo', productSlug: 'ao-thun-test' }) })
        expect(metadata.title).toBe('Áo thun Test — Demo Site')
    })
})
