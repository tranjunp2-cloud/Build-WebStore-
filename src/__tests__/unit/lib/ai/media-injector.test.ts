import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { planImageNeeds, fulfillImageNeeds, cleanupNonNumericImageFields, stripOrphanMediaRefs, computePoolBucketSizes } from '@/lib/ai/media-injector'
import { getAvatarMedia, batchFetchFromPool } from '@/lib/ai/media-pipeline'

// GH-1185: fulfillImageNeeds routes testimonials to the dedicated people-
// portrait search — mock the pipeline layer to observe routing.
vi.mock('@/lib/ai/media-pipeline', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAvatarMedia: vi.fn().mockResolvedValue({ mediaIds: [901, 902, 903], photos: [], failures: [] }),
    batchFetchFromPool: vi.fn().mockResolvedValue({ mediaIds: [1], photos: [], failures: [] }),
    getMediaForBlock: vi.fn().mockResolvedValue({ mediaIds: [], photos: [], failures: [] }),
}))

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.PIXABAY_BLOCKS = 'all'
})

afterEach(() => {
    delete process.env.PIXABAY_BLOCKS
})

describe('media-injector [plan-260414-unsplash]', () => {
    describe('planImageNeeds', () => {
        it('creates need for hero.backgroundImage when missing', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.blockType).toBe('hero')
            expect(needs[0]!.count).toBe(1)
        })

        it('skips hero when all top-level image fields are already numbers', () => {
            // Hero now has 2 top-level fields (image + backgroundImage). Both must
            // be filled with Media IDs to skip the need.
            const blocks = [{ blockType: 'hero', image: 42, backgroundImage: 43 }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(0)
        })

        it('shares ONE Media ID across all hero top-level image fields', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1) // ONE need, not 2
            needs[0]!.assign([99])
            expect(blocks[0]!.image).toBe(99)
            expect(blocks[0]!.backgroundImage).toBe(99)
        })

        it('pads gallery array to minCount when below', () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [{ caption: 'Photo 1' }, { caption: 'Photo 2' }],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBeGreaterThanOrEqual(6) // gallery minCount = 6
            // Array should be padded
            expect((blocks[0]!.images as unknown[]).length).toBe(6)
        })

        it('creates empty gallery array when missing', () => {
            const blocks = [{ blockType: 'gallery' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect((blocks[0]!.images as unknown[]).length).toBe(6)
        })

        it('creates need for team members[].image (Payload schema)', () => {
            const blocks = [
                {
                    blockType: 'team',
                    members: [
                        { name: 'Alice', role: 'CEO' },
                        { name: 'Bob', role: 'CTO' },
                        { name: 'Charlie', role: 'CFO' },
                    ],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBe(3)
            // Assign should set image field (not avatar)
            needs[0]!.assign([10, 20, 30])
            const members = blocks[0]!.members as Record<string, unknown>[]
            expect(members[0]!.image).toBe(10)
            expect(members[1]!.image).toBe(20)
            expect(members[2]!.image).toBe(30)
        })

        it('assign closure mutates block in place', () => {
            const blocks = [{ blockType: 'hero', headline: 'Test' }]
            const needs = planImageNeeds(blocks)
            needs[0]!.assign([123])
            expect(blocks[0]!.backgroundImage).toBe(123)
        })

        it('skips blocks without image spec', () => {
            const blocks = [
                { blockType: 'faq', items: [] },
                { blockType: 'cta', headline: 'Test' },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(0)
        })

        it('handles multiple blocks with mixed needs', () => {
            const blocks = [
                { blockType: 'hero', headline: 'H' },
                { blockType: 'about', headline: 'A' },
                { blockType: 'team', members: [{ name: 'X' }] },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(3)
        })

        it('hero-only default: skips non-hero blocks when PIXABAY_BLOCKS unset', () => {
            delete process.env.PIXABAY_BLOCKS
            const blocks = [
                { blockType: 'hero', headline: 'H' },
                { blockType: 'about', headline: 'A' },
                { blockType: 'gallery', images: [{ caption: 'X' }] },
                { blockType: 'team', members: [{ name: 'X' }] },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.blockType).toBe('hero')
        })

        it('TC-F38-RAW-21: logo-cloud skipped even when PIXABAY_BLOCKS=all', () => {
            // GH-1185: logo-cloud is NO_STOCK_BLOCKS — should not emit image needs
            // even with PIXABAY_BLOCKS=all
            process.env.PIXABAY_BLOCKS = 'all'
            const blocks = [
                { blockType: 'logo-cloud', logos: [{ name: 'Brand A' }, { name: 'Brand B' }] },
                { blockType: 'hero', headline: 'H' },
            ]
            const needs = planImageNeeds(blocks)
            // Only hero should need images, logo-cloud skipped
            expect(needs.length).toBe(1)
            expect(needs[0]!.blockType).toBe('hero')
        })
    })

    describe('cleanupNonNumericImageFields', () => {
        it('deletes hero.backgroundImage if still a string', () => {
            const blocks = [{ blockType: 'hero', backgroundImage: 'https://fail.com/img.jpg' }]
            cleanupNonNumericImageFields(blocks)
            expect(blocks[0]!.backgroundImage).toBeUndefined()
        })

        it('preserves hero.backgroundImage if it is a number', () => {
            const blocks = [{ blockType: 'hero', backgroundImage: 42 }]
            cleanupNonNumericImageFields(blocks)
            expect(blocks[0]!.backgroundImage).toBe(42)
        })

        it('deletes gallery image object (Zod shape) if not number', () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [
                        { image: { url: 'x', alt: 'y' }, caption: 'a' },
                        { image: 99, caption: 'b' },
                    ],
                },
            ]
            cleanupNonNumericImageFields(blocks)
            const items = blocks[0]!.images as Record<string, unknown>[]
            expect(items[0]!.image).toBeUndefined() // Object deleted
            expect(items[1]!.image).toBe(99) // Number preserved
            expect(items[0]!.caption).toBe('a') // Other fields untouched
        })

        it('deletes team member image if string (nested cleanup)', () => {
            const blocks = [
                {
                    blockType: 'team',
                    members: [
                        { name: 'Alice', image: 'https://x.com/a.jpg' },
                        { name: 'Bob', image: 55 },
                    ],
                },
            ]
            cleanupNonNumericImageFields(blocks)
            const members = blocks[0]!.members as Record<string, unknown>[]
            expect(members[0]!.image).toBeUndefined()
            expect(members[1]!.image).toBe(55)
        })

        it('handles blocks without image spec gracefully', () => {
            const blocks = [{ blockType: 'faq', items: [{ question: 'Q', answer: 'A' }] }]
            expect(() => cleanupNonNumericImageFields(blocks)).not.toThrow()
        })
    })

    // Plan 260415 F01-gen-audit — stripOrphanMediaRefs must now require
    // filename + mimeType + filesize>0 (not filename || url). The previous
    // predicate missed rows that passed Payload's create hook but then failed
    // the S3 PUT, leaving the row "present" but unusable — caller would then
    // try to insert a FK referencing the incomplete row and the whole page
    // create would 500.
    describe('stripOrphanMediaRefs', () => {
        const mockFinder = (docs: Array<Record<string, unknown>>) => ({
            find: vi.fn(async () => ({ docs })),
        })

        it('keeps refs when media row has filename+mimeType+filesize', async () => {
            const blocks = [{ blockType: 'hero', image: 10, backgroundImage: 10 }]
            const finder = mockFinder([
                { id: 10, filename: 'hero.jpg', mimeType: 'image/jpeg', filesize: 12345, url: '/media/hero.jpg' },
            ])
            const { stripped, checked } = await stripOrphanMediaRefs(blocks, finder)
            expect(checked).toBe(1)
            expect(stripped).toBe(0)
            expect(blocks[0]!.image).toBe(10)
            expect(blocks[0]!.backgroundImage).toBe(10)
        })

        it('strips refs when filesize is 0 (S3 PUT failed after row insert)', async () => {
            const blocks = [{ blockType: 'hero', image: 11, backgroundImage: 11 }]
            const finder = mockFinder([
                // Simulates Payload+S3 failure mode: filename populated by hook,
                // url virtual, but the actual upload never landed → filesize=0.
                { id: 11, filename: 'hero.jpg', mimeType: 'image/jpeg', filesize: 0, url: '/media/hero.jpg' },
            ])
            const { stripped } = await stripOrphanMediaRefs(blocks, finder)
            expect(stripped).toBe(2) // both image + backgroundImage stripped
            expect(blocks[0]!.image).toBeUndefined()
            expect(blocks[0]!.backgroundImage).toBeUndefined()
        })

        it('strips refs when mimeType is missing', async () => {
            const blocks = [{ blockType: 'about', image: 12 }]
            const finder = mockFinder([
                { id: 12, filename: 'about.jpg', filesize: 9999, url: '/media/about.jpg' },
            ])
            const { stripped } = await stripOrphanMediaRefs(blocks, finder)
            expect(stripped).toBe(1)
            expect((blocks[0] as Record<string, unknown>).image).toBeUndefined()
        })

        it('strips refs when media row is missing entirely (rolled back)', async () => {
            const blocks = [{ blockType: 'hero', image: 13, backgroundImage: 14 }]
            const finder = mockFinder([]) // both rows absent
            const { stripped, checked } = await stripOrphanMediaRefs(blocks, finder)
            expect(checked).toBe(2)
            expect(stripped).toBe(2)
            expect(blocks[0]!.image).toBeUndefined()
            expect(blocks[0]!.backgroundImage).toBeUndefined()
        })

        it('strips nested gallery images while keeping valid ones', async () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [
                        { caption: 'Good', image: 20 },
                        { caption: 'Bad', image: 21 },
                        { caption: 'AlsoGood', image: 22 },
                    ],
                },
            ]
            const finder = mockFinder([
                { id: 20, filename: 'a.jpg', mimeType: 'image/jpeg', filesize: 100 },
                { id: 21, filename: 'b.jpg', mimeType: 'image/jpeg', filesize: 0 }, // failed upload
                { id: 22, filename: 'c.jpg', mimeType: 'image/jpeg', filesize: 100 },
            ])
            const { stripped } = await stripOrphanMediaRefs(blocks, finder)
            expect(stripped).toBe(1)
            const images = blocks[0]!.images as Array<Record<string, unknown>>
            expect(images[0]!.image).toBe(20)
            expect(images[1]!.image).toBeUndefined()
            expect(images[2]!.image).toBe(22)
        })

        it('no-op when blocks reference no media', async () => {
            const blocks = [{ blockType: 'hero', headline: 'Hi' }]
            const finder = mockFinder([])
            const { stripped, checked } = await stripOrphanMediaRefs(blocks, finder)
            expect(checked).toBe(0)
            expect(stripped).toBe(0)
            expect(finder.find).not.toHaveBeenCalled()
        })
    })

    describe('fulfillImageNeeds — testimonials avatar routing [TC-F38-RAW-13]', () => {
        it('routes testimonials to getAvatarMedia (people portraits), never the pool', async () => {
            // Arrange — 3 testimonial items without avatars
            const blocks = [
                {
                    blockType: 'testimonials',
                    testimonials: [{ quote: 'a', name: 'A' }, { quote: 'b', name: 'B' }, { quote: 'c', name: 'C' }],
                },
            ]
            const needs = planImageNeeds(blocks)
            const ctx = {
                businessName: 'Cơm Ba Má',
                tenantId: '1',
                category: 'restaurant',
                language: 'vi' as const,
                // Pool present — testimonials must STILL bypass it
                pool: { queryUsed: 'x', landscape: [], square: [{ id: 'p1', url: 'u', alt: 'food' }], underfill: false },
            }

            // Act
            await fulfillImageNeeds(needs, ctx as never, {} as never)

            // Assert — avatars come from the portrait search, pool untouched
            expect(vi.mocked(getAvatarMedia)).toHaveBeenCalledWith(3, 'vi', expect.anything(), expect.anything(), 'testimonials')
            expect(vi.mocked(batchFetchFromPool)).not.toHaveBeenCalled()
            const items = blocks[0]!.testimonials as Array<Record<string, unknown>>
            expect(items.map((i) => i.avatar)).toEqual([901, 902, 903])
        })

        it('[TC-F38-RAW-14] routes team members to getAvatarMedia too, pool untouched', async () => {
            // Arrange — 3 team members without images
            const blocks = [
                {
                    blockType: 'team',
                    members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
                },
            ]
            const needs = planImageNeeds(blocks)
            const ctx = {
                businessName: 'Spa Sen',
                tenantId: '1',
                category: 'beauty',
                language: 'vi' as const,
                pool: { queryUsed: 'x', landscape: [], square: [{ id: 'p1', url: 'u', alt: 'gel' }], underfill: false },
            }

            // Act
            await fulfillImageNeeds(needs, ctx as never, {} as never)

            // Assert
            expect(vi.mocked(getAvatarMedia)).toHaveBeenCalledWith(3, 'vi', expect.anything(), expect.anything(), 'team')
            expect(vi.mocked(batchFetchFromPool)).not.toHaveBeenCalled()
            const members = blocks[0]!.members as Array<Record<string, unknown>>
            expect(members.map((m) => m.image)).toEqual([901, 902, 903])
        })
    })
})

