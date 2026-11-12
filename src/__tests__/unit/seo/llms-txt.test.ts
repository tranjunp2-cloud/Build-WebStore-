import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// ─── Mocks (top-level, before imports) ─────────────────────────────────

const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/seo/canonical', async () => {
    const actual = await vi.importActual<typeof import('@/lib/seo/canonical')>('@/lib/seo/canonical')

    return {
        ...actual,
        resolveStorefrontOrigin: vi.fn((tenant: any, opts: any) => {
            if (opts.fallbackHostname) return `https://${opts.fallbackHostname}`
            const slug = opts.slug || tenant.slug
            return `https://${slug}.primeweb.app`
        }),
    }
})

import { GET as getLlmsTxt } from '@/app/sites/[slug]/llms.txt/route'
// #2179: store availability has its own tests (store-unavailable.test.ts); every store is available here.
vi.mock('@/lib/storefront/cached-store-availability', () => ({
    isCachedStoreUnavailable: vi.fn(async () => false),
    storeUnavailableLocaleOf: vi.fn(async () => 'en'),
    storeUnavailableResponse: vi.fn(async () => null),
    storefrontUnavailableFor: vi.fn(async () => null),
}))
import { storefrontUnavailableFor } from '@/lib/storefront/cached-store-availability'

// ─── Test Suite ────────────────────────────────────────────────────────

/**
 * TC-F37-03: llms.txt content and structure
 *
 * Tests the llms.txt route for proper content formatting,
 * required sections (name, description, key pages), and contact info.
 */
