import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { evaluateAuthoritativeLocalSeo, type LocalSeoPayload } from '@/lib/seo/local-seo-evaluation'

const PAGE_SIZE = 100
const ELIGIBLE_PAGE_COUNT = 1_001

const completeSite = {
    id: 'site-scale',
    tenant: { id: 'tenant-scale', slug: 'scale-fixture' },
    name: 'Scale Fixture',
    domain: 'https://scale.example.com',
    status: 'published',
    updatedAt: '2026-08-04T00:00:00.000Z',
    contactInfo: { phone: '+60123456789' },
    localBusiness: {
        streetAddress: '1 Jalan Scale',
        city: 'Kuala Lumpur',
        postcode: '50000',
        country: 'MY',
        businessCategory: 'foodEstablishment',
        schemaSubtype: 'Restaurant',
        priceRange: '$$',
        latitude: 3.139,
        longitude: 101.6869,
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

const eligiblePages = Array.from({ length: ELIGIBLE_PAGE_COUNT }, (_, index) => ({
    id: `page-${String(index + 1).padStart(4, '0')}`,
    title: `Scale page ${index + 1}`,
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    _status: 'published',
    seo: {
        title: `Scale title ${index + 1}`,
        description: `Scale description ${index + 1}`,
        noIndex: false,
    },
    layout: [
        {
            blockType: 'hero',
            headline: `Scale heading ${index + 1}`,
            content: 'word '.repeat(310),
        },
        { blockType: 'contact' },
    ],
}))

const EXPECTED_SITE_SELECT = {
    id: true,
    tenant: true,
    name: true,
    domain: true,
    status: true,
    updatedAt: true,
    contactInfo: true,
    localBusiness: true,
    seo: true,
}

const EXPECTED_COLLECTION_SELECT = {
    pages: {
        id: true,
        title: true,
        name: true,
        slug: true,
        isHomepage: true,
        createdAt: true,
        updatedAt: true,
        _status: true,
        seo: true,
        layout: true,
    },
    products: {
        id: true,
        name: true,
        title: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        seo: true,
        shortDescription: true,
        description: true,
        images: true,
    },
    blogs: {
        id: true,
        title: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        seo: true,
        excerpt: true,
    },
} satisfies Record<'pages' | 'products' | 'blogs', Record<string, boolean>>

describe('[TC-F37-04-19] Local SEO evaluator scale/query budget', () => {
    it('evaluates 1001 eligible records with deterministic 100-row pagination and two bounded snapshots', async () => {
        // Arrange
        const findByID = vi.fn().mockResolvedValue(completeSite)
        const find = vi.fn(
            async ({ collection, page, limit }: Parameters<LocalSeoPayload['find']>[0]) => {
                const records =
                    collection === 'sites'
                        ? [{ id: completeSite.id }]
                        : collection === 'pages'
                          ? eligiblePages
                          : []
                const currentPage = page ?? 1
                const start = (currentPage - 1) * limit
                const docs = records.slice(start, start + limit)
                return {
                    docs,
                    hasNextPage: start + limit < records.length,
                }
            },
        )
        const payload: LocalSeoPayload = { findByID, find }

        // Act
        const evaluation = await evaluateAuthoritativeLocalSeo(
            payload,
            'site-scale',
            'tenant-scale',
        )

        // Assert — this is a deterministic scale/query-budget gate, not a live
        // p95 latency measurement.
        expect(evaluation.response.score).toBe(100)
        expect(evaluation.response.breakdown).toEqual({
            businessData: 20,
            schema: 35,
            aiDiscoverability: 15,
            technicalHealth: 30,
        })
        expect(evaluation.metadataItems).toHaveLength(0)
        expect(findByID).toHaveBeenCalledTimes(2)
        expect(findByID).toHaveBeenNthCalledWith(1, {
            collection: 'sites',
            id: 'site-scale',
            depth: 1,
            disableErrors: true,
            select: EXPECTED_SITE_SELECT,
        })
        expect(findByID).toHaveBeenNthCalledWith(2, {
            collection: 'sites',
            id: 'site-scale',
            depth: 1,
            disableErrors: true,
            select: EXPECTED_SITE_SELECT,
        })
        expect(find).toHaveBeenCalledTimes(28)

        const calls = find.mock.calls.map(([args]) => args)
        const scoredCalls = calls.filter((args) => args.collection !== 'sites')
        expect(scoredCalls.every((args) => args.limit === PAGE_SIZE)).toBe(true)
        // TC-PERF-069: 100-row pages without Payload's COUNT per page (a short page ends the walk)
        expect(calls.every((args) => args.pagination === false)).toBe(true)
        for (const args of calls) {
            if (args.collection === 'sites') {
                expect(args).toMatchObject({
                    page: 1,
                    limit: 1,
                    depth: 0,
                    sort: ['createdAt', 'id'],
                    select: { id: true },
                    where: {
                        and: [
                            { tenant: { equals: 'tenant-scale' } },
                            { status: { equals: 'published' } },
                        ],
                    },
                })
            } else {
                expect(args.select).toEqual(EXPECTED_COLLECTION_SELECT[args.collection])
            }
        }
        expect(calls.filter((args) => args.collection === 'sites')).toHaveLength(2)
        const pageSelect = calls.find((args) => args.collection === 'pages')?.select
        const productSelect = calls.find((args) => args.collection === 'products')?.select
        const blogSelect = calls.find((args) => args.collection === 'blogs')?.select
        expect(pageSelect).toHaveProperty('layout', true)
        expect(pageSelect).not.toHaveProperty('images')
        expect(pageSelect).not.toHaveProperty('excerpt')
        expect(productSelect).toHaveProperty('images', true)
        expect(productSelect).not.toHaveProperty('layout')
        expect(productSelect).not.toHaveProperty('excerpt')
        expect(blogSelect).toHaveProperty('excerpt', true)
        expect(blogSelect).not.toHaveProperty('layout')
        expect(blogSelect).not.toHaveProperty('images')
        expect(
            calls.filter((args) => args.collection === 'pages').map((args) => args.page),
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        expect(
            calls.filter((args) => args.collection === 'products').map((args) => args.page),
        ).toEqual([1, 1])
        expect(
            calls.filter((args) => args.collection === 'blogs').map((args) => args.page),
        ).toEqual([1, 1])
    })
})
