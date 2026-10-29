// @vitest-environment node
/**
 * Unit tests for fetchProductImage tier fallback chain (GH-908).
 * TC-F05-908-01 through TC-F05-908-06
 *
 * fetchProductImage is not exported — we test it via generateSampleProducts
 * by controlling searchPhotos, uploadImageUrl, findOrCreateCartonMedia,
 * and payload.findByID.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSearchPhotos, mockUploadImageUrl, mockFindOrCreateCartonMedia, mockFindByID, mockGetProductImages, mockRunTask } = vi.hoisted(() => ({
    mockSearchPhotos: vi.fn(),
    mockUploadImageUrl: vi.fn(),
    mockFindOrCreateCartonMedia: vi.fn(),
    mockFindByID: vi.fn(),
    mockGetProductImages: vi.fn(),
    mockRunTask: vi.fn(),
}))

vi.mock('@/lib/ai/pixabay-client', () => ({
    searchPhotos: mockSearchPhotos,
    // GH-1185: empty map → no category filter in these tests (param behavior
    // covered by pixabay-client TC-F38-RAW-11/12)
    PIXABAY_CATEGORY_BY_COMPOSER: {},
    PixabayError: class PixabayError extends Error {
        code: string
        constructor(code: string, status: number, retryable: boolean, message?: string) {
            super(message ?? `[Pixabay] ${code}`)
            this.code = code
        }
    },
}))

vi.mock('@/lib/ai/upload-media', () => ({
    uploadImageUrl: mockUploadImageUrl,
}))

vi.mock('@/lib/media/carton-placeholder', () => ({
    findOrCreateCartonMedia: mockFindOrCreateCartonMedia,
}))

// Minimal curated fallback so AI path isn't needed
vi.mock('@/lib/ai/content/sample-products', () => ({
    SAMPLE_PRODUCTS_BY_CATEGORY: {
        business: [
            { name: 'Business Card', shortDescription: 'Cards', description: 'Desc', price: 10, imageKeyword: 'business card' },
            { name: 'Notebook', shortDescription: 'Notes', description: 'Desc', price: 20, imageKeyword: 'notebook' },
            { name: 'Pen Set', shortDescription: 'Pens', description: 'Desc', price: 15, imageKeyword: 'pen set' },
            { name: 'Folder', shortDescription: 'Folders', description: 'Desc', price: 8, imageKeyword: 'folder' },
            { name: 'Stamp', shortDescription: 'Stamps', description: 'Desc', price: 25, imageKeyword: 'stamp' },
            { name: 'Label', shortDescription: 'Labels', description: 'Desc', price: 5, imageKeyword: 'label' },
        ],
    },
}))

// Minimal industry images pool — 6 gallery URLs per category so productUrls always populated
vi.mock('@/lib/images/industry-images', () => ({
    getProductImages: mockGetProductImages,
}))

// GH-1611: the category resolver is NOT mocked. Faking resolveBusinessCategory as
// "score the concatenated string" would re-implement the exact bug it fixes (a form
// key like 'fnb' scores 0 and sinks to 'business'), so the fix would look tested
// while never running. businessInfo.industry = 'business' below, and the real
// resolver returns 'business' for it — same category the spy used to force.


// Prototype-based (not mockImplementation returning an object) — survives vi.clearAllMocks()
// in beforeEach, matching the proven pattern in src/__tests__/api/ai.test.ts.
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask: mockRunTask }) }))

import {
    generateSampleProducts as generateSampleProductsInScope,
    prepareSampleProducts as prepareSampleProductsInScope,
} from '@/lib/ai/generate-sample-products'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

// The AI steps run only inside an AI actor scope (the migrated site's workspace owner).
const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const PLATFORM_USAGE = { model: 'test', inputTokens: 10, outputTokens: 5 }
const generateSampleProducts: typeof generateSampleProductsInScope = (...args) => runWithAiActor(ACTOR, () => generateSampleProductsInScope(...args))
const prepareSampleProducts: typeof prepareSampleProductsInScope = (...args) => runWithAiActor(ACTOR, () => prepareSampleProductsInScope(...args))

const mockPayload = {
    findByID: mockFindByID,
} as any

const businessInfo = {
    businessName: 'Acme Corp',
    industry: 'business',
    products: '',
}

const PRODUCT_URLS = [
    'https://cdn.example.com/p1.jpg',
    'https://cdn.example.com/p2.jpg',
    'https://cdn.example.com/p3.jpg',
    'https://cdn.example.com/p4.jpg',
    'https://cdn.example.com/p5.jpg',
    'https://cdn.example.com/p6.jpg',
]

beforeEach(() => {
    vi.clearAllMocks()
    mockGetProductImages.mockReturnValue(PRODUCT_URLS)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env.PIXABAY_FALLBACK_ONLY
    // Default: Tier-1 AI call fails, forcing the Tier-2 curated fallback path — matches this file's
    // original behavior before mockRunTask was extracted to a hoisted, per-test-overridable mock.
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    mockRunTask.mockRejectedValue(new Error('no openai'))
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

describe('[TC-F05-908] fetchProductImage tier fallback chain', () => {
    it('[TC-F05-908-01] Tier A success — Pixabay hit → uploadImageUrl → product gets imageId', async () => {
        // Arrange
        mockSearchPhotos.mockResolvedValue([{
            id: 'p1',
            url: 'https://pixabay.com/get/p1_1280.jpg',
            alt: 'product photo',
            photographer: 'Photographer',
            width: 800,
            height: 800,
        }])
        mockUploadImageUrl.mockResolvedValue(42)
        mockFindByID.mockResolvedValue({ id: 42 })

        // Act
        const { products, stats } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — at least first product should get imageId=42 from Tier A
        expect(products[0]!.imageId).toBe(42)
        expect(stats.noImage).toBe(0)
    })

    it('[TC-F05-908-02] Tier A upload returns null → falls through to Tier C gallery URL → gets imageId', async () => {
        // Arrange — search returns photo but upload returns null (e.g. upload skipped)
        mockSearchPhotos.mockResolvedValue([{
            id: 'p1',
            url: 'https://pixabay.com/get/p1_1280.jpg',
            alt: 'product photo',
            photographer: 'Photographer',
            width: 800,
            height: 800,
        }])
        mockUploadImageUrl
            .mockResolvedValueOnce(null)   // Tier A upload → null
            .mockResolvedValue(77)          // Tier C upload → success
        mockFindByID.mockResolvedValue({ id: 77 })

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — Tier C delivers imageId
        expect(products[0]!.imageId).toBe(77)
    })

    it('[TC-F05-908-03] Tier C gallery upload fails → falls through to Tier D carton → gets imageId', async () => {
        // Arrange — search 0 results, gallery upload throws
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockRejectedValue(new Error('CDN unreachable'))
        mockFindOrCreateCartonMedia.mockResolvedValue({ id: 99 })

        // Act
        const { products, stats } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — Tier D carton delivers imageId
        expect(products[0]!.imageId).toBe(99)
        expect(stats.noImage).toBe(0)
        expect(mockFindOrCreateCartonMedia).toHaveBeenCalled()
    })

    it('[TC-F05-908-04] Tier C upload succeeds but orphan-stripped → falls through to Tier D carton', async () => {
        // Arrange — search 0 results; gallery upload returns id=55 but findByID returns null (orphaned)
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockResolvedValue(55)
        mockFindByID.mockResolvedValue(null)          // orphan stripper deleted it
        mockFindOrCreateCartonMedia.mockResolvedValue({ id: 99 })

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — Tier D picked up after orphan strip
        expect(products[0]!.imageId).toBe(99)
        expect(mockFindOrCreateCartonMedia).toHaveBeenCalled()
    })

    it('[TC-F05-908-05] All tiers fail (carton returns null) → imageId=undefined, reason=gallery_failed', async () => {
        // Arrange — nothing works
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockRejectedValue(new Error('all broken'))
        mockFindOrCreateCartonMedia.mockResolvedValue(null)

        // Act
        const { products, stats } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — no image; noImage counter increments
        expect(products[0]!.imageId).toBeUndefined()
        expect(stats.noImage).toBeGreaterThan(0)
    })

    it('[TC-F05-908-06] PIXABAY_FALLBACK_ONLY=1 skips search, goes directly to Tier C then Tier D on failure', async () => {
        // Arrange
        process.env.PIXABAY_FALLBACK_ONLY = '1'
        mockUploadImageUrl.mockRejectedValue(new Error('gallery down'))
        mockFindOrCreateCartonMedia.mockResolvedValue({ id: 100 })

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — search never called; Tier D used
        expect(mockSearchPhotos).not.toHaveBeenCalled()
        expect(products[0]!.imageId).toBe(100)
        expect(mockFindOrCreateCartonMedia).toHaveBeenCalled()
    })

    it('[TC-F05-908-08] Tier A upload throws + Tier D rescues with carton → imageId set, stats.uploadFailed increments', async () => {
        // Arrange — Tier A finds photo but upload throws; Tier C also fails; Tier D carton succeeds
        mockSearchPhotos.mockResolvedValue([{
            id: 'p1',
            url: 'https://pixabay.com/get/p1_1280.jpg',
            alt: 'product photo',
            photographer: 'Photographer',
            width: 800,
            height: 800,
        }])
        mockUploadImageUrl.mockRejectedValue(new Error('S3 upload failed')) // Tier A + Tier C throw
        mockFindOrCreateCartonMedia.mockResolvedValue({ id: 99 })            // Tier D rescues

        // Act
        const { products, stats } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — product gets carton imageId; upload failure counted even though product has an image
        expect(products[0]!.imageId).toBe(99)
        expect(stats.noImage).toBe(0)          // product has an image (carton)
        expect(stats.uploadFailed).toBeGreaterThan(0) // but Tier A upload error is counted
    })

    it('[TC-F05-908-07] Tier A photo found + upload throws + Tier C fails + Tier D fails → reason=upload_failed', async () => {
        // Arrange — search returns photo but ALL uploads fail; Tier D also unavailable
        const logSpy = vi.spyOn(console, 'log')
        mockSearchPhotos.mockResolvedValue([{
            id: 'p1',
            url: 'https://pixabay.com/get/p1_1280.jpg',
            alt: 'product photo',
            photographer: 'Photographer',
            width: 800,
            height: 800,
        }])
        mockUploadImageUrl.mockRejectedValue(new Error('S3 upload failed')) // Tier A + Tier C both throw
        mockFindOrCreateCartonMedia.mockResolvedValue(null)                  // Tier D unavailable

        // Act
        const { products, stats } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        // Assert — tierAUploadFailed flag wins over gallery_failed in reason precedence
        expect(products[0]!.imageId).toBeUndefined()
        expect(stats.uploadFailed).toBeGreaterThan(0)
        expect(stats.noImage).toBeGreaterThan(0)
        // Pin the exact reason code — ensures tierAUploadFailed path, not gallery_failed
        expect(logSpy.mock.calls.some(args => String(args[0]).includes('reason=upload_failed'))).toBe(true)
    })
})

describe('[TC-F38-RES-08] deferred product image assignment', () => {
    it('prepares product copy and demand keywords without calling Pixabay or upload fallbacks', async () => {
        // Arrange — curated product copy is the deterministic text fallback.

        // Act
        const prepared = await prepareSampleProducts(businessInfo, 'en')

        // Assert
        expect(prepared.products).toHaveLength(6)
        expect(prepared.products.map((product) => product.imageKeyword))
            .toContain('business card')
        expect(mockSearchPhotos).not.toHaveBeenCalled()
        expect(mockUploadImageUrl).not.toHaveBeenCalled()
        expect(mockFindOrCreateCartonMedia).not.toHaveBeenCalled()
    })
})

describe('[TC-GENPERF-W3] bounded sample-product preparation', () => {
    it('[TC-GENPERF-W3-06] fills a partial AI result from curated data without a second model call', async () => {
        mockRunTask.mockResolvedValueOnce({ output: { products: [{
                name: 'AI Product',
                shortDescription: 'Short desc',
                description: 'Full desc',
                price: 50,
                imageKeyword: 'ai product',
            }] }, usage: PLATFORM_USAGE })
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockResolvedValue(77)
        mockFindByID.mockResolvedValue({ id: 77 })

        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        expect(products).toHaveLength(6)
        expect(products[0]!.name).toBe('AI Product')
        expect(mockRunTask).toHaveBeenCalledTimes(1)
    })

    it('[TC-GENPERF-W3-07] caps image search at two six-second queries per product', async () => {
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockResolvedValue(77)
        mockFindByID.mockResolvedValue({ id: 77 })

        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload, 'site-1')

        expect(mockSearchPhotos.mock.calls.length).toBeLessThanOrEqual(products.length * 2)
        for (const call of mockSearchPhotos.mock.calls) {
            expect(call[2]).toMatchObject({ timeoutMs: 6_000 })
        }
    })
})

describe('[TC-F09-1383] sample product fields — sku / inventory / category', () => {
    // Image mocks: all tiers fail non-fatally so products are still generated
    // with imageId=undefined — sufficient since these tests assert on sku/inventory/category
    function setupImageMocks() {
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockRejectedValue(new Error('upload not needed for this test'))
        mockFindOrCreateCartonMedia.mockResolvedValue(null)
    }

    it('[TC-F09-1383-01] generates unique SKU for each product matching pattern', async () => {
        // Arrange — resolveComposerCategory mocked → 'business' → prefix 'BUS'
        setupImageMocks()

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload as any)
        const skus = products.map(p => p.sku)

        // Assert
        skus.forEach(sku => expect(sku).toMatch(/^BUS-\d{3}$/))
        expect(new Set(skus).size).toBe(products.length) // all unique
    })

    it('[TC-F09-1383-02] sets inventory to 0 for all products', async () => {
        // Arrange
        setupImageMocks()

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload as any)

        // Assert
        products.forEach(p => expect(p.inventory).toBe(0))
    })

})

// GH-1458 Phase 2 — Tier-1 AI is asked to estimate weight/dimensions per product (mirrors
// products-bulk-parse). This function must pass those through untouched and leave them undefined
// when the AI omits them — the `?? 1`/`?? 0` fallback lives downstream in generate-site/route.ts,
// not here (mirrors where BulkCreateModal.buildSavePayload() applies its own `|| 1`/`|| 0`).
describe('[TC-GH1458-P2] AI-estimated weight/dimensions', () => {
    function setupImageMocks() {
        mockSearchPhotos.mockResolvedValue([])
        mockUploadImageUrl.mockRejectedValue(new Error('upload not needed for this test'))
        mockFindOrCreateCartonMedia.mockResolvedValue(null)
    }

    function aiProduct(overrides: Record<string, unknown> = {}) {
        return {
            name: 'Test Product',
            shortDescription: 'Short desc',
            description: 'Full desc',
            price: 50,
            imageKeyword: 'test product',
            ...overrides,
        }
    }

    function mockAIResponse(products: Record<string, unknown>[]) {
        // 6 products so aiSucceeded=true with no top-up call needed (generateSampleProductsAI is
        // always called with count=6 first).
        mockRunTask.mockResolvedValueOnce({ output: { products }, usage: PLATFORM_USAGE })
    }

    it('[TC-GH1458-P2-01] passes through AI-estimated weight/dimensions per product', async () => {
        // Arrange
        setupImageMocks()
        mockAIResponse(Array.from({ length: 6 }, (_, i) => aiProduct({
            name: `Product ${i}`, weight: 2.5 + i, length: 10 + i, width: 20 + i, height: 5 + i,
        })))

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload as any)

        // Assert
        expect(products).toHaveLength(6)
        products.forEach((p, i) => {
            expect(p.weight).toBe(2.5 + i)
            expect(p.length).toBe(10 + i)
            expect(p.width).toBe(20 + i)
            expect(p.height).toBe(5 + i)
        })
    })

    it('[TC-GH1458-P2-02] leaves weight/dimensions undefined when AI omits them', async () => {
        // Arrange — AI response has no weight/length/width/height fields at all
        setupImageMocks()
        mockAIResponse(Array.from({ length: 6 }, (_, i) => aiProduct({ name: `Product ${i}` })))

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload as any)

        // Assert — undefined here, NOT defaulted to 1/0 (that's generate-site/route.ts's job)
        expect(products).toHaveLength(6)
        products.forEach(p => {
            expect(p.weight).toBeUndefined()
            expect(p.length).toBeUndefined()
            expect(p.width).toBeUndefined()
            expect(p.height).toBeUndefined()
        })
    })

    it('[TC-GH1458-P2-03] discards out-of-range/hallucinated AI weight/dimensions (code-review fix — untrusted AI input)', async () => {
        // Arrange — AI hallucinates values outside the schema.ts bounds (weight 0.01-1000, dims 0-10000):
        // negative weight, absurdly large length, negative width, weight below the 0.01 floor.
        setupImageMocks()
        mockAIResponse([
            aiProduct({ name: 'Product 0', weight: -50, length: 10, width: 20, height: 5 }),
            aiProduct({ name: 'Product 1', weight: 5, length: 999999999, width: 20, height: 5 }),
            aiProduct({ name: 'Product 2', weight: 5, length: 10, width: -20, height: 5 }),
            aiProduct({ name: 'Product 3', weight: 0.001, length: 10, width: 20, height: 5 }),
            aiProduct({ name: 'Product 4', weight: 5, length: 10, width: 20, height: 5 }),
            aiProduct({ name: 'Product 5', weight: 5, length: 10, width: 20, height: 5 }),
        ])

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'en', 'tenant-1', mockPayload as any)

        // Assert — out-of-range fields collapse to undefined (not clamped, not passed through);
        // in-range fields on the same product are unaffected.
        expect(products).toHaveLength(6)
        expect(products[0]!.weight).toBeUndefined()
        expect(products[0]!.length).toBe(10)
        expect(products[1]!.length).toBeUndefined()
        expect(products[1]!.weight).toBe(5)
        expect(products[2]!.width).toBeUndefined()
        expect(products[3]!.weight).toBeUndefined()
        expect(products[4]!.weight).toBe(5)
        expect(products[4]!.length).toBe(10)
    })

    it('[TC-F26-11-04] requests customer-facing product copy in the confirmed locale', async () => {
        // Arrange
        setupImageMocks()
        mockAIResponse(Array.from({ length: 6 }, (_, i) => aiProduct({ name: `Prodotto ${i}` })))

        // Act
        await generateSampleProducts(businessInfo, 'it', 'tenant-1', mockPayload)

        // Assert
        const request = mockRunTask.mock.calls[0]?.[1] as { user?: string }
        expect(request?.user).toContain('Write product names and customer-facing descriptions in Italian.')
    })

    it('[TC-F26-11-04] does not inject English curated products when Italian AI generation fails', async () => {
        // Arrange
        mockRunTask.mockRejectedValue(new Error('OpenAI unavailable'))

        // Act
        const { products } = await generateSampleProducts(businessInfo, 'it', 'tenant-1', mockPayload)

        // Assert
        expect(products).toEqual([])
    })
})

// ── #2103 A3 — exactly the merchant's listed products ────────────────────────
describe('[TC-AIAUD-028..030] prepareSampleProducts — merchant list is the catalogue (#2103 A3)', () => {
    const LISTED = 'Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120'
    const info = { businessName: 'Dapur Kak Yah', industry: 'business', products: LISTED }

    it('[TC-AIAUD-028] creates exactly the 3 listed products with the merchant names and typed prices', async () => {
        // Arrange — the model echoes different names and its own prices
        mockRunTask.mockResolvedValueOnce({ output: { products: [
            { name: 'Layer Cake Deluxe', shortDescription: 'S1', description: 'D1', price: 99, imageKeyword: 'layer cake' },
            { name: 'Festive Cookie Tin', shortDescription: 'S2', description: 'D2', price: 77, imageKeyword: 'cookie tin' },
            { name: 'Custom Cake', shortDescription: 'S3', description: 'D3', price: 55, imageKeyword: 'custom cake' },
        ] }, usage: PLATFORM_USAGE })

        // Act
        const { products } = await prepareSampleProducts(info, 'en')

        // Assert
        expect(products.map((p) => [p.name, p.price])).toEqual([['Kek lapis', 65], ['kuih raya box', 48], ['birthday', 120]])
        expect(products.map((p) => p.description)).toEqual(['D1', 'D2', 'D3'])
        expect(products.map((p) => p.imageKeyword)).toEqual(['layer cake', 'cookie tin', 'custom cake'])
        // stays active with stock 0 (storefront shows sold out)
        expect(products.every((p) => p.status === 'active')).toBe(true)
    })

    it('[TC-AIAUD-029] never tops up from the curated library when the model returns fewer or fails', async () => {
        mockRunTask.mockResolvedValueOnce({ output: { products: [
            { name: 'x', shortDescription: 'S1', description: 'D1', price: 10, imageKeyword: 'k' },
        ] }, usage: PLATFORM_USAGE })
        const partial = await prepareSampleProducts(info, 'en')
        expect(partial.products.map((p) => p.name)).toEqual(['Kek lapis', 'kuih raya box', 'birthday'])
        expect(partial.products.map((p) => p.price)).toEqual([65, 48, 120])

        mockRunTask.mockRejectedValue(new Error('model down'))
        const failed = await prepareSampleProducts(info, 'en')
        expect(failed.products.map((p) => p.name)).toEqual(['Kek lapis', 'kuih raya box', 'birthday'])
        expect(failed.products.map((p) => p.price)).toEqual([65, 48, 120])
        expect(JSON.stringify(failed.products)).not.toMatch(/Business Card|Notebook|Pen Set/)
    })

    it('[TC-AIAUD-030] caps at 20 listed products; with nothing listed the previous 6-product fallback stays', async () => {
        const many = Array.from({ length: 25 }, (_, i) => `Item ${i + 1}`).join(', ')
        const capped = await prepareSampleProducts({ ...info, products: many }, 'en')
        expect(capped.products).toHaveLength(20)

        const none = await prepareSampleProducts({ ...info, products: '' }, 'en')
        expect(none.products).toHaveLength(6)
        expect(['Business Card', 'Notebook', 'Pen Set', 'Folder', 'Stamp', 'Label']).toContain(none.products[0]!.name)
    })
})
