import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    planImageNeeds,
    planF38FinalPageImageNeeds,
    dedupeF38FinalPageMediaIds,
    fulfillImageNeeds,
    cleanupNonNumericImageFields,
    stripOrphanMediaRefs,
    computePoolBucketSizes,
    computePoolTargetsForNeeds,
} from '@/lib/ai/media-injector'
import { getAvatarMedia, batchFetchFromPool, getMediaForBlock, getCuratedFallbackMedia } from '@/lib/ai/media-pipeline'

// GH-1185: fulfillImageNeeds routes testimonials to the dedicated people-
// portrait search — mock the pipeline layer to observe routing.
vi.mock('@/lib/ai/media-pipeline', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAvatarMedia: vi.fn().mockResolvedValue({ mediaIds: [901, 902, 903], photos: [], failures: [] }),
    batchFetchFromPool: vi.fn().mockResolvedValue({ mediaIds: [1], photos: [], failures: [] }),
    getMediaForBlock: vi.fn().mockResolvedValue({ mediaIds: [], photos: [], failures: [] }),
    getCuratedFallbackMedia: vi.fn().mockResolvedValue({ mediaIds: [], photos: [], failures: [] }),
}))

beforeEach(() => {
    vi.clearAllMocks()
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

        it('GH-1621: does NOT pad gallery array to minCount — only injects images for AI-generated items', () => {
            const blocks = [
                {
                    blockType: 'gallery',
                    images: [{ caption: 'Photo 1' }, { caption: 'Photo 2' }],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBe(2) // NOT padded to minCount=6
            expect((blocks[0]!.images as unknown[]).length).toBe(2)
        })

        it('GH-1621: skips block entirely when array field missing — never fabricates empty items', () => {
            const blocks = [{ blockType: 'gallery' }]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(0)
            expect(blocks[0]!.images).toBeUndefined()
        })

        it('GH-1621: portfolio-grid — never pads to minCount=6, and assign() only ever touches the image field (title backfill is normalize-required-titles.ts\'s job, not this function\'s)', () => {
            // Old padding pushed `{}` placeholders that only ever received an `image`
            // via assign() below — so any padded item's `title` stayed empty forever.
            // This test proves two separate things: (1) no synthetic items get created
            // (4 stays 4, not padded to minCount=6), and (2) assign() genuinely never
            // reads or writes `title` — a real AI-omitted title (item 2) is left exactly
            // as the AI produced it, neither fabricated nor silently dropped.
            const blocks = [
                {
                    blockType: 'portfolio-grid',
                    projects: [
                        { title: 'Project A' },
                        {}, // AI omitted title — media-injector must not care or touch it
                    ],
                },
            ]
            const needs = planImageNeeds(blocks)
            expect(needs.length).toBe(1)
            expect(needs[0]!.count).toBe(2) // NOT padded to minCount=6
            needs[0]!.assign([1, 2])
            const projects = blocks[0]!.projects as Record<string, unknown>[]
            expect(projects.length).toBe(2)
            expect(projects[0]!.title).toBe('Project A') // untouched
            expect(projects[1]!.title).toBeUndefined() // media-injector does not backfill titles
            expect(projects[0]!.image).toBe(1)
            expect(projects[1]!.image).toBe(2)
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

    describe('F38 final-page image planning', () => {
        it('TC-F38-RES-08: plans every persisted non-logo upload slot when PIXABAY_BLOCKS is unset', () => {
            // Arrange
            delete process.env.PIXABAY_BLOCKS
            const pages = [{
                layout: [
                    { blockType: 'hero', image: 1, backgroundImage: 1 },
                    { blockType: 'about', image: 2 },
                    { blockType: 'gallery', images: [{ image: 3 }, { image: 4 }] },
                    { blockType: 'portfolio-grid', projects: [{ image: 5 }] },
                    { blockType: 'team', members: [{ image: 6 }] },
                    { blockType: 'testimonials', testimonials: [{ avatar: 7 }] },
                    { blockType: 'property-card', properties: [{ image: 8 }] },
                    { blockType: 'carousel', items: [{ image: 9 }] },
                    { blockType: 'social-proof', reviews: [{ avatar: 10 }] },
                    { blockType: 'video', posterImage: 11 },
                    {
                        blockType: 'menu-food',
                        categories: [
                            { items: [{ image: 12 }, { image: 13 }] },
                        ],
                    },
                    { blockType: 'logo-cloud', logos: [{ logo: 14 }] },
                    {
                        blockType: 'before-after',
                        beforeImage: { url: 'https://example.com/before.jpg' },
                    },
                ],
            }]

            // Act
            const needs = planF38FinalPageImageNeeds(pages)

            // Assert
            expect(needs).toHaveLength(11)
            expect(needs.reduce((sum, need) => sum + need.count, 0)).toBe(13)
            expect(needs.map((need) => [need.blockType, need.reservoir, need.count])).toEqual([
                ['hero', 'landscape', 1],
                ['about', 'landscape', 1],
                ['gallery', 'landscape', 2],
                ['portfolio-grid', 'square', 1],
                ['team', 'people', 1],
                ['testimonials', 'people', 1],
                ['property-card', 'landscape', 1],
                ['carousel', 'landscape', 1],
                ['social-proof', 'people', 1],
                ['video', 'landscape', 1],
                ['menu-food', 'products', 2],
            ])
            expect((pages[0]!.layout[0] as Record<string, unknown>).image).toBeUndefined()
            expect((pages[0]!.layout[0] as Record<string, unknown>).backgroundImage).toBeUndefined()
            expect((pages[0]!.layout[11] as Record<string, unknown>).logos).toEqual([{ logo: 14 }])
        })

        it('TC-F38-REUSE-02: assigns distinct IDs to repeated blocks on cloned pages', () => {
            // Arrange
            const baseLayout = [
                { blockType: 'hero', image: 10, backgroundImage: 10 },
                { blockType: 'gallery', images: [{ image: 11 }, { image: 12 }] },
            ]
            const pages = [
                { layout: structuredClone(baseLayout) },
                { layout: structuredClone(baseLayout) },
            ]
            const needs = planF38FinalPageImageNeeds(pages)

            // Act
            let nextId = 101
            for (const need of needs) {
                need.assign(Array.from({ length: need.count }, () => nextId++))
            }

            // Assert
            const firstHero = pages[0]!.layout[0] as Record<string, unknown>
            const secondHero = pages[1]!.layout[0] as Record<string, unknown>
            expect(firstHero.image).toBe(101)
            expect(firstHero.backgroundImage).toBe(101)
            expect(secondHero.image).toBe(104)
            expect(secondHero.backgroundImage).toBe(104)
            const assigned = pages.flatMap((page) => {
                const hero = page.layout[0] as Record<string, unknown>
                const gallery = page.layout[1] as { images: Array<{ image?: number }> }
                return [hero.image as number, ...gallery.images.map((item) => item.image!)]
            })
            expect(assigned).toEqual([101, 102, 103, 104, 105, 106])
            expect(new Set(assigned).size).toBe(6)
        })

        it('TC-F38-REUSE-02: final guard keeps the first logical slot and clears later duplicate Media IDs', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero', image: 77, backgroundImage: 77 },
                        { blockType: 'gallery', images: [{ image: 78 }] },
                    ],
                },
                {
                    layout: [
                        { blockType: 'hero', image: 77, backgroundImage: 77 },
                        { blockType: 'gallery', images: [{ image: 78 }, { image: 79 }] },
                    ],
                },
            ]

            // Act
            const result = dedupeF38FinalPageMediaIds(pages)

            // Assert
            const firstHero = pages[0]!.layout[0] as Record<string, unknown>
            const secondHero = pages[1]!.layout[0] as Record<string, unknown>
            const secondGallery = pages[1]!.layout[1] as { images: Array<{ image?: number }> }
            expect(firstHero).toMatchObject({ image: 77, backgroundImage: 77 })
            expect(secondHero.image).toBeUndefined()
            expect(secondHero.backgroundImage).toBeUndefined()
            expect(secondGallery.images.map((item) => item.image)).toEqual([undefined, 79])
            expect(result.removed).toBe(2)
            expect(result.usedMediaIds).toEqual(new Set([77, 78, 79]))
        })

        it('TC-F38-FALLBACK-03: assignment clears reservoir overflow instead of recycling an image', () => {
            // Arrange
            const pages = [{
                layout: [
                    { blockType: 'hero', image: 1, backgroundImage: 1 },
                    {
                        blockType: 'gallery',
                        images: [{ image: 2 }, { image: 3 }, { image: 4 }],
                    },
                ],
            }]
            const needs = planF38FinalPageImageNeeds(pages)

            // Act
            needs[0]!.assign([])
            needs[1]!.assign([201])

            // Assert
            const hero = pages[0]!.layout[0] as Record<string, unknown>
            const gallery = pages[0]!.layout[1] as { images: Array<{ image?: number }> }
            expect(hero.image).toBeUndefined()
            expect(hero.backgroundImage).toBeUndefined()
            expect(gallery.images.map((item) => item.image)).toEqual([201, undefined, undefined])
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
        it('[TC-GENPERF-W3-27] fills a failed Pixabay gallery from persisted curated media without duplicates', async () => {
            const blocks = [{
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, index) => ({ caption: `Photo ${index + 1}` })),
            }]
            vi.mocked(getMediaForBlock).mockResolvedValueOnce({
                mediaIds: [],
                photos: [],
                failures: [{ photoId: 'search', error: 'SERVER_ERROR' }],
            })
            vi.mocked(getCuratedFallbackMedia).mockResolvedValueOnce({
                mediaIds: [201, 202, 203, 204, 205, 206],
                photos: [],
                failures: [],
            })

            const result = await fulfillImageNeeds(planImageNeeds(blocks), {
                businessName: 'Fallback Bakery', tenantId: '1', category: 'restaurant',
            }, {} as never)

            expect(result).toEqual({ succeeded: 6, failed: 0 })
            const assigned = (blocks[0]!.images as Array<{ image?: number }>).map(item => item.image)
            expect(assigned).toEqual([201, 202, 203, 204, 205, 206])
            expect(new Set(assigned).size).toBe(6)
        })

        it('[TC-GENPERF-W3-10] assigns distinct gallery image sets across pages', async () => {
            const makeGallery = () => ({
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, index) => ({ caption: `Photo ${index + 1}` })),
            })
            const blocks = [makeGallery(), makeGallery()]
            const needs = planImageNeeds(blocks)
            const mediaIds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({ mediaIds, photos: [], failures: [] })
            const poolPhotos = mediaIds.map((id) => ({
                id: String(id), url: `https://cdn.pixabay.com/${id}.jpg`, alt: 'spa',
                width: 1200, height: 800, photographer: 'A', role: 'gallery' as const, aspectRatio: '4:3' as const,
            }))

            const result = await fulfillImageNeeds(needs, {
                businessName: 'Lumi Skin Studio', tenantId: '1', category: 'beauty',
                pool: { queryUsed: 'spa', landscape: poolPhotos, square: [], portrait: [], underfill: false },
            }, {} as never)

            expect(vi.mocked(batchFetchFromPool)).toHaveBeenCalledWith(
                expect.any(Array), 'gallery', expect.anything(), expect.anything(),
            )
            expect((vi.mocked(batchFetchFromPool).mock.calls[0]![0] as unknown[])).toHaveLength(12)
            expect(blocks[0]!.images.map((item) => item.image)).toEqual(mediaIds.slice(0, 6))
            expect(blocks[1]!.images.map((item) => item.image)).toEqual(mediaIds.slice(6, 12))
            expect(result).toEqual({ succeeded: 12, failed: 0 })
        })

        it('[TC-GENPERF-W3-15] assigns a different pool image to each page hero', async () => {
            const blocks = [
                { blockType: 'hero', headline: 'Home' },
                { blockType: 'hero', headline: 'About' },
            ]
            const mediaIds = [201, 202]
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({ mediaIds, photos: [], failures: [] })
            const poolPhotos = mediaIds.map((id) => ({
                id: String(id), url: `https://cdn.pixabay.com/${id}.jpg`, alt: 'bakery',
                width: 1200, height: 800, photographer: 'A', role: 'hero' as const, aspectRatio: '16:9' as const,
            }))

            const result = await fulfillImageNeeds(planImageNeeds(blocks), {
                businessName: 'Butter & Bloom', tenantId: '1', category: 'fnb',
                pool: { queryUsed: 'bakery', landscape: poolPhotos, square: [], portrait: [], underfill: false },
            }, {} as never)

            expect(blocks[0]!.image).toBe(201)
            expect(blocks[0]!.backgroundImage).toBe(201)
            expect(blocks[1]!.image).toBe(202)
            expect(blocks[1]!.backgroundImage).toBe(202)
            expect(result).toEqual({ succeeded: 2, failed: 0 })
        })

        it('[TC-GENPERF-W3-16] rotates gallery windows when the pool cannot fully separate them', async () => {
            const makeGallery = () => ({
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, index) => ({ caption: `Photo ${index + 1}` })),
            })
            const blocks = [makeGallery(), makeGallery()]
            const mediaIds = [301, 302, 303, 304, 305, 306, 307, 308, 309]
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({ mediaIds, photos: [], failures: [] })
            const poolPhotos = mediaIds.map((id) => ({
                id: String(id), url: `https://cdn.pixabay.com/${id}.jpg`, alt: 'seafood',
                width: 1200, height: 800, photographer: 'A', role: 'gallery' as const, aspectRatio: '4:3' as const,
            }))

            await fulfillImageNeeds(planImageNeeds(blocks), {
                businessName: 'Ocean Table', tenantId: '1', category: 'restaurant',
                pool: { queryUsed: 'seafood', landscape: poolPhotos, square: [], portrait: [], underfill: true },
            }, {} as never)

            const first = blocks[0]!.images.map((item) => item.image)
            const second = blocks[1]!.images.map((item) => item.image)
            expect(new Set(first).size).toBe(6)
            expect(new Set(second).size).toBe(6)
            expect(second).not.toEqual(first)
            expect(second).toEqual([307, 308, 309, 301, 302, 303])
        })

        it('[TC-GENPERF-W3-19] does not repeat a gallery window before exhausting pool rotations', async () => {
            const makeGallery = () => ({
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, index) => ({ caption: `Photo ${index + 1}` })),
            })
            const blocks = Array.from({ length: 5 }, makeGallery)
            const mediaIds = Array.from({ length: 12 }, (_, index) => 401 + index)
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({ mediaIds, photos: [], failures: [] })
            const poolPhotos = mediaIds.map((id) => ({
                id: String(id), url: `https://cdn.pixabay.com/${id}.jpg`, alt: 'bakery',
                width: 1200, height: 800, photographer: 'A', role: 'gallery' as const, aspectRatio: '4:3' as const,
            }))

            await fulfillImageNeeds(planImageNeeds(blocks), {
                businessName: 'Butter & Bloom', tenantId: '1', category: 'fnb',
                pool: { queryUsed: 'bakery', landscape: poolPhotos, square: [], portrait: [], underfill: true },
            }, {} as never)

            const windows = blocks.map((block) => block.images.map((item) => item.image).join(','))
            expect(new Set(windows).size).toBe(windows.length)
        })

        it('[TC-GENPERF-W3-12] partial pool does not legacy-search duplicate photos', async () => {
            const makeGallery = () => ({
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, index) => ({ caption: `Photo ${index + 1}` })),
            })
            const blocks = [makeGallery(), makeGallery()]
            const mediaIds = [101, 102, 103, 104, 105]
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({ mediaIds, photos: [], failures: [] })
            const poolPhotos = mediaIds.map((id) => ({
                id: String(id), url: `https://cdn.pixabay.com/${id}.jpg`, alt: 'seafood',
                width: 1200, height: 800, photographer: 'A', role: 'gallery' as const, aspectRatio: '4:3' as const,
            }))

            const result = await fulfillImageNeeds(planImageNeeds(blocks), {
                businessName: 'Hai San Bien Dong', tenantId: '1', category: 'restaurant',
                pool: { queryUsed: 'seafood', landscape: poolPhotos, square: [], portrait: [], underfill: true },
            }, {} as never)

            expect(vi.mocked(getMediaForBlock)).not.toHaveBeenCalled()
            for (const block of blocks) {
                expect(block.images.slice(0, 5).map((item) => item.image)).toEqual(mediaIds)
                expect(block.images[5]!.image).toBeUndefined()
            }
            expect(result).toEqual({ succeeded: 10, failed: 2 })
        })

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

    describe('fulfillImageNeeds — verified pool provenance [TC-GH1611-18]', () => {
        it('fills a gallery deficit with curated same-industry images instead of legacy search', async () => {
            // Arrange — reproduce QA: six gallery slots, but only four verified
            // bakery pool photos survive download/upload.
            const blocks = [{
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, i) => ({ caption: `Cake ${i + 1}` })),
            }]
            const needs = planImageNeeds(blocks)
            vi.mocked(batchFetchFromPool).mockResolvedValueOnce({
                mediaIds: [101, 102, 103, 104],
                photos: [],
                failures: [
                    { photoId: 'cake-5', error: 'upload failed' },
                    { photoId: 'cake-6', error: 'upload failed' },
                ],
            })
            vi.mocked(getMediaForBlock).mockResolvedValueOnce({
                mediaIds: [901, 902], // would represent the two off-industry photos
                photos: [],
                failures: [],
            })
            vi.mocked(getCuratedFallbackMedia).mockResolvedValueOnce({
                mediaIds: [201, 202],
                photos: [],
                failures: [],
            })
            const ctx = {
                businessName: 'Tiệm Bánh QA',
                tenantId: '1',
                category: 'fnb',
                products: ['bánh'],
                pool: {
                    queryUsed: 'cake',
                    landscape: Array.from({ length: 6 }, (_, i) => ({
                        id: `cake-${i + 1}`,
                        url: `https://cdn.pixabay.com/cake-${i + 1}.jpg`,
                        alt: 'cake bakery dessert',
                        width: 1200,
                        height: 800,
                        photographer: 'QA',
                        role: 'gallery' as const,
                        aspectRatio: '4:3' as const,
                    })),
                    square: [],
                    portrait: [],
                    underfill: false,
                },
            }

            // Act
            const result = await fulfillImageNeeds(needs, ctx as never, {} as never)
            cleanupNonNumericImageFields(blocks)

            // Assert — four verified pool IDs plus two curated F&B IDs fill all
            // slots. The simulated off-industry legacy IDs cannot enter the gallery.
            const images = blocks[0]!.images as Array<Record<string, unknown>>
            expect(images.map((item) => item.image)).toEqual([101, 102, 103, 104, 201, 202])
            expect(getMediaForBlock).not.toHaveBeenCalled()
            expect(getCuratedFallbackMedia).toHaveBeenCalledWith(
                'gallery', 2, expect.anything(), expect.anything(), expect.any(Set),
            )
            expect(result).toEqual({ succeeded: 6, failed: 0 })
        })

        it('fills all slots from curated same-industry images when the verified pool bucket is empty', async () => {
            // Arrange
            const blocks = [{
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, i) => ({ caption: `Cake ${i + 1}` })),
            }]
            const needs = planImageNeeds(blocks)
            const ctx = {
                businessName: 'Tiệm Bánh QA',
                tenantId: '1',
                category: 'fnb',
                products: ['bánh'],
                pool: { queryUsed: 'cake', landscape: [], square: [], portrait: [], underfill: true },
            }
            vi.mocked(getCuratedFallbackMedia).mockResolvedValueOnce({
                mediaIds: [301, 302, 303, 304, 305, 306],
                photos: [],
                failures: [],
            })

            // Act
            const result = await fulfillImageNeeds(needs, ctx as never, {} as never)
            cleanupNonNumericImageFields(blocks)

            // Assert
            expect(getMediaForBlock).not.toHaveBeenCalled()
            expect(getCuratedFallbackMedia).toHaveBeenCalledWith(
                'gallery', 6, expect.anything(), expect.anything(), expect.any(Set),
            )
            expect((blocks[0]!.images as Array<Record<string, unknown>>).map((item) => item.image))
                .toEqual([301, 302, 303, 304, 305, 306])
            expect(result).toEqual({ succeeded: 6, failed: 0 })
        })

        it('fills all six slots from curated images when the pool upload path throws', async () => {
            // Arrange
            const blocks = [{
                blockType: 'gallery',
                images: Array.from({ length: 6 }, (_, i) => ({ caption: `Cake ${i + 1}` })),
            }]
            const needs = planImageNeeds(blocks)
            vi.mocked(batchFetchFromPool).mockRejectedValueOnce(new Error('unexpected pool failure'))
            vi.mocked(getCuratedFallbackMedia).mockResolvedValueOnce({
                mediaIds: [401, 402, 403, 404, 405, 406],
                photos: [],
                failures: [],
            })
            const ctx = {
                businessName: 'Tiệm Bánh QA',
                tenantId: '1',
                category: 'fnb',
                products: ['bánh'],
                pool: {
                    queryUsed: 'cake',
                    landscape: [{
                        id: 'cake-1', url: 'https://cdn.pixabay.com/cake-1.jpg', alt: 'cake',
                        width: 1200, height: 800, photographer: 'QA',
                        role: 'gallery' as const, aspectRatio: '4:3' as const,
                    }],
                    square: [],
                    portrait: [],
                    underfill: true,
                },
            }

            // Act
            const result = await fulfillImageNeeds(needs, ctx as never, {} as never)

            // Assert
            expect(getMediaForBlock).not.toHaveBeenCalled()
            expect(getCuratedFallbackMedia).toHaveBeenCalledWith(
                'gallery', 6, expect.anything(), expect.anything(), expect.any(Set),
            )
            expect((blocks[0]!.images as Array<Record<string, unknown>>).map((item) => item.image))
                .toEqual([401, 402, 403, 404, 405, 406])
            expect(result).toEqual({ succeeded: 6, failed: 0 })
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

describe('computePoolTargetsForNeeds — actual generated slots', () => {
	it('sums real slots across pages and caps the landscape pool', () => {
		const targets = computePoolTargetsForNeeds([
			{ blockType: 'gallery', count: 6 },
			{ blockType: 'gallery', count: 9 },
			{ blockType: 'hero', count: 1 },
		])
		expect(targets).toEqual({ landscape: 12, square: 0 })
	})

	it('excludes people and logo blocks from stock-pool targets', () => {
		const targets = computePoolTargetsForNeeds([
			{ blockType: 'team', count: 5 },
			{ blockType: 'testimonials', count: 4 },
			{ blockType: 'logo-cloud', count: 8 },
			{ blockType: 'products-grid', count: 4 },
		])
		expect(targets).toEqual({ landscape: 0, square: 4 })
	})
})