describe('[TC-F37-03] llms.txt content contract', () => {
    beforeEach(() => {
        mockFind.mockReset()
    })

    it('TC-F09.282: unavailable store answers 503 noindex without reading content', async () => {
        // Arrange
        vi.mocked(storefrontUnavailableFor).mockResolvedValueOnce({ unavailable: true, locale: 'en' })

        // Act
        const response = await getLlmsTxt({ headers: new Map([['x-tenant-hostname', '']]) as any } as any, { params: Promise.resolve({ slug: 'mycafe' }) })

        // Assert
        expect(response.status).toBe(503)
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
        expect(mockFind).not.toHaveBeenCalled()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-12: 200 status with correct content-type
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-12: returns 200 with Content-Type: text/plain; charset=utf-8', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great coffee shop' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })     // tenants
            .mockResolvedValueOnce({ docs: [mockSite] })       // sites
            .mockResolvedValueOnce({ docs: [] })               // pages
            .mockResolvedValueOnce({ docs: [] })               // products
            .mockResolvedValueOnce({ docs: [] })               // blogs

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )

        // Assert
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-13: Site name heading
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-13: includes site name as markdown h1 heading', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'Premium Coffee House',
            seo: { metaDescription: 'Best coffee in town' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('# Premium Coffee House')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-14: Description section
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-14: includes site description in blockquote format', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'Freshly brewed coffee and pastries' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('> Freshly brewed coffee and pastries')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-15: Key Pages section heading
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-15: includes Key Pages section heading', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('## Key Pages')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-16: Key Pages are real, bounded, and deterministic
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-16: lists at most 10 real public URLs with deterministic content-type coverage', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
        }
        const mockPages = [
            ...Array.from({ length: 7 }, (_, index) => ({
                id: `p${index + 1}`,
                slug: `page-${index + 1}`,
                isHomepage: false,
                isVisible: true,
            })),
        ]
        const mockProducts = [
            { id: 'pr1', slug: 'espresso' },
            { id: 'pr2', slug: 'cappuccino' },
            { id: 'pr3', slug: 'latte' },
            { id: 'pr4', slug: 'mocha' },
        ]
        const mockBlogs = [
            { id: 'b1', slug: 'coffee-facts' },
            { id: 'b2', slug: 'brewing-guide' },
        ]

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: mockPages })
            .mockResolvedValueOnce({ docs: mockProducts })
            .mockResolvedValueOnce({ docs: mockBlogs })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        const urls = body
            .split('\n')
            .filter(line => line.startsWith('- http'))
            .map(line => line.slice(2))
        expect(urls).toEqual([
            'https://mycafe.primeweb.app',
            'https://mycafe.primeweb.app/page-1',
            'https://mycafe.primeweb.app/products/espresso',
            'https://mycafe.primeweb.app/blog/coffee-facts',
            'https://mycafe.primeweb.app/page-2',
            'https://mycafe.primeweb.app/products/cappuccino',
            'https://mycafe.primeweb.app/blog/brewing-guide',
            'https://mycafe.primeweb.app/page-3',
            'https://mycafe.primeweb.app/products/latte',
            'https://mycafe.primeweb.app/page-4',
        ])
        expect(urls).toHaveLength(10)
        expect(body).not.toContain('/products/mocha')
        expect(body).not.toContain('/page-5')
        expect(mockFind.mock.calls[2]?.[0]).toEqual(expect.objectContaining({ pagination: false, sort: ['createdAt', 'id'], select: { slug: true, isHomepage: true } }))
        expect(mockFind.mock.calls[3]?.[0]).toEqual(expect.objectContaining({ pagination: false, sort: ['createdAt', 'id'], select: { slug: true } }))
        expect(mockFind.mock.calls[4]?.[0]).toEqual(expect.objectContaining({ pagination: false, sort: ['createdAt', 'id'], select: { slug: true } }))
        expect(mockFind.mock.calls[2]?.[0]).not.toHaveProperty('limit')
        expect(mockFind.mock.calls[3]?.[0]).not.toHaveProperty('limit')
        expect(mockFind.mock.calls[4]?.[0]).not.toHaveProperty('limit')
        // The selector must skip a duplicate URL and continue filling from a
        // non-empty group when another content group has no candidates.
        mockFind.mockReset()
        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [
                { id: 'p1', slug: 'products/espresso', isHomepage: false },
                { id: 'p2', slug: 'about', isHomepage: false },
            ] })
            .mockResolvedValueOnce({ docs: [
                { id: 'pr1', slug: 'espresso' },
                { id: 'pr2', slug: 'latte' },
            ] })
            .mockResolvedValueOnce({ docs: [] })

        const partialResponse = await getLlmsTxt(
            { headers: new Map([['x-tenant-hostname', '']]) as any } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) },
        )
        const partialUrls = (await partialResponse.text())
            .split('\n')
            .filter(line => line.startsWith('- http'))
            .map(line => line.slice(2))
        expect(partialUrls).toEqual([
            'https://mycafe.primeweb.app',
            'https://mycafe.primeweb.app/products/espresso',
            'https://mycafe.primeweb.app/products/latte',
            'https://mycafe.primeweb.app/about',
        ])
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-17: URLs are properly formatted as markdown list items
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-17: lists URLs as markdown list items (- prefix)', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
        }
        const mockPages = [
            { id: 'p1', slug: 'about', isHomepage: false, isVisible: true },
        ]

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: mockPages })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — check for markdown list items with URL
        expect(body).toMatch(/- https?:\/\//)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-18: Contact section appears when contact info provided
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-18: includes Contact section when phone/email/address present', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            contactInfo: {
                phone: '555-1234',
                email: 'info@mycafe.com',
                address: '123 Main St',
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('## Contact')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-19: Phone in Contact section
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-19: lists phone in Contact section', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            contactInfo: {
                phone: '+65-9234-5678',
                email: undefined,
                address: undefined,
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('- Phone: +65-9234-5678')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-20: Email in Contact section
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-20: lists email in Contact section', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            contactInfo: {
                phone: undefined,
                email: 'hello@mycafe.com',
                address: undefined,
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('- Email: hello@mycafe.com')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-21: Address in Contact section
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-21: lists address in Contact section', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            contactInfo: {
                phone: undefined,
                email: undefined,
                address: '123 Nguyen Hue, Ho Chi Minh',
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('- Address: 123 Nguyen Hue, Ho Chi Minh')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-22: No Contact section when contactInfo empty
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-22: omits Contact section when no contact info provided', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            // no contactInfo
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).not.toContain('## Contact')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-32: Blogs/products queries scope by both tenant and site
    // (regression: public discovery must not leak records from another
    // tenant or sibling site into this site's llms.txt)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-32: scopes blogs and products queries by tenant.id and site.id', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] }) // pages
            .mockResolvedValueOnce({ docs: [] }) // products
            .mockResolvedValueOnce({ docs: [] }) // blogs

        // Act
        await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )

        // Assert — products call (3rd payload.find) and blogs call (4th) both scope by tenant.id and site.id
        const productsCall = mockFind.mock.calls[3][0]
        const blogsCall = mockFind.mock.calls[4][0]
        expect(JSON.stringify(productsCall.where)).toContain('"site":{"equals":"site-1"}')
        expect(JSON.stringify(productsCall.where)).toContain('"tenant":{"equals":"tenant-1"}')
        expect(JSON.stringify(blogsCall.where)).toContain('"site":{"equals":"site-1"}')
        expect(JSON.stringify(blogsCall.where)).toContain('"tenant":{"equals":"tenant-1"}')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-33: Opening Hours section (from US-F37-01 localBusiness)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-33: includes Opening Hours section with day + time range', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            localBusiness: {
                openingHours: [
                    { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false },
                    { dayOfWeek: 'Su', opens: '', closes: '', isClosed: true },
                ],
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('## Opening Hours')
        expect(body).toContain('- Monday: 09:00–18:00')
        expect(body).toContain('- Sunday: Closed')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-34: Omits Opening Hours section when no localBusiness data
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-34: omits Opening Hours section when localBusiness.openingHours is absent', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            // no localBusiness
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).not.toContain('## Opening Hours')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-35: Drops an opening-hours row that has a day but no
    // opens/closes and isn't marked closed (incomplete data, no fabrication)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-35: silently drops an incomplete opening-hours row (day set, no opens/closes, not closed)', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
            localBusiness: {
                openingHours: [
                    { dayOfWeek: 'Tu', opens: '', closes: '', isClosed: false },
                ],
            },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert — incomplete row produces no line, and the whole section is omitted
        expect(body).not.toContain('Tuesday')
        expect(body).not.toContain('## Opening Hours')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-23: Experimental notice comment at end
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-23: includes HTML comment about experimental standard at end', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: { metaDescription: 'A great cafe' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('<!-- llms.txt is an experimental')
        expect(body).toContain('emerging standard')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-24: 404 when no tenant found
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-24: returns 404 when tenant not found', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [] })  // no tenant

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'nonexistent' }) }
        )

        // Assert
        expect(response.status).toBe(404)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-25: 404 when no published site found
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-25: returns 404 when published site not found', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [] })  // no site

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )

        // Assert
        expect(response.status).toBe(404)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-31: A brand-new site exposes its real homepage without
    // fabricating transactional or nonexistent content URLs.
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-31: lists only the storefront home when no public content exists', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'newshop' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'Brand New Shop',
            seo: { metaDescription: 'Just launched' },
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] }) // pages
            .mockResolvedValueOnce({ docs: [] }) // products
            .mockResolvedValueOnce({ docs: [] }) // blogs

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'newshop' }) }
        )
        const body = await response.text()

        // Assert
        const urlMatches = body.match(/https?:\/\//g)
        expect(urlMatches).not.toBeNull()
        expect(urlMatches).toEqual(['https://'])
    })

    it('TC-F37-03-42: omits checkout and private order URLs from Key Pages', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'newshop' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'Brand New Shop',
            seo: { metaDescription: 'Just launched' },
        }
        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            { headers: new Map([['x-tenant-hostname', '']]) } as unknown as NextRequest,
            { params: Promise.resolve({ slug: 'newshop' }) },
        )
        const body = await response.text()

        // Assert
        expect(body).not.toContain('https://newshop.primeweb.app/checkout')
        expect(body).not.toContain('https://newshop.primeweb.app/orders')
    })

    it('TC-F37-03-48: keeps seller text inline and encodes public content slugs', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'safe-shop' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'Safe Cafe\n## Injected',
            seo: { metaDescription: 'Trusted\n- https://evil.example' },
            contactInfo: { address: 'Main Street\n## Fake Section' },
        }
        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [{ slug: 'offers\n## fake' }, { slug: '../admin' }] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [{ slug: 'nested/news' }] })

        // Act
        const response = await getLlmsTxt(
            { headers: new Map([['x-tenant-hostname', '']]) } as unknown as NextRequest,
            { params: Promise.resolve({ slug: 'safe-shop' }) },
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('# Safe Cafe \\#\\# Injected')
        expect(body).not.toContain('\n## Injected')
        expect(body).not.toContain('\n## Fake Section')
        expect(body).not.toContain('\n- https://evil.example')
        expect(body).toContain('/offers%0A%23%23%20fake')
        expect(body).not.toContain('/../admin')
        expect(body).not.toContain('/blog/nested/news')
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-26: Uses default fallback description when metaDescription missing
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-26: uses default Vietnamese description when metaDescription missing', async () => {
        // Arrange
        const mockTenant = { id: 'tenant-1', slug: 'mycafe' }
        const mockSite = {
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'published',
            name: 'My Cafe',
            seo: {},  // no metaDescription
        }

        mockFind
            .mockResolvedValueOnce({ docs: [mockTenant] })
            .mockResolvedValueOnce({ docs: [mockSite] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getLlmsTxt(
            {
                headers: new Map([['x-tenant-hostname', '']]) as any,
            } as any,
            { params: Promise.resolve({ slug: 'mycafe' }) }
        )
        const body = await response.text()

        // Assert
        expect(body).toContain('> My Cafe — cửa hàng trực tuyến')
    })
})
