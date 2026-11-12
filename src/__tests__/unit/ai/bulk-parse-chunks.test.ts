/**
 * TC-AIWB-122 — bulk add reads a long product list in chunks: the split call, the chunk size and
 * parallelism, one retry per chunk, the pieces left unread, SKU de-duplication and the fallbacks.
 */
import { describe, expect, it, vi } from 'vitest'
import {
    BULK_CHUNK_CONCURRENCY,
    BULK_CHUNK_SIZE,
    BULK_SPLIT_MIN_CHARS,
    chunkEvenly,
    dedupeSkus,
    parseProductsInChunks,
    splitLooksComplete,
} from '@/lib/ai/bulk-parse-chunks'

const piece = (n: number) => `product number ${n} in cotton, colours red and blue, sizes S M L, price RM${10 + n}`
const pieces = (n: number) => Array.from({ length: n }, (_, i) => piece(i + 1))
const longText = (n: number) => pieces(n).join(', ')
const far = () => Date.now() + 55_000
/** a parse answer: one product per line of the chunk */
const productsOf = (text: string) => ({ products: text.split('\n').map((line) => ({ name: line.slice(0, 20), sku: 'SKU-1' })) })

describe('chunkEvenly / splitLooksComplete / dedupeSkus [TC-AIWB-122]', () => {
    it('splits into the fewest, most even chunks', () => {
        // Act + Assert
        expect(chunkEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5).map((c) => c.length)).toEqual([4, 4, 4])
        expect(chunkEvenly([1, 2, 3], 5)).toEqual([[1, 2, 3]])
        expect(chunkEvenly([], 5)).toEqual([])
    })

    it('treats a split that kept less than half the text as incomplete', () => {
        // Arrange
        const text = longText(10)

        // Act + Assert
        expect(splitLooksComplete(text, pieces(10))).toBe(true)
        expect(splitLooksComplete(text, pieces(3))).toBe(false)
    })

    it('renames a repeated SKU with -2, -3 and keeps the first one', () => {
        // Act
        const out = dedupeSkus([{ sku: 'TS-RED' }, { sku: 'ts-red' }, { sku: 'TS-RED' }, { name: 'no sku' }])

        // Assert
        expect(out.map((p) => p.sku)).toEqual(['TS-RED', 'ts-red-2', 'TS-RED-3', undefined])
    })
})

describe('parseProductsInChunks [TC-AIWB-122]', () => {
    it('sends a short text in one call, without splitting', async () => {
        // Arrange
        const split = vi.fn()
        const parse = vi.fn(async () => ({ products: [{ name: 'Mug' }] }))

        // Act
        const result = await parseProductsInChunks({ promptText: '2 mugs RM10', deadlineAt: far(), split, parse })

        // Assert
        expect(split).not.toHaveBeenCalled()
        expect(parse).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ products: [{ name: 'Mug' }], unparsed: [] })
    })

    it('splits a long list and parses it in chunks of at most 5, at most 3 at once, in order', async () => {
        // Arrange
        const text = longText(15)
        expect(text.length).toBeGreaterThanOrEqual(BULK_SPLIT_MIN_CHARS)
        let inFlight = 0
        let peak = 0
        const parse = vi.fn(async (chunk: string) => {
            inFlight += 1
            peak = Math.max(peak, inFlight)
            await new Promise((resolve) => setTimeout(resolve, 5))
            inFlight -= 1
            return productsOf(chunk)
        })

        // Act
        const result = await parseProductsInChunks({ promptText: text, deadlineAt: far(), split: async () => pieces(15), parse })

        // Assert
        expect(parse).toHaveBeenCalledTimes(3)
        expect(parse.mock.calls.map(([chunk]) => chunk.split('\n').length)).toEqual([BULK_CHUNK_SIZE, BULK_CHUNK_SIZE, BULK_CHUNK_SIZE])
        expect(peak).toBeLessThanOrEqual(BULK_CHUNK_CONCURRENCY)
        expect(result.products).toHaveLength(15)
        expect(result.products[0]!.name).toBe(piece(1).slice(0, 20))
        expect(new Set(result.products.map((p) => p.sku)).size).toBe(15)
        expect(result.unparsed).toEqual([])
    })

    it('retries a failed chunk once and returns its products', async () => {
        // Arrange
        let failures = 0
        const parse = vi.fn(async (chunk: string) => {
            if (chunk.startsWith(piece(6)) && failures++ === 0) throw new Error('busy')
            return productsOf(chunk)
        })

        // Act
        const result = await parseProductsInChunks({ promptText: longText(15), deadlineAt: far(), split: async () => pieces(15), parse })

        // Assert
        expect(parse).toHaveBeenCalledTimes(4)
        expect(result.products).toHaveLength(15)
        expect(result.unparsed).toEqual([])
    })

    it('returns the other chunks and the merchant words of a chunk that failed twice', async () => {
        // Arrange
        const parse = vi.fn(async (chunk: string) => {
            if (chunk.startsWith(piece(11))) throw new Error('unavailable')
            return productsOf(chunk)
        })

        // Act
        const result = await parseProductsInChunks({ promptText: longText(15), deadlineAt: far(), split: async () => pieces(15), parse })

        // Assert
        expect(result.products).toHaveLength(10)
        expect(result.unparsed).toEqual(pieces(15).slice(10))
    })

    it('does not retry when the budget has no room left', async () => {
        // Arrange
        const parse = vi.fn(async (chunk: string) => {
            if (chunk.startsWith(piece(1))) throw new Error('timeout')
            return productsOf(chunk)
        })

        // Act
        const result = await parseProductsInChunks({ promptText: longText(15), deadlineAt: Date.now() + 5_000, split: async () => pieces(15), parse })

        // Assert
        expect(parse).toHaveBeenCalledTimes(3)
        expect(result.unparsed).toEqual(pieces(5))
    })

    it('throws the first error when every chunk failed', async () => {
        // Arrange
        const quota = Object.assign(new Error('quota'), { status: 429 })

        // Act + Assert
        await expect(
            parseProductsInChunks({ promptText: longText(15), deadlineAt: far(), split: async () => pieces(15), parse: async () => { throw quota } }),
        ).rejects.toBe(quota)
    })

    it.each([
        ['the split call fails', async () => { throw new Error('down') }],
        ['the split dropped most of the text', async () => pieces(15).slice(0, 7)],
        ['the split found no more than one chunk of products', async () => [longText(15)]],
    ])('parses the whole text in one call when %s', async (_case, split) => {
        // Arrange
        const parse = vi.fn(async () => ({ products: [{ name: 'All' }] }))

        // Act
        const result = await parseProductsInChunks({ promptText: longText(15), deadlineAt: far(), split, parse })

        // Assert
        expect(parse).toHaveBeenCalledTimes(1)
        expect(parse.mock.calls[0]![0]).toBe(longText(15))
        expect(result).toEqual({ products: [{ name: 'All' }], unparsed: [] })
    })
})
