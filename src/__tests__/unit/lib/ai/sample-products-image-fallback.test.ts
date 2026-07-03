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

const { mockSearchPhotos, mockUploadImageUrl, mockFindOrCreateCartonMedia, mockFindByID, mockGetProductImages, mockResolveComposerCategory } = vi.hoisted(() => ({
    mockSearchPhotos: vi.fn(),
    mockUploadImageUrl: vi.fn(),
    mockFindOrCreateCartonMedia: vi.fn(),
    mockFindByID: vi.fn(),
    mockGetProductImages: vi.fn(),
    mockResolveComposerCategory: vi.fn(),
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

vi.mock('@/lib/ai/composer-category-resolver', () => ({
    resolveComposerCategory: mockResolveComposerCategory,
}))

vi.mock('@/lib/ai/config', () => ({
    selectModel: vi.fn().mockReturnValue('gpt-4.1-nano'),
}))

vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: vi.fn().mockRejectedValue(new Error('no openai')) } },
    })),
}))

import { generateSampleProducts } from '@/lib/ai/generate-sample-products'

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
    mockResolveComposerCategory.mockReturnValue('business')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env.PIXABAY_FALLBACK_ONLY
})

afterEach(() => {
    vi.restoreAllMocks()
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