describe('computePoolBucketSizes — pool sized to enabled blocks', () => {
	afterEach(() => {
		delete process.env.PIXABAY_BLOCKS
	})

	it('default (hero-only) → 3 landscape, 0 square instead of fixed 12+6', () => {
		delete process.env.PIXABAY_BLOCKS // default set = {hero}
		// hero: top-level (1 slot) on the landscape bucket. base 1 → +2 = 3.
		// No square-role block enabled → square bucket skipped (0).
		expect(computePoolBucketSizes()).toEqual({ landscape: 3, square: 0, landscapeMin: 1, squareMin: 0 })
	})

	it('gallery-only → landscape sized to gallery minCount (6) + buffer, square 0', () => {
		process.env.PIXABAY_BLOCKS = 'gallery'
		// gallery nested minCount 6 → ceil(6*1.4)=9 (> 6+2=8). Landscape bucket.
		// GH-1611: landscapeMin = the raw gallery need (6) — the pool is only "filled"
		// once it can serve the hungriest block, not at half the bucket.
		expect(computePoolBucketSizes()).toEqual({ landscape: 9, square: 0, landscapeMin: 6, squareMin: 0 })
	})

	it('products-grid-only → square sized to products minCount (4) + buffer, landscape 0', () => {
		process.env.PIXABAY_BLOCKS = 'products-grid'
		// products-grid nested minCount 4 → max(4+2=6, ceil(5.6)=6)=6, cap 6.
		expect(computePoolBucketSizes()).toEqual({ landscape: 0, square: 6, landscapeMin: 0, squareMin: 4 })
	})

	it('people-only blocks → both buckets 0 (avatars use getAvatarMedia, not the pool)', () => {
		process.env.PIXABAY_BLOCKS = 'team,testimonials'
		expect(computePoolBucketSizes()).toEqual({ landscape: 0, square: 0, landscapeMin: 0, squareMin: 0 })
	})

	it('never exceeds the legacy 12/6 caps even with every block enabled', () => {
		process.env.PIXABAY_BLOCKS = 'all'
		const sizes = computePoolBucketSizes()
		expect(sizes.landscape).toBeLessThanOrEqual(12)
		expect(sizes.square).toBeLessThanOrEqual(6)
		// still strictly smaller than the old fixed fetch in the common config
		expect(sizes.landscape).toBeGreaterThan(0)
	})

	it('accepts an explicit enabled set (pure function, no env read)', () => {
		expect(computePoolBucketSizes(new Set(['hero']))).toEqual({ landscape: 3, square: 0, landscapeMin: 1, squareMin: 0 })
	})
})
