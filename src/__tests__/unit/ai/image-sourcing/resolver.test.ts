// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
    createF38Resolver,
    PixabayAttemptBudget,
    type StockImageCandidate,
} from '@/lib/ai/image-sourcing'

function catalogCandidate(id: string): StockImageCandidate {
    return {
        provider: 'pixabay',
        providerImageId: id,
        previewUrl: `https://pixabay.com/${id}-preview.jpg`,
        downloadUrl: `https://pixabay.com/${id}.jpg`,
        sourceUrl: `https://pixabay.com/photos/${id}`,
        creator: 'Maker',
        licenseName: 'Pixabay Content License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        attribution: 'by Maker via Pixabay',
        tags: ['cake'],
        category: 'fnb',
        width: 1600,
        height: 900,
        aspect: 16 / 9,
        active: true,
        mediaId: `media-${id}`,
        objectKey: `stock/pixabay/${id}.jpg`,
    }
}

describe('[TC-F38-CAT-01,05, TC-F38-FALLBACK-01–04] resolver orchestration', () => {
    it('fills from catalog first with zero provider attempts and no duplicate identity', async () => {
        // Arrange
        const pixabaySearch = vi.fn()
        const markCatalogUsed = vi.fn()
        const resolver = createF38Resolver({
            searchCatalog: vi.fn().mockResolvedValue([
                catalogCandidate('1'),
                catalogCandidate('1'),
                catalogCandidate('2'),
            ]),
            validateCatalogObject: vi.fn().mockResolvedValue(true),
            markCatalogUsed,
            pixabay: { search: pixabaySearch },
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [{ kind: 'landscape', count: 2, subject: 'cake', category: 'fnb' }],
        })

        // Assert
        expect(result.reservoirs.landscape.map((image) => image.source)).toEqual([
            'catalog',
            'catalog',
        ])
        expect(result.reservoirs.landscape.map((image) =>
            'candidate' in image ? image.candidate.providerImageId : null,
        )).toEqual(['1', '2'])
        expect(result.attemptsUsed).toBe(0)
        expect(pixabaySearch).not.toHaveBeenCalled()
        expect(markCatalogUsed).toHaveBeenCalledTimes(2)
    })

    it('TC-F38-RES-08/SCORE-09: rejects catalog rows with distinct provider identities but repeated asset keys', async () => {
        // Arrange
        const duplicateMedia = {
            ...catalogCandidate('2'),
            mediaId: 'media-1',
        }
        const resolver = createF38Resolver({
            searchCatalog: vi.fn().mockResolvedValue([
                catalogCandidate('1'),
                duplicateMedia,
                catalogCandidate('3'),
            ]),
            validateCatalogObject: vi.fn().mockResolvedValue(true),
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [{ kind: 'landscape', count: 2, subject: 'cake', category: 'fnb' }],
        })

        // Assert
        expect(result.reservoirs.landscape.map((image) =>
            'candidate' in image ? image.candidate.providerImageId : null,
        )).toEqual(['1', '3'])
        expect(result.events).toContainEqual(expect.objectContaining({
            stage: 'catalog',
            outcome: 'rejected',
            reason: 'duplicate',
            provider: 'pixabay',
        }))
    })

    it('TC-F38-RES-08/SCORE-09: rejects persisted stock that repeats a catalog asset key', async () => {
        // Arrange
        const externalCandidate: StockImageCandidate = {
            ...catalogCandidate('external'),
            width: 1000,
            height: 1000,
            aspect: 1,
            mediaId: undefined,
            objectKey: undefined,
        }
        const resolver = createF38Resolver({
            searchCatalog: vi.fn(async (demand) =>
                demand.kind === 'landscape' ? [catalogCandidate('1')] : [],
            ),
            validateCatalogObject: vi.fn().mockResolvedValue(true),
            pixabay: {
                search: vi.fn().mockResolvedValue({
                    ok: true,
                    candidates: [externalCandidate],
                    cacheHit: false,
                    keyIndex: 0,
                }),
            },
            persistExternal: vi.fn().mockResolvedValue({
                candidate: externalCandidate,
                mediaId: 'media-1',
                objectKey: 'stock/pixabay/external.jpg',
            }),
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [
                { kind: 'landscape', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'square', count: 1, subject: 'cake', category: 'fnb' },
            ],
        })

        // Assert
        expect(result.reservoirs.landscape).toHaveLength(1)
        expect(result.reservoirs.square).toEqual([])
        expect(result.events).toContainEqual(expect.objectContaining({
            reservoir: 'square',
            stage: 'pixabay',
            outcome: 'rejected',
            reason: 'duplicate',
        }))
    })

    it('preserves partial winners and applies AI then curated then empty per unresolved slot', async () => {
        // Arrange
        const generateAi = vi.fn()
            .mockResolvedValueOnce({ mediaId: 'ai-1' })
            .mockResolvedValueOnce(null)
        const curated = vi.fn().mockResolvedValueOnce({ url: '/fallback.jpg' }).mockResolvedValueOnce(null)
        const resolver = createF38Resolver({
            searchCatalog: vi.fn().mockResolvedValue([catalogCandidate('1')]),
            validateCatalogObject: vi.fn().mockResolvedValue(true),
            generateAi,
            getCuratedFallback: curated,
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [{ kind: 'landscape', count: 4, subject: 'cake', category: 'fnb' }],
        })

        // Assert
        expect(result.reservoirs.landscape.map((image) => image.source)).toEqual([
            'catalog',
            'ai',
            'curated',
        ])
        expect(result.events.at(-1)).toMatchObject({ stage: 'empty', reason: 'fallback_exhausted' })
    })

    it('TC-F38-RES-08/SCORE-09: rejects repeated AI media and object identities across reservoirs', async () => {
        // Arrange
        const generateAi = vi.fn()
            .mockResolvedValueOnce({ mediaId: 'ai-shared', objectKey: 'ai/first.jpg' })
            .mockResolvedValueOnce({ mediaId: 'ai-shared', objectKey: 'ai/second.jpg' })
            .mockResolvedValueOnce({ mediaId: 'ai-new', objectKey: 'ai/first.jpg' })
        const resolver = createF38Resolver({ generateAi })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [
                { kind: 'landscape', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'square', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'products', count: 1, subject: 'cake', category: 'fnb' },
            ],
        })

        // Assert
        expect(result.reservoirs.landscape).toEqual([
            expect.objectContaining({ source: 'ai', mediaId: 'ai-shared' }),
        ])
        expect(result.reservoirs.square).toEqual([])
        expect(result.reservoirs.products).toEqual([])
        expect(result.events.filter((event) =>
            event.stage === 'ai' &&
            event.outcome === 'rejected' &&
            event.reason === 'duplicate',
        )).toHaveLength(2)
    })

    it('TC-F38-RES-08/SCORE-09: rejects equivalent canonical curated URLs across reservoirs', async () => {
        // Arrange
        const curated = vi.fn()
            .mockResolvedValueOnce({
                url: 'HTTPS://CDN.EXAMPLE.COM/fallback.jpg?b=2&a=1#first',
            })
            .mockResolvedValueOnce({
                url: 'https://cdn.example.com/fallback.jpg?a=1&b=2#second',
            })
        const resolver = createF38Resolver({ getCuratedFallback: curated })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [
                {
                    kind: 'square',
                    count: 1,
                    subject: 'cake',
                    category: 'fnb',
                    aiEligible: false,
                },
                {
                    kind: 'people',
                    count: 1,
                    subject: 'portrait',
                    category: 'people',
                },
            ],
        })

        // Assert
        expect(result.reservoirs.square).toEqual([
            expect.objectContaining({ source: 'curated' }),
        ])
        expect(result.reservoirs.people).toEqual([])
        expect(result.events).toContainEqual(expect.objectContaining({
            reservoir: 'people',
            stage: 'curated',
            outcome: 'rejected',
            reason: 'duplicate',
        }))
    })

    it('TC-F38-CAT-03/OBS-01: reports missing objects and emits a redacted summary', async () => {
        // Arrange
        const summaries: unknown[] = []
        const resolver = createF38Resolver({
            searchCatalog: vi.fn().mockResolvedValue([catalogCandidate('secret-provider-key')]),
            validateCatalogObject: vi.fn().mockResolvedValue(false),
            emitSummary: vi.fn((summary) => {
                summaries.push(summary)
            }),
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            demands: [{ kind: 'landscape', count: 1, subject: 'cake', category: 'fnb' }],
        })

        // Assert
        expect(result.events).toContainEqual(expect.objectContaining({
            stage: 'object_validation',
            outcome: 'rejected',
            reason: 'missing_or_unavailable',
        }))
        expect(summaries).toHaveLength(1)
        const serialized = JSON.stringify(summaries[0])
        expect(serialized).toContain('"stages"')
        expect(serialized).not.toContain('secret-provider-key')
        expect(serialized).not.toContain('cake')
    })

    it('never exceeds five attempts under failover pressure and keeps people AI-ineligible', async () => {
        // Arrange
        const budget = new PixabayAttemptBudget()
        const search = vi.fn(async (input) => {
            const reserved = input.reservation === 'primary'
                ? input.budget.reservePrimary(input.laterUnresolvedReservoirs)
                : input.budget.reserveFailover()
            return reserved
                ? { ok: false as const, reason: 'auth' as const, failoverEligible: true, keyIndex: 0 }
                : { ok: false as const, reason: 'budget_exhausted' as const, failoverEligible: false }
        })
        const generateAi = vi.fn().mockResolvedValue(null)
        const resolver = createF38Resolver({
            pixabay: { search },
            persistExternal: vi.fn(),
            generateAi,
        })

        // Act
        const result = await resolver.resolveF38ImageDemand({
            budget,
            demands: [
                { kind: 'landscape', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'square', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'people', count: 1, subject: 'ignored', category: 'fnb' },
                { kind: 'products', count: 1, subject: 'cake', category: 'fnb' },
                { kind: 'blogs', count: 1, subject: 'cake', category: 'fnb' },
            ],
        })

        // Assert
        expect(result.attemptsUsed).toBe(5)
        expect(search).toHaveBeenCalledTimes(5)
        expect(generateAi).toHaveBeenCalledTimes(4)
        expect(generateAi.mock.calls.every(([demand]) => demand.kind !== 'people')).toBe(true)
    })
})
