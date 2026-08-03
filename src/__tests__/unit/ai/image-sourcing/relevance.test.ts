// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    IMAGE_RELEVANCE_SYNONYMS,
    normalizeImageTerm,
    rankImageCandidates,
    scoreImageCandidate,
    type StockImageCandidate,
} from '@/lib/ai/image-sourcing'

function candidate(overrides: Partial<StockImageCandidate> = {}): StockImageCandidate {
    return {
        provider: 'pixabay',
        providerImageId: '1',
        previewUrl: 'https://pixabay.com/preview.jpg',
        downloadUrl: 'https://pixabay.com/image.jpg',
        sourceUrl: 'https://pixabay.com/photos/1',
        creator: 'Creator',
        licenseName: 'Pixabay Content License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        attribution: 'by Creator via Pixabay',
        tags: ['cupcake frosting'],
        category: 'fnb',
        width: 1500,
        height: 1000,
        aspect: 1.5,
        active: true,
        ...overrides,
    }
}

describe('[TC-F38-SCORE-01–10] deterministic local relevance', () => {
    it('normalizes NFC punctuation and whitespace without stripping Vietnamese diacritics', () => {
        // Arrange
        const decomposed = '  PHỞ—BÒ!!!  '

        // Act
        const normalized = normalizeImageTerm(decomposed)

        // Assert
        expect(normalized).toBe('phở bò')
    })

    it('snapshots the complete approved symmetric synonym map', () => {
        // Arrange

        // Act
        const synonyms = IMAGE_RELEVANCE_SYNONYMS

        // Assert
        expect(synonyms).toEqual([
            ['cake', 'cakes', 'cupcake', 'cupcakes', 'cheesecake'],
            ['frosting', 'frosted'],
            ['grill', 'grilled'],
            ['pastry', 'pastries'],
            ['cookie', 'cookies'],
            ['noodle', 'noodles'],
            ['dress', 'dresses'],
        ])
    })

    it('scores an exact subject once and adds exact aspect once', () => {
        // Arrange
        const image = candidate({ tags: ['chocolate cake', 'cake'] })

        // Act
        const result = scoreImageCandidate({
            candidate: image,
            subject: 'chocolate cake',
            category: 'fnb',
            aspect: 'landscape',
            reservoir: 'landscape',
            selectedProviderIdentities: new Set(),
        })

        // Assert
        expect(result).toEqual({ accepted: true, score: 7 })
    })

    it('requires every subject token to match exactly or through an approved synonym', () => {
        // Arrange
        const partial = candidate({ tags: ['frosting'] })
        const complete = candidate({ tags: ['frosting cupcakes'] })
        const options = {
            subject: 'frosted cake',
            category: 'fnb',
            aspect: 'landscape' as const,
            reservoir: 'landscape' as const,
            selectedProviderIdentities: new Set<string>(),
        }

        // Act
        const partialResult = scoreImageCandidate({ candidate: partial, ...options })
        const completeResult = scoreImageCandidate({ candidate: complete, ...options })

        // Assert
        expect(partialResult).toMatchObject({ accepted: false, reason: 'subject' })
        expect(completeResult).toEqual({ accepted: true, score: 5 })
    })

    it('hard-rejects category, aspect, persisted-object, and generation duplicates', () => {
        // Arrange
        const image = candidate({ objectKey: undefined, mediaId: undefined })
        const base = {
            subject: 'cupcake',
            category: 'fnb',
            aspect: 'landscape' as const,
            reservoir: 'landscape' as const,
            selectedProviderIdentities: new Set<string>(),
        }

        // Act
        const category = scoreImageCandidate({
            candidate: { ...image, category: 'travel' },
            ...base,
        })
        const aspect = scoreImageCandidate({
            candidate: { ...image, aspect: 1.24 },
            ...base,
        })
        const object = scoreImageCandidate({
            candidate: image,
            ...base,
            requirePersistedObject: true,
        })
        const duplicate = scoreImageCandidate({
            candidate: image,
            ...base,
            selectedProviderIdentities: new Set(['pixabay:1']),
        })

        // Assert
        expect(category).toMatchObject({ accepted: false, reason: 'category' })
        expect(aspect).toMatchObject({ accepted: false, reason: 'aspect' })
        expect(object).toMatchObject({ accepted: false, reason: 'object' })
        expect(duplicate).toMatchObject({ accepted: false, reason: 'duplicate' })
    })

    it('uses score, reuse, recency, provider, and provider ID as deterministic tie-breaks', () => {
        // Arrange
        const candidates = [
            candidate({ providerImageId: 'b', useCount: 1, lastUsedAt: null }),
            candidate({ providerImageId: 'a', useCount: 1, lastUsedAt: null }),
            candidate({ providerImageId: 'c', useCount: 2, lastUsedAt: null }),
        ]

        // Act
        const ranked = rankImageCandidates(
            candidates,
            { subject: 'cupcake', category: 'fnb', aspect: 'landscape', kind: 'landscape' },
            new Set(),
        )

        // Assert
        expect(ranked.map((item) => item.candidate.providerImageId)).toEqual(['a', 'b', 'c'])
    })
})
