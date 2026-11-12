// @vitest-environment jsdom
/**
 * GH-2378 — meta description, og/twitter description and JSON-LD fall back to the CMS `description`.
 * Real: the page + generateMetadata, renderBlogContent, product-summary-text. Faked: Payload, auth, next/*, client widgets.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const { product } = vi.hoisted(() => ({ product: { current: {} as Record<string, unknown> } }))

vi.mock('@/lib/storefront/cached-store-availability', () => ({
    isCachedStoreUnavailable: vi.fn(async () => false),
    storeUnavailableLocaleOf: vi.fn(async () => 'en'),
    storeUnavailableResponse: vi.fn(async () => null),
    storefrontUnavailableFor: vi.fn(async () => null),
}))
vi.mock('payload', () => ({
    getPayload: async () => ({
        find: async ({ collection }: { collection: string }) => {
            if (collection === 'tenants') return { docs: [{ id: 't1', slug: 'demo' }] }
            if (collection === 'sites') return { docs: [{ id: 's1', tenant: 't1', name: 'Demo Site', status: 'published', theme: {} }] }
            if (collection === 'products') return { docs: [product.current] }
            return { docs: [] }
        },
    }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/components/storefront/product-add-to-cart-section', () => ({ ProductAddToCartSection: () => null }))
vi.mock('@/components/storefront/ProductImageGallery', () => ({ ProductImageGallery: () => null }))
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/sites/demo/products/tee' }))
vi.mock('next/headers', () => ({
    headers: async () => new Map([['x-tenant-slug', 'demo']]),
    cookies: async () => ({ get: () => undefined }),
}))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: async () => null,
    getCurrentTenantId: async () => null,
}))
vi.mock('@/components/site-renderer/OwnerContext', () => ({
    OwnerProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import ProductDetailPage, { generateMetadata } from '@/app/sites/[slug]/products/[productSlug]/page'

const lexical = (...paragraphs: string[]) => ({
    root: {
        type: 'root', format: '', indent: 0, version: 1,
        children: paragraphs.map((text) => ({
            type: 'paragraph', format: '', indent: 0, version: 1,
            children: [{ type: 'text', text, mode: 'normal', style: '', detail: 0, format: 0, version: 1 }],
        })),
    },
})

const params = { params: Promise.resolve({ slug: 'demo', productSlug: 'tee' }) }

async function seoOf(fields: Record<string, unknown>) {
    product.current = { id: 'p1', name: 'Cotton Tee', slug: 'tee', status: 'active', price: 50, inventory: 5, ...fields }
    const meta = await generateMetadata(params)
    const { container } = render(await ProductDetailPage(params))
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
        .map((el) => JSON.parse(el.textContent || '{}'))
        .find((json) => json['@type'] === 'Product')
    return { meta, ld }
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('[GH-2378] product page SEO description fallback', () => {
    it('[TC-F09-2378-04] only `description`: meta, og, twitter and JSON-LD use its plain text', async () => {
        // Arrange / Act
        const { meta, ld } = await seoOf({ description: lexical('QA-2378 first.', 'QA-2378 second.') })

        // Assert
        expect(meta.description).toBe('QA-2378 first. QA-2378 second.')
        expect(meta.openGraph?.description).toBe('QA-2378 first. QA-2378 second.')
        expect(meta.twitter?.description).toBe('QA-2378 first. QA-2378 second.')
        expect(ld.description).toBe('QA-2378 first. QA-2378 second.')
    })

    it('[TC-F09-2378-04] no description at all: meta keeps the generic sentence, JSON-LD is empty', async () => {
        // Arrange / Act
        const { meta, ld } = await seoOf({})

        // Assert
        expect(meta.description).toBe('Buy Cotton Tee from Demo Site')
        expect(ld.description).toBe('')
    })

    it('[TC-F09-2378-05] shortDescription still wins over description', async () => {
        // Arrange / Act
        const { meta, ld } = await seoOf({ shortDescription: 'Short blurb', description: lexical('Long text') })

        // Assert
        expect(meta.description).toBe('Short blurb')
        expect(ld.description).toBe('Short blurb')
    })

    it('[TC-F09-2378-05] seo.description wins for meta over shortDescription and description', async () => {
        // Arrange / Act
        const { meta } = await seoOf({ seo: { description: 'Merchant SEO' }, shortDescription: 'Short blurb', description: lexical('Long text') })

        // Assert
        expect(meta.description).toBe('Merchant SEO')
    })
})
