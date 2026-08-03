// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { BasePayload } from 'payload'

import {
    catalogImageToCandidate,
    createStockCatalogRepository,
    normalizeCatalogTerms,
    type CatalogImage,
} from '@/lib/media/stock-catalog'
import type { StockImageCandidate } from '@/lib/ai/image-sourcing'
import type { StockObjectStore } from '@/lib/media/stock-image'

function payloadWithPool(pool: object): BasePayload {
    return { db: { pool } } as unknown as BasePayload
}

const catalogRow = {
    id: 2,
    media_id: 3,
    provider: 'pixabay' as const,
    provider_image_id: '4',
    object_key: 'stock/pixabay/4.jpg',
    source_url: 'https://pixabay.com/photos/4',
    creator: '',
    license_name: 'Pixabay Content License',
    license_url: 'https://pixabay.com/service/license-summary/',
    attribution: 'via Pixabay',
    tags: ['cake'],
    normalized_terms: 'cake',
    category: 'restaurant',
    width: 1600,
    height: 900,
    aspect: 1600 / 900,
    active: true,
    use_count: 1,
    last_used_at: null,
}

const stockCandidate: StockImageCandidate = {
    provider: 'pixabay',
    providerImageId: '4',
    previewUrl: 'https://cdn.pixabay.com/photo/4.jpg',
    downloadUrl: 'https://cdn.pixabay.com/photo/4.jpg',
    sourceUrl: 'https://pixabay.com/photos/4',
    creator: '',
    licenseName: 'Pixabay Content License',
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    attribution: 'via Pixabay',
    tags: ['cake'],
    category: 'restaurant',
    width: 1600,
    height: 900,
    aspect: 1600 / 900,
    active: true,
}

describe('F38 catalog infrastructure', () => {
    it('[TC-F38-SCORE-01] normalizes NFC/punctuation without stripping diacritics', () => {
        // Arrange
        const input = '  BA\u0301NH—MI\u0300!!  Cake '

        // Act / Assert
        expect(normalizeCatalogTerms(input)).toBe('bánh mì cake')
    })

    it('[TC-F38-PERSIST-01] converts catalog rows to the shared numeric-aspect contract', () => {
        // Arrange
        const image: CatalogImage = {
            catalogId: 2,
            mediaId: 3,
            provider: 'pixabay',
            providerImageId: '4',
            objectKey: 'stock/pixabay/4.jpg',
            sourceUrl: 'https://pixabay.com/photos/4',
            creator: '',
            licenseName: 'Pixabay Content License',
            licenseUrl: 'https://pixabay.com/service/license-summary/',
            attribution: 'via Pixabay',
            tags: ['cake'],
            normalizedTerms: 'cake',
            category: 'restaurant',
            width: 1600,
            height: 900,
            aspect: 1600 / 900,
            active: true,
            useCount: 1,
            lastUsedAt: null,
        }

        // Act
        const candidate = catalogImageToCandidate(image)

        // Assert
        expect(candidate).toMatchObject({
            catalogId: 2,
            mediaId: 3,
            objectKey: 'stock/pixabay/4.jpg',
            aspect: 1600 / 900,
        })
    })

    it('[TC-F38-CAT-02/04] applies bounded SQL hard filters and leaves object checks to the resolver', async () => {
        // Arrange
        const query = vi.fn().mockResolvedValue({ rows: [catalogRow] })
        const objectStore: StockObjectStore = {
            objectExists: vi.fn(),
            put: vi.fn(),
        }
        const repository = createStockCatalogRepository(payloadWithPool({ query }), { objectStore })

        // Act
        const rows = await repository.searchCatalog({
            subject: 'cake pastry',
            category: 'restaurant',
            aspect: 'landscape',
        }, new Set())

        // Assert
        expect(rows).toHaveLength(1)
        const sql = query.mock.calls[0]![0] as string
        expect(sql).toContain('active = true')
        expect(sql).toContain("to_tsquery('simple', $1)")
        expect(sql).toContain('LIMIT 200')
        expect(sql).toContain('last_used_at ASC NULLS FIRST')
        expect(query.mock.calls[0]![1]?.[0]).toBe('cake | pastry')
        expect(objectStore.objectExists).not.toHaveBeenCalled()
    })

    it('[TC-F38-PERSIST-05/06] re-reads a concurrent winner and validates its object after commit', async () => {
        // Arrange
        const poolQuery = vi.fn().mockResolvedValue({ rows: [] })
        const transactionQuery = vi.fn(async (sql: string) => {
            if (sql.includes('FROM stock_image_catalog')) return { rows: [catalogRow] }
            return { rows: [] }
        })
        const client = { query: transactionQuery, release: vi.fn() }
        const pool = { query: poolQuery, connect: vi.fn().mockResolvedValue(client) }
        const objectStore: StockObjectStore = {
            objectExists: vi.fn().mockResolvedValue(true),
            put: vi.fn().mockResolvedValue(undefined),
        }
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            Buffer.from([0xff, 0xd8, 0xff]),
            { status: 200, headers: { 'content-type': 'image/jpeg' } },
        ))
        const repository = createStockCatalogRepository(payloadWithPool(pool), {
            objectStore,
            fetchImpl: fetchMock,
        })

        // Act
        const result = await repository.persistStockCandidate(stockCandidate)

        // Assert
        expect(result).toMatchObject({ catalogId: 2, mediaId: 3 })
        expect(transactionQuery).toHaveBeenCalledWith('COMMIT')
        expect(transactionQuery.mock.calls.some(([sql]) =>
            String(sql).includes('INSERT INTO media'))).toBe(false)
        expect(objectStore.put).toHaveBeenCalledOnce()
        expect(objectStore.objectExists).toHaveBeenCalledWith(catalogRow.object_key, true)
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('[TC-F38-REUSE-01] reuses an existing catalog row without download, Media insert, or upload', async () => {
        // Arrange
        const pool = {
            query: vi.fn().mockResolvedValue({ rows: [catalogRow] }),
            connect: vi.fn(),
        }
        const objectStore: StockObjectStore = {
            objectExists: vi.fn().mockResolvedValue(true),
            put: vi.fn(),
        }
        const fetchMock = vi.fn()
        const repository = createStockCatalogRepository(payloadWithPool(pool), {
            objectStore,
            fetchImpl: fetchMock,
        })

        // Act
        const result = await repository.persistStockCandidate(stockCandidate)

        // Assert
        expect(result).toMatchObject({ mediaId: 3, objectKey: catalogRow.object_key })
        expect(fetchMock).not.toHaveBeenCalled()
        expect(objectStore.put).not.toHaveBeenCalled()
        expect(pool.connect).not.toHaveBeenCalled()
    })
})
