/**
 * @fileoverview API coverage for the authoritative US-F37-04 score contract.
 * TC-IDs: TC-F37-04-01 through TC-F37-04-06, TC-F37-04-09,
 * TC-F37-04-15 through TC-F37-04-17
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    findByID: vi.fn(),
    find: vi.fn(),
    getCurrentUser: vi.fn(),
    checkRateLimit: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: mocks.findByID,
        find: mocks.find,
    }),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: mocks.checkRateLimit }))

import { GET } from '@/app/api/sites/[siteId]/local-seo-score/route'

const ownedSite = {
    id: 42,
    tenant: { id: 'tenant-1', slug: 'kedai-kopi-prime' },
    name: 'Kedai Kopi Prime',
    domain: 'https://kedai.example.com',
    status: 'published',
    updatedAt: '2026-08-04T00:00:00.000Z',
    contactInfo: { phone: '+60 12-345 6789' },
    localBusiness: {
        streetAddress: '12 Jalan Ampang',
        city: 'Kuala Lumpur',
        postcode: '50450',
        country: 'MY',
        businessCategory: 'foodEstablishment',
        schemaSubtype: 'Restaurant',
        priceRange: '$$',
        latitude: 3.1201,
        longitude: 101.6231,
        openingHours: [
            {
                dayOfWeek: 'Mo',
                opens: '09:00',
                closes: '17:00',
                isClosed: false,
            },
        ],
    },
    seo: { googleVerificationToken: 'verification-token' },
}

const completePage = {
    id: 101,
    title: 'Home',
    slug: 'home',
    isHomepage: true,
    _status: 'published',
    updatedAt: '2026-08-04T00:00:00.000Z',
    seo: {
        title: 'Kedai Kopi Prime',
        description: 'Fresh coffee in Kuala Lumpur.',
        noIndex: false,
    },
    layout: [
        {
            blockType: 'hero',
            headline: 'Fresh coffee',
            content: 'word '.repeat(310),
        },
        { blockType: 'contact' },
    ],
}
const completeProduct = {
    id: 201,
    name: 'House Blend',
    slug: 'house-blend',
    updatedAt: '2026-08-04T00:00:00.000Z',
    seo: { title: 'House Blend', description: 'Freshly roasted beans' },
    images: [{ alt: 'House blend coffee beans' }],
}
const completeBlog = {
    id: 301,
    title: 'Coffee guide',
    slug: 'coffee-guide',
    updatedAt: '2026-08-04T00:00:00.000Z',
    seo: {
        metaTitle: 'Coffee guide',
        metaDescription: 'How to brew better coffee',
    },
}

function makeRequest(query = ''): NextRequest {
    return new NextRequest(
        `http://localhost/api/sites/42/local-seo-score${query}`,
    )
}

function installCollectionResults(overrides?: {
    pages?: unknown[]
    products?: unknown[]
    blogs?: unknown[]
    publicRouteSites?: unknown[]
}) {
    const records = {
        pages: overrides?.pages ?? [completePage],
        products: overrides?.products ?? [completeProduct],
        blogs: overrides?.blogs ?? [completeBlog],
    }
    // pages like Payload: `page` / `limit` slice the rows (also with `pagination: false`, which only skips the count)
    mocks.find.mockImplementation(
        async ({ collection, page = 1, limit = 10 }: { collection: string; page?: number; limit?: number }) => {
            const rows =
                collection === 'sites'
                    ? (overrides?.publicRouteSites ?? [{ id: ownedSite.id }])
                    : records[collection as keyof typeof records]
            const docs = limit > 0 ? rows.slice((page - 1) * limit, page * limit) : rows
            return { docs, hasNextPage: limit > 0 && page * limit < rows.length }
        },
    )
}

describe('GET /api/sites/[siteId]/local-seo-score', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: 'tenant-1', status: 'active' }],
        })
        mocks.checkRateLimit.mockResolvedValue({ allowed: true })
        mocks.findByID.mockResolvedValue(ownedSite)
        installCollectionResults()
    })

    it('[TC-F37-04-09] returns the exact 20/35/15/30 score from one stable snapshot', async () => {
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(body).toMatchObject({
            success: true,
            score: 100,
            breakdown: {
                businessData: 20,
                schema: 35,
                aiDiscoverability: 15,
                technicalHealth: 30,
            },
            issues: [],
            aiFixableItemCount: 0,
        })
        expect(body.revisionToken).toMatch(/^[a-f0-9]{64}$/)
        expect(mocks.find).toHaveBeenCalledTimes(8)
    })

    it('uses Contact Info address and implicit Malaysia for Business Data and schema scoring', async () => {
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            contactInfo: {
                ...ownedSite.contactInfo,
                address: '88 Jalan Contact',
            },
            localBusiness: {
                ...ownedSite.localBusiness,
                streetAddress: null,
                country: null,
            },
        })

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.breakdown.businessData).toBe(20)
        expect(body.breakdown.schema).toBe(35)
        expect(body.issues).not.toContainEqual(
            expect.objectContaining({ code: 'business-address' }),
        )
    })

    it('[TC-F37-04-09] withholds sitemap and llms points when tenant route context is unavailable', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            tenant: { id: 'tenant-1' },
        })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(body.breakdown.aiDiscoverability).toBe(9)
        expect(body.score).toBe(94)
        expect(body.issues).toEqual([])
    })

    it('[TC-F37-04-09] withholds only sitemap points when its public records cannot serialize', async () => {
        // Arrange
        installCollectionResults({
            products: [{ ...completeProduct, updatedAt: 'not-a-date' }],
        })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(body.breakdown.aiDiscoverability).toBe(10)
        expect(body.score).toBe(95)
    })

    it('[TC-F37-04-09] withholds only llms.txt point when its document cannot serialize', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            localBusiness: {
                ...ownedSite.localBusiness,
                openingHours: [...ownedSite.localBusiness.openingHours, null],
            },
        })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(body.breakdown.aiDiscoverability).toBe(14)
        expect(body.score).toBe(99)
    })

    it('[TC-F37-04-09] keeps public-route facts scoped to its selected site', async () => {
        // Arrange — the tenant public route selects a different published site.
        installCollectionResults({ publicRouteSites: [{ id: 'site-oldest' }] })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(body.breakdown.aiDiscoverability).toBe(9)
        expect(body.score).toBe(94)
    })

    it('counts every affected Content Quality page and routes to the first one', async () => {
        installCollectionResults({
            pages: [
                completePage,
                {
                    ...completePage,
                    id: 102,
                    title: 'Thin page',
                    layout: [{ blockType: 'text', content: 'too short' }],
                },
                {
                    ...completePage,
                    id: 103,
                    title: 'Missing hero',
                    layout: [{ blockType: 'text', content: 'word '.repeat(310) }],
                },
            ],
        })

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()
        const issue = body.issues.find(
            (item: { code: string }) => item.code === 'content-quality',
        )

        expect(issue.count).toBe(2)
        expect(issue.action).toEqual({
            kind: 'edit-content',
            siteId: '42',
            pageId: '102',
        })
    })

    it('deduplicates incomplete address from all downstream Schema metrics', async () => {
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            localBusiness: { ...ownedSite.localBusiness, postcode: null },
        })

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        expect(body.score).toBe(60)
        expect(body.breakdown).toEqual({
            businessData: 12,
            schema: 3,
            aiDiscoverability: 15,
            technicalHealth: 30,
        })
        expect(body.issues).toEqual([
            {
                id: 'business-address',
                code: 'business-address',
                count: 1,
                action: { kind: 'edit-business-address', siteId: '42' },
            },
        ])
    })

    it('[TC-F37-04-17] emits one phone root cause without a duplicate schema telephone issue', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            contactInfo: { ...ownedSite.contactInfo, phone: null },
        })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.issues).toEqual([
            {
                id: 'phone',
                code: 'phone',
                count: 1,
                action: { kind: 'edit-phone', siteId: '42' },
            },
        ])
        expect(
            body.issues.map((issue: { code: string }) => issue.code),
        ).not.toContain('schema-telephone')
    })

    it('[TC-F37-04-17] emits one unpublished root cause without sitemap or llms issues', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({ ...ownedSite, status: 'draft' })
        installCollectionResults({ publicRouteSites: [] })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.issues).toEqual([
            {
                id: 'store-unpublished',
                code: 'store-unpublished',
                count: 1,
                action: { kind: 'publish-store', siteId: '42' },
            },
        ])
        const issueCodes = body.issues.map(
            (issue: { code: string }) => issue.code,
        )
        expect(issueCodes).not.toContain('sitemap')
        expect(issueCodes).not.toContain('llms')
    })

    it('[TC-F37-04-16] keeps aggregate metadata bounded and loads fix rows on demand', async () => {
        installCollectionResults({
            pages: [
                {
                    ...completePage,
                    seo: { ...completePage.seo, title: '', description: '' },
                },
            ],
        })

        const aggregateResponse = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const aggregate = await aggregateResponse.json()
        expect(aggregate.aiFixableItemCount).toBe(1)
        expect(
            aggregate.issues.map((issue: { code: string }) => issue.code),
        ).toEqual(['meta-description', 'meta-title'])
        expect(JSON.stringify(aggregate)).not.toContain('missingFields')

        const detailResponse = await GET(
            makeRequest('?detail=metadata&page=1'),
            {
                params: Promise.resolve({ siteId: '42' }),
            },
        )
        const detail = await detailResponse.json()
        expect(detail).toMatchObject({
            success: true,
            detail: 'metadata',
            page: 1,
            hasNextPage: false,
            items: [
                {
                    collection: 'pages',
                    id: '101',
                    title: 'Home',
                    missingFields: ['title', 'description'],
                },
            ],
        })
    })

    it('[TC-F37-04-16] bounds long source metadata at the detail response contract', async () => {
        // Arrange
        installCollectionResults({
            pages: [
                {
                    ...completePage,
                    title: 'L'.repeat(400),
                    seo: {
                        ...completePage.seo,
                        title: 'T'.repeat(600),
                        description: '',
                    },
                },
                {
                    ...completePage,
                    id: 102,
                    title: 'Second page',
                    seo: {
                        ...completePage.seo,
                        title: '',
                        description: 'D'.repeat(2_100),
                    },
                },
            ],
        })

        // Act
        const response = await GET(makeRequest('?detail=metadata&page=1'), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.items).toHaveLength(2)
        expect(body.items[0].title).toHaveLength(300)
        expect(body.items[0].currentTitle).toHaveLength(500)
        expect(body.items[1].currentDescription).toHaveLength(2_000)
    })

    it('[TC-F37-04-16] filters metadata before slicing a bounded 100-row detail page', async () => {
        // Arrange — the title-missing rows start after the first 100 unfiltered
        // records, so filtering after pagination would return the wrong batch.
        const descriptionOnly = Array.from({ length: 100 }, (_, index) => ({
            ...completePage,
            id: `description-${index + 1}`,
            title: `Description gap ${index + 1}`,
            seo: {
                ...completePage.seo,
                description: '',
            },
        }))
        const titleOnly = Array.from({ length: 105 }, (_, index) => ({
            ...completePage,
            id: `title-${index + 1}`,
            title: `Title gap ${index + 1}`,
            seo: {
                ...completePage.seo,
                title: '',
            },
        }))
        installCollectionResults({ pages: [...descriptionOnly, ...titleOnly] })

        // Act
        const firstResponse = await GET(
            makeRequest('?detail=metadata&page=1&field=title'),
            {
                params: Promise.resolve({ siteId: '42' }),
            },
        )
        const first = await firstResponse.json()
        const secondResponse = await GET(
            makeRequest('?detail=metadata&page=2&field=title'),
            {
                params: Promise.resolve({ siteId: '42' }),
            },
        )
        const second = await secondResponse.json()

        // Assert
        expect(firstResponse.status).toBe(200)
        expect(first.items).toHaveLength(100)
        expect(first.hasNextPage).toBe(true)
        expect(
            first.items.every(
                (item: { id: string; missingFields: string[] }) =>
                    item.id.startsWith('title-') &&
                    item.missingFields.includes('title'),
            ),
        ).toBe(true)
        expect(secondResponse.status).toBe(200)
        expect(second.items).toHaveLength(5)
        expect(second.hasNextPage).toBe(false)
        expect(
            second.items.every(
                (item: { id: string; missingFields: string[] }) =>
                    item.id.startsWith('title-') &&
                    item.missingFields.includes('title'),
            ),
        ).toBe(true)
    })

    it('[TC-F37-04-01] rejects unauthenticated requests before reading a site', async () => {
        mocks.getCurrentUser.mockResolvedValue(null)
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        expect(response.status).toBe(401)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })

    it.each(['pending', 'suspended'])(
        'rejects a matching %s tenant membership before evaluator collection reads',
        async (status) => {
            // Arrange
            mocks.getCurrentUser.mockResolvedValue({
                id: 'user-1',
                tenants: [{ tenant: 'tenant-1', status }],
            })

            // Act
            const response = await GET(makeRequest(), {
                params: Promise.resolve({ siteId: '42' }),
            })

            // Assert
            expect(response.status).toBe(403)
            expect(mocks.findByID).toHaveBeenCalledTimes(1)
            expect(mocks.find).not.toHaveBeenCalled()
        },
    )

    it('[TC-F37-04-02] rejects a site outside the current user tenant', async () => {
        mocks.findByID.mockResolvedValue({ ...ownedSite, tenant: 'tenant-2' })
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        expect(response.status).toBe(403)
        expect(mocks.find).not.toHaveBeenCalled()
    })

    it('[TC-F37-04-15] rejects a tenantless site before evaluator collection reads', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({ ...ownedSite, tenant: null })

        // Act
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })

        // Assert
        expect(response.status).toBe(403)
        expect(mocks.findByID).toHaveBeenCalledTimes(1)
        expect(mocks.find).not.toHaveBeenCalled()
    })

    it('returns 404 when the authorized site does not exist', async () => {
        mocks.findByID.mockResolvedValue(null)

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Site not found' })
        expect(mocks.find).not.toHaveBeenCalled()
    })

    it('rejects an invalid metadata detail page before site evaluation', async () => {
        const response = await GET(makeRequest('?detail=metadata&page=0'), {
            params: Promise.resolve({ siteId: '42' }),
        })

        expect(response.status).toBe(400)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })

    it.each(['?field=title', '?detail=metadata&field=keywords'])(
        'rejects invalid or orphan metadata field %s before site evaluation',
        async (query) => {
            // Arrange

            // Act
            const response = await GET(makeRequest(query), {
                params: Promise.resolve({ siteId: '42' }),
            })

            // Assert
            expect(response.status).toBe(400)
            expect(await response.json()).toEqual({
                error: 'Invalid metadata detail field',
            })
            expect(mocks.findByID).not.toHaveBeenCalled()
        },
    )

    it('sanitizes internal evaluator failures and returns no partial score', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        mocks.findByID.mockRejectedValue(new Error('secret database detail'))

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(JSON.stringify(body)).not.toContain('secret database detail')
        expect(body.score).toBeUndefined()
        expect(body.breakdown).toBeUndefined()
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
            'secret database detail',
        )
        errorSpy.mockRestore()
    })

    it('does not return a score when site ownership changes during evaluation', async () => {
        mocks.findByID
            .mockResolvedValueOnce(ownedSite)
            .mockResolvedValueOnce(ownedSite)
            .mockResolvedValueOnce({ ...ownedSite, tenant: 'tenant-2' })

        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.score).toBeUndefined()
        expect(body.breakdown).toBeUndefined()
    })

    it('returns 429 before expensive score evaluation', async () => {
        mocks.checkRateLimit.mockResolvedValue({ allowed: false })
        const response = await GET(makeRequest(), {
            params: Promise.resolve({ siteId: '42' }),
        })
        expect(response.status).toBe(429)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })
})
