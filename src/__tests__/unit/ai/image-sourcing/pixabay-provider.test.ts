// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    createF38PixabayProvider,
    createPixabayCacheKey,
    getProcessPixabayKeyRing,
    getProcessPixabayResponseCache,
    parsePixabayKeys,
    PixabayAttemptBudget,
    PixabayKeyRing,
    resetProcessPixabayKeyRingForTests,
    resetProcessPixabayResponseCacheForTests,
    type PixabayResponseCache,
} from '@/lib/ai/image-sourcing'

function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(headers),
        json: vi.fn().mockResolvedValue(body),
    } as unknown as Response
}

const hit = {
    id: 42,
    pageURL: 'https://pixabay.com/photos/42',
    webformatURL: 'https://pixabay.com/get/42_640.jpg',
    largeImageURL: 'https://pixabay.com/get/42_1280.jpg',
    tags: 'cake, bakery',
    user: 'Maker',
    imageWidth: 1280,
    imageHeight: 853,
}

afterEach(() => {
    resetProcessPixabayKeyRingForTests()
    resetProcessPixabayResponseCacheForTests()
})

describe('[TC-F38-BUDGET-07–10] shared cache and single-flight', () => {
    it('keeps Pixabay responses in the process cache until expiry', async () => {
        // Arrange
        const cache = getProcessPixabayResponseCache()
        const expiresAt = new Date(Date.now() + 86_400_000)

        // Act
        await cache.set('cache-key', { hits: [hit] }, expiresAt)

        // Assert
        expect(await cache.get('cache-key')).toEqual({ hits: [hit] })
    })

    it('builds a canonical key independent of parameter insertion and credentials', () => {
        // Arrange
        const parameters = {
            query: '  CÁKE ',
            orientation: 'horizontal' as const,
            category: 'Food',
            perPage: 200,
        }

        // Act
        const key = createPixabayCacheKey(parameters)
        const same = createPixabayCacheKey({ ...parameters, query: 'cáke' })

        // Assert
        expect(key).toBe(same)
        expect(key).toMatch(/^[a-f0-9]{64}$/)
    })

    it('coalesces concurrent misses so only one fetch and budget unit are used', async () => {
        // Arrange
        const values = new Map<string, unknown>()
        const cache: PixabayResponseCache = {
            get: vi.fn(async (key) => (values.get(key) as { hits: typeof hit[] }) ?? null),
            set: vi.fn(async (key, value) => { values.set(key, value) }),
        }
        const fetchMock = vi.fn(async () => {
            await Promise.resolve()
            return response(200, { hits: [hit] })
        })
        const provider = createF38PixabayProvider({
            cache,
            keyRing: new PixabayKeyRing(['a'.repeat(12)]),
            fetch: fetchMock,
        })
        const concurrentGenerationProvider = createF38PixabayProvider({
            cache,
            keyRing: new PixabayKeyRing(['b'.repeat(12)]),
            fetch: fetchMock,
        })
        const budget = new PixabayAttemptBudget()
        const input = {
            query: 'cake',
            orientation: 'horizontal' as const,
            category: 'food',
            perPage: 200,
            budget,
            reservation: 'failover' as const,
        }

        // Act
        const [first, second] = await Promise.all([
            provider.search(input),
            concurrentGenerationProvider.search(input),
        ])

        // Assert
        expect(first.ok).toBe(true)
        expect(second.ok).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(budget.attemptsUsed).toBe(1)
        expect(cache.set).toHaveBeenCalledTimes(1)
    })

    it('continues with a valid provider response when cache read and write fail', async () => {
        // Arrange
        const cache: PixabayResponseCache = {
            get: vi.fn().mockRejectedValue(new Error('database unavailable')),
            set: vi.fn().mockRejectedValue(new Error('database unavailable')),
        }
        const fetchMock = vi.fn().mockResolvedValue(response(200, { hits: [hit] }))
        const provider = createF38PixabayProvider({
            cache,
            keyRing: new PixabayKeyRing(['a'.repeat(12)]),
            fetch: fetchMock,
        })
        const budget = new PixabayAttemptBudget()

        // Act
        const result = await provider.search({
            query: `  ${'CAKE '.repeat(30)} `,
            orientation: 'horizontal',
            category: 'food',
            perPage: 200,
            budget,
            reservation: 'primary',
        })

        // Assert
        expect(result.ok).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const requestedUrl = fetchMock.mock.calls[0]![0] as URL
        expect(requestedUrl.searchParams.get('q')?.length).toBeLessThanOrEqual(100)
        expect(budget.attemptsUsed).toBe(1)
    })
})

