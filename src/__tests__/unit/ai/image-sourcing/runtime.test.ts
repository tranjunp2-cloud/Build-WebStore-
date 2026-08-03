// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
    mockGetCuratedFallbackMedia,
} = vi.hoisted(() => ({
    mockGetCuratedFallbackMedia: vi.fn(),
}))

vi.mock('@/lib/media/stock-adapter', () => ({
    createF38StockInfrastructure: vi.fn(() => ({
        searchCatalog: vi.fn().mockResolvedValue([]),
        objectExists: vi.fn().mockResolvedValue(true),
        markCatalogUsed: vi.fn(),
        persistStockCandidate: vi.fn(),
    })),
}))

vi.mock('@/lib/ai/media-pipeline', () => ({
    getCuratedFallbackMedia: mockGetCuratedFallbackMedia,
}))

import {
    createF38RuntimeResolver,
    resetProcessPixabayKeyRingForTests,
} from '@/lib/ai/image-sourcing'

const previousEnvironment = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
    PIXABAY_API_KEYS: process.env.PIXABAY_API_KEYS,
    WIKIMEDIA_USER_AGENT: process.env.WIKIMEDIA_USER_AGENT,
}

afterEach(() => {
    vi.clearAllMocks()
    resetProcessPixabayKeyRingForTests()
    for (const [key, value] of Object.entries(previousEnvironment)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

describe('[TC-F38-FALLBACK-02] runtime AI image disable', () => {
    it('never generates AI images and falls through to curated media', async () => {
        // Arrange
        process.env.OPENAI_API_KEY = 'openai-secret-value'
        delete process.env.PIXABAY_API_KEY
        delete process.env.PIXABAY_API_KEYS
        delete process.env.WIKIMEDIA_USER_AGENT
        mockGetCuratedFallbackMedia.mockResolvedValue({
            mediaIds: [88],
            photos: [],
            failures: [],
        })
        const payload = { create: vi.fn() }
        const logged: unknown[] = []
        const resolver = createF38RuntimeResolver(payload as never, {
            tenantId: '1',
            businessName: 'Secret Bakery',
            category: 'fnb',
            logger: (event) => {
                logged.push(event)
            },
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [{
                kind: 'landscape',
                count: 1,
                subject: 'cake',
                category: 'fnb',
            }],
        })

        // Assert
        expect(result.reservoirs.landscape).toEqual([
            expect.objectContaining({ source: 'curated', mediaId: 88 }),
        ])
        expect(payload.create).not.toHaveBeenCalled()
        expect(logged).toContainEqual(expect.objectContaining({
            stage: 'ai',
            outcome: 'skipped',
            reason: 'unavailable',
        }))
    })
})
