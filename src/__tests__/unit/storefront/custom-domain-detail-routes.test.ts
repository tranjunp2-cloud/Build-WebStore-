import { beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
    find: vi.fn(),
    hostname: 'mycafe.example',
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: testState.find })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Map([
        ['x-tenant-hostname', testState.hostname],
        ['x-tenant-type', 'custom-domain'],
    ]))),
    cookies: vi.fn(() => Promise.resolve({ get: () => undefined })),
}))

// #2179: store availability has its own tests (store-unavailable.test.ts); available unless a test says otherwise.
vi.mock('@/lib/storefront/cached-store-availability', () => ({ storefrontUnavailableFor: vi.fn(async () => null) }))

import { storefrontUnavailableFor } from '@/lib/storefront/cached-store-availability'
import { generateMetadata as generateProductMetadata } from '@/app/sites/[slug]/products/[productSlug]/page'
import { generateMetadata as generateBlogMetadata } from '@/app/sites/[slug]/blog/[blogSlug]/page'

const activeTenant = {
    id: 'tenant-1',
    slug: 'mycafe',
    customDomains: [{
        domain: 'mycafe.example',
        status: 'active',
        isPrimary: true,
    }],
}

const publishedSite = {
    id: 'site-1',
    tenant: 'tenant-1',
    status: 'published',
    name: 'My Cafe',
}

describe('[TC-F37-03-52] custom-domain product and blog detail routes', () => {
    beforeEach(() => {
        testState.find.mockReset()
        testState.hostname = 'mycafe.example'
    })

    it('[TC-F09.281] unavailable store: product and blog metadata are noindex and never name the store or item', async () => {
        // Arrange
        vi.mocked(storefrontUnavailableFor)
            .mockResolvedValueOnce({ unavailable: true, locale: 'ms' })
            .mockResolvedValueOnce({ unavailable: true, locale: 'ms' })

        // Act
        const product = await generateProductMetadata({ params: Promise.resolve({ slug: 'custom', productSlug: 'coffee' }) } as never)
        const blog = await generateBlogMetadata({ params: Promise.resolve({ slug: 'custom', blogSlug: 'news' }) } as never)

        // Assert
        for (const meta of [product, blog]) {
            expect(meta.robots).toMatchObject({ index: false, follow: false })
            expect(meta.title).toBe('Kedai ini tidak tersedia buat sementara waktu.')
        }
        expect(testState.find).not.toHaveBeenCalled()
    })

    it('resolves advertised product and blog URLs through the active custom domain', async () => {
        // Arrange
        testState.find
            .mockResolvedValueOnce({ docs: [activeTenant] })
            .mockResolvedValueOnce({ docs: [publishedSite] })
            .mockResolvedValueOnce({
                docs: [{
                    id: 'product-1',
                    site: 'site-1',
                    status: 'active',
                    slug: 'coffee',
                    name: 'Coffee',
                    price: 10,
                }],
            })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [activeTenant] })
            .mockResolvedValueOnce({ docs: [publishedSite] })
            .mockResolvedValueOnce({
                docs: [{
                    id: 'blog-1',
                    tenant: 'tenant-1',
                    site: 'site-1',
                    status: 'published',
                    slug: 'news',
                    title: 'News',
                }],
            })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const productMetadata = await generateProductMetadata({
            params: Promise.resolve({ slug: 'custom', productSlug: 'coffee' }),
        })
        const blogMetadata = await generateBlogMetadata({
            params: Promise.resolve({ slug: 'custom', blogSlug: 'news' }),
        })

        // Assert
        expect(testState.find.mock.calls[0]?.[0].where).toEqual({
            'customDomains.domain': { equals: 'mycafe.example' },
        })
        expect(testState.find.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
            collection: 'sites',
            sort: 'createdAt',
        }))
        expect(testState.find.mock.calls[2]?.[0].where).toEqual({
            and: [
                { site: { equals: 'site-1' } },
                { slug: { equals: 'coffee' } },
                { status: { equals: 'active' } },
            ],
        })
        expect(testState.find.mock.calls[4]?.[0].where).toEqual({
            'customDomains.domain': { equals: 'mycafe.example' },
        })
        expect(testState.find.mock.calls[5]?.[0]).toEqual(expect.objectContaining({
            collection: 'sites',
            sort: 'createdAt',
        }))
        expect(testState.find.mock.calls[6]?.[0].where).toEqual({
            and: [
                { tenant: { equals: 'tenant-1' } },
                { site: { equals: 'site-1' } },
                { slug: { equals: 'news' } },
                { status: { equals: 'published' } },
            ],
        })
        expect(productMetadata.alternates).toEqual({
            canonical: 'https://mycafe.example/products/coffee',
        })
        expect(blogMetadata.alternates).toEqual({
            canonical: 'https://mycafe.example/blog/news',
        })
    })

    it('rejects a custom domain that is not active before querying site content', async () => {
        // Arrange
        testState.find.mockResolvedValueOnce({
            docs: [{
                ...activeTenant,
                customDomains: [{
                    domain: 'mycafe.example',
                    status: 'pending',
                    isPrimary: true,
                }],
            }],
        })

        // Act
        const metadata = await generateProductMetadata({
            params: Promise.resolve({ slug: 'custom', productSlug: 'coffee-pending-domain' }),
        })

        // Assert
        expect(metadata).toEqual({ title: 'Not Found' })
        expect(testState.find).toHaveBeenCalledTimes(1)
    })

    it('rejects a custom detail route without forwarded host context before querying Payload', async () => {
        // Arrange
        testState.hostname = ''

        // Act
        const metadata = await generateBlogMetadata({
            params: Promise.resolve({ slug: 'custom', blogSlug: 'news-without-host' }),
        })

        // Assert
        expect(metadata).toEqual({ title: 'Post Not Found' })
        expect(testState.find).not.toHaveBeenCalled()
    })
})
