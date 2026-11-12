// @vitest-environment jsdom
/**
 * GH-2207 — the product page shows the Description saved from the CMS form.
 * The form saves only `description` (rich text); the page used to read only `shortDescription`.
 * Real: the page, renderBlogContent (Lexical → HTML + DOMPurify), en strings. Faked: Payload, auth, next/*, client widgets.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

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

import ProductDetailPage from '@/app/sites/[slug]/products/[productSlug]/page'

const lexical = (...paragraphs: string[]) => ({
    root: {
        type: 'root', format: '', indent: 0, version: 1,
        children: paragraphs.map((text) => ({
            type: 'paragraph', format: '', indent: 0, version: 1,
            children: text ? [{ type: 'text', text, mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] : [],
        })),
    },
})

async function renderPage(fields: Record<string, unknown>) {
    product.current = { id: 'p1', name: 'Cotton Tee', slug: 'tee', status: 'active', price: 50, inventory: 5, ...fields }
    const jsx = await ProductDetailPage({ params: Promise.resolve({ slug: 'demo', productSlug: 'tee' }) })
    return render(jsx)
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('[GH-2207] product page Description', () => {
    it('[TC-F09-2207-01] shows the description typed in the CMS form when there is no short description', async () => {
        // Arrange / Act
        const { getByText, getByTestId } = await renderPage({ description: lexical('QA-2207 line one', 'QA-2207 line two') })

        // Assert
        expect(getByText('Description')).toBeInTheDocument()
        expect(getByTestId('product-description').querySelectorAll('p')).toHaveLength(2)
        expect(getByText('QA-2207 line one')).toBeInTheDocument()
        expect(getByText('QA-2207 line two')).toBeInTheDocument()
    })

    it('[TC-F09-2207-02] renders PW1 HTML stored in one text node as HTML, not as raw tags', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: lexical('<p>St Andrews <strong>golf</strong> tee</p><ul><li>Cotton</li></ul>') })

        // Assert
        const box = getByTestId('product-description')
        expect(box.querySelector('strong')).toHaveTextContent('golf')
        expect(box.querySelector('li')).toHaveTextContent('Cotton')
        expect(box.textContent).not.toContain('<p>')
    })

    it('[TC-F09-2207-03] shows a plain string description (AI sample products)', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: 'Soft breathable cotton.', shortDescription: 'Short blurb' })

        // Assert
        expect(getByTestId('product-description')).toHaveTextContent('Soft breathable cotton.')
        expect(getByTestId('product-description')).not.toHaveTextContent('Short blurb')
    })

    it('[TC-F09-2207-06] keeps line breaks of a multi-line plain string description', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: '\nFirst paragraph.\n\nSecond paragraph.\n' })

        // Assert
        expect(getByTestId('product-description')).toHaveClass('whitespace-pre-line')
        expect(getByTestId('product-description').textContent).toBe('First paragraph.\n\nSecond paragraph.')
    })

    it('[TC-F09-2207-06] does not apply pre-line wrapping to HTML descriptions', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: '<p>One</p>\n<p>Two</p>' })

        // Assert
        expect(getByTestId('product-description')).not.toHaveClass('whitespace-pre-line')
    })

    it.each([
        ['missing', undefined],
        ['empty paragraphs', lexical('')],
    ])('[TC-F09-2207-04] falls back to the short description when the description is %s', async (_label, description) => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description, shortDescription: 'Short blurb' })

        // Assert
        expect(getByTestId('product-description')).toHaveTextContent('Short blurb')
    })

    it('[TC-F09-2207-04] keeps an image-only description instead of falling back', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: lexical('<p><img src="/media/tee.jpg" alt="Tee"></p>'), shortDescription: 'Short blurb' })

        // Assert
        expect(getByTestId('product-description').querySelector('img')).toHaveAttribute('src', '/media/tee.jpg')
        expect(getByTestId('product-description')).not.toHaveTextContent('Short blurb')
    })

    it('[TC-F09-2207-04] falls back to the short description when the rich text cannot be rendered', async () => {
        // Arrange — malformed migrated rich text (e.g. a null node left by migration) makes the Lexical converter throw
        const broken = { root: { type: 'root', children: [null] } }

        // Act
        const { getByTestId } = await renderPage({ description: broken, shortDescription: 'Short blurb' })

        // Assert
        expect(getByTestId('product-description')).toHaveTextContent('Short blurb')
        expect(console.error).toHaveBeenCalledWith('[pdp] description render failed', expect.any(Error))
    })

    it('[TC-F09-2207-04] hides the Description section when both fields are empty', async () => {
        // Arrange / Act
        const { queryByTestId, queryByText } = await renderPage({ description: lexical('') })

        // Assert
        expect(queryByTestId('product-description')).toBeNull()
        expect(queryByText('Description')).toBeNull()
    })

    it('[TC-F09-2207-05] strips scripts and event handlers from the description', async () => {
        // Arrange / Act
        const { getByTestId } = await renderPage({ description: lexical('<p>Safe text<img src="x" onerror="alert(1)"><script>alert(2)</script></p>') })

        // Assert
        const box = getByTestId('product-description')
        expect(box).toHaveTextContent('Safe text')
        expect(box.querySelector('script')).toBeNull()
        expect(box.querySelector('img')).not.toBeNull()
        expect(box.querySelector('img')?.hasAttribute('onerror')).toBe(false)
    })
})