describe('[TC-F38-KEY-01–07] isolated multi-key state', () => {
    it('parses, trims, deduplicates, validates, and falls back to the legacy key', () => {
        // Arrange
        const valid = 'a'.repeat(10)

        // Act
        const list = parsePixabayKeys(` short, ${valid}, ${valid}, ${'b'.repeat(11)} `, 'legacy-key-value')
        const fallback = parsePixabayKeys('short', 'legacy-key-value')

        // Assert
        expect(list).toEqual([valid, 'b'.repeat(11)])
        expect(fallback).toEqual(['legacy-key-value'])
    })

    it('round-robins healthy keys and isolates disabled and cooled keys', () => {
        // Arrange
        let now = 1_000
        const ring = new PixabayKeyRing(['a'.repeat(10), 'b'.repeat(10)], () => now)

        // Act
        const first = ring.select()!
        ring.recordResponse(first.index, 401)
        const second = ring.select()!
        ring.recordResponse(second.index, 429, '10')
        const unavailable = ring.select()
        now += 10_000
        const recovered = ring.select()

        // Assert
        expect(first.index).toBe(0)
        expect(second.index).toBe(1)
        expect(unavailable).toBeNull()
        expect(recovered?.index).toBe(1)
    })

    it('cools one key only after three consecutive 5xx responses', () => {
        // Arrange
        let now = 0
        const ring = new PixabayKeyRing(['a'.repeat(10)], () => now)

        // Act
        ring.recordResponse(0, 500)
        ring.recordResponse(0, 502)
        const beforeThird = ring.select()
        ring.recordResponse(0, 503)
        const cooled = ring.select()
        now = 60_000
        const recovered = ring.select()

        // Assert
        expect(beforeThird).not.toBeNull()
        expect(cooled).toBeNull()
        expect(recovered).not.toBeNull()
    })

    it('TC-F38-KEY-03: shares cursor and health across generation-scoped providers', () => {
        // Arrange
        const environment = {
            PIXABAY_API_KEYS: `${'a'.repeat(10)},${'b'.repeat(10)}`,
        } as NodeJS.ProcessEnv

        // Act
        const firstGeneration = getProcessPixabayKeyRing(environment)
        const first = firstGeneration.select()!
        firstGeneration.recordResponse(first.index, 401)
        const secondGeneration = getProcessPixabayKeyRing(environment)
        const second = secondGeneration.select()

        // Assert
        expect(secondGeneration).toBe(firstGeneration)
        expect(first.index).toBe(0)
        expect(second?.index).toBe(1)
    })
})

describe('[TC-F38-KEY-04–06] F38 Pixabay provider key health', () => {
    it('counts before fetch and marks auth failures eligible for budgeted failover', async () => {
        // Arrange
        const cache: PixabayResponseCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn(),
        }
        const provider = createF38PixabayProvider({
            cache,
            keyRing: new PixabayKeyRing(['a'.repeat(10), 'b'.repeat(10)]),
            fetch: vi.fn().mockResolvedValue(response(401, {})),
        })
        const budget = new PixabayAttemptBudget()

        // Act
        const result = await provider.search({
            query: 'cake',
            orientation: 'horizontal',
            category: 'food',
            perPage: 200,
            budget,
            reservation: 'primary',
        })

        // Assert
        expect(result).toEqual({
            ok: false,
            reason: 'auth',
            failoverEligible: true,
            keyIndex: 0,
        })
        expect(budget.attemptsUsed).toBe(1)
        expect(cache.set).not.toHaveBeenCalled()
    })
})
