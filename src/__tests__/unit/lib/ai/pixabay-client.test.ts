// @vitest-environment node
/**
 * Unit tests for src/lib/ai/pixabay-client.ts
 * TC-F38-PIXABAY-01 through TC-F38-PIXABAY-11
 *
 * Tests import from source — no reimplementation of logic.
 * Global fetch is stubbed; no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchPhotos, downloadPhotoBuffer, detectQueryLang, photoMatchesQuery, PixabayError, PIXABAY_CATEGORY_BY_COMPOSER } from '@/lib/ai/pixabay-client'

// Stub global fetch at module scope (top-level vi.mock not needed; fetch is global)
vi.stubGlobal('fetch', vi.fn())

const DUMMY_KEY = 'a'.repeat(20) // ≥10 chars — satisfies hasPixabayKey()

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FakeHit {
    id: number
    webformatURL?: string
    largeImageURL?: string
    tags?: string
    user?: string
    imageWidth?: number
    imageHeight?: number
}

function makeHit(id: number, overrides: Partial<FakeHit> = {}): FakeHit {
    return {
        id,
        webformatURL: `https://pixabay.com/get/photo-${id}_640.jpg`,
        largeImageURL: `https://pixabay.com/get/photo-${id}_1280.jpg`,
        tags: `tag${id}, nature, scenic`,
        user: `user${id}`,
        imageWidth: 1280,
        imageHeight: 853,
        ...overrides,
    }
}

function makeApiResponse(hits: FakeHit[]) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ total: hits.length, totalHits: hits.length, hits }),
    } as unknown as Response
}

function makeDownloadResponse(data: Uint8Array, mimeType = 'image/jpeg') {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': mimeType }),
        arrayBuffer: vi.fn().mockResolvedValue(data.buffer),
    } as unknown as Response
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
    process.env.PIXABAY_API_KEY = DUMMY_KEY
    vi.mocked(fetch).mockReset()
})

afterEach(() => {
    delete process.env.PIXABAY_API_KEY
    vi.useRealTimers()
})

// ── searchPhotos ─────────────────────────────────────────────────────────────

describe('searchPhotos', () => {
    it('[TC-F38-PIXABAY-01] maps API hits to PixabayPhoto shape', async () => {
        // Arrange
        const hit = makeHit(42)
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([hit]))

        // Act
        const photos = await searchPhotos('nature', 1)

        // Assert
        expect(photos).toHaveLength(1)
        const photo = photos[0]!
        expect(photo.id).toBe('42')
        // width unspecified (undefined) → wantsLarge=true → largeImageURL
        expect(photo.url).toBe(`https://pixabay.com/get/photo-42_1280.jpg`)
        expect(photo.alt).toBe(hit.tags)
        expect(photo.photographer).toBe(hit.user)
        expect(photo.width).toBe(hit.imageWidth)
        expect(photo.height).toBe(hit.imageHeight)
    })

    it('[TC-F38-PIXABAY-02] orientation mapping: landscape→horizontal, portrait→vertical, squarish→all', async () => {
        // Arrange — each sub-case returns empty hits to keep it simple
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([]))

        // landscape
        await searchPhotos('test', 1, { orientation: 'landscape' })
        let url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('orientation')).toBe('horizontal')

        vi.mocked(fetch).mockClear()
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([]))

        // portrait
        await searchPhotos('test', 1, { orientation: 'portrait' })
        url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('orientation')).toBe('vertical')

        vi.mocked(fetch).mockClear()
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([]))

        // squarish
        await searchPhotos('test', 1, { orientation: 'squarish' })
        url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('orientation')).toBe('all')
    })

    it('[TC-F38-RAW-06] raw VN q URL-encoded verbatim + lang=vi auto-detected', async () => {
        // Arrange — GH-1185: keywords sent RAW (user language). Vietnamese
        // queries get lang=vi so Pixabay matches VN tags instead of
        // diacritic-stripped partials ("cơm" → "myfirstpug.com").
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([]))

        // Act
        await searchPhotos('phở bò', 5, { orientation: 'landscape' })

        // Assert
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('q')).toBe('phở bò')
        expect(url.searchParams.get('lang')).toBe('vi')
    })

    it('[TC-F38-RAW-07] English/Malay q keeps Pixabay default lang (no lang param)', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([]))

        // Act — plain English and a French/Malay loanword with é (ambiguous
        // diacritic) must NOT be misrouted to lang=vi.
        await searchPhotos('café latte barista', 5, { orientation: 'landscape' })

        // Assert
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.has('lang')).toBe(false)
    })

    it('[TC-F38-RAW-08] detectQueryLang: unambiguous VN chars → vi, Latin-script → undefined', () => {
        // Arrange + Act + Assert — pure function
        expect(detectQueryLang('cơm bò')).toBe('vi')
        expect(detectQueryLang('gỏi cuốn tôm')).toBe('vi')
        expect(detectQueryLang('nhà hàng hải sản')).toBe('vi')
        expect(detectQueryLang('nasi lemak ayam')).toBeUndefined()
        expect(detectQueryLang('modern office')).toBeUndefined()
        expect(detectQueryLang('café résumé')).toBeUndefined()
    })

    it('[TC-F38-RAW-09] detectQueryLang: script-based detection for th/ja/ko/zh/ru/el', () => {
        // Arrange + Act + Assert — pure function, one query per script
        expect(detectQueryLang('อาหารไทย ต้มยำ')).toBe('th')
        expect(detectQueryLang('ラーメン 寿司')).toBe('ja') // kana wins over kanji
        expect(detectQueryLang('한국 음식 비빔밥')).toBe('ko')
        expect(detectQueryLang('中国菜 面条')).toBe('zh') // kanji-only → zh
        expect(detectQueryLang('русский ресторан')).toBe('ru')
        expect(detectQueryLang('ελληνικό φαγητό')).toBe('el')
    })

    it('[TC-F38-RAW-10] searchPhotos sets lang matching detected script, keyword stays raw', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1)]))

        // Act — Thai input → lang=th, q untouched (no translation)
        await searchPhotos('อาหารไทย', 5, { orientation: 'landscape' })

        // Assert
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('lang')).toBe('th')
        expect(url.searchParams.get('q')).toBe('อาหารไทย')
    })

    it('[TC-F38-RAW-11] searchPhotos passes category filter; omitted when unset', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1)]))

        // Act — with category
        await searchPhotos('phở bò', 5, { orientation: 'landscape', category: 'food' })

        // Assert
        let url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('category')).toBe('food')

        vi.mocked(fetch).mockClear()
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1)]))

        // Act — without category
        await searchPhotos('phở bò', 5, { orientation: 'landscape' })

        // Assert
        url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.has('category')).toBe(false)
    })

    it('[TC-F38-RAW-12] PIXABAY_CATEGORY_BY_COMPOSER maps food domains; ambiguous keys absent', () => {
        // Arrange + Act + Assert — pure mapping table
        expect(PIXABAY_CATEGORY_BY_COMPOSER['restaurant']).toBe('food')
        expect(PIXABAY_CATEGORY_BY_COMPOSER['fnb']).toBe('food')
        expect(PIXABAY_CATEGORY_BY_COMPOSER['fitness']).toBe('sports')
        expect(PIXABAY_CATEGORY_BY_COMPOSER['realestate']).toBe('buildings')
        // No clean Pixabay equivalent → deliberately unmapped (no filter)
        expect(PIXABAY_CATEGORY_BY_COMPOSER['events']).toBeUndefined()
        expect(PIXABAY_CATEGORY_BY_COMPOSER['ecommerce']).toBeUndefined()
    })

    it('[TC-F38-RAW-15] opts.lang overrides detection for curated non-detectable VN phrases', async () => {
        // Arrange — "quán cà phê" (VN_CATEGORY_QUERIES.fnb) carries only
        // ambiguous diacritics (á/à/ê) → detectQueryLang misses it; the
        // explicit override must still route the search to lang=vi.
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1)]))

        // Act
        await searchPhotos('quán cà phê', 5, { orientation: 'landscape', lang: 'vi' })

        // Assert
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('lang')).toBe('vi')
        expect(url.searchParams.get('q')).toBe('quán cà phê')
        // Sanity: without the override the same query is NOT detected
        expect(detectQueryLang('quán cà phê')).toBeUndefined()
    })

    it('[TC-F38-RAW-16] NFC normalization: decomposed (NFD) Vietnamese input still detected + gated', async () => {
        // Arrange — NFD form of "phở bò" (o + combining horn + combining hook)
        const nfd = 'phở bò'.normalize('NFD')
        expect(nfd).not.toBe('phở bò') // proves the input is actually decomposed

        // Act + Assert — detection must survive decomposition
        expect(detectQueryLang(nfd)).toBe('vi')
        // Gate must match NFD query words against NFC (Pixabay-side) tags
        expect(photoMatchesQuery('phở bò, món ăn việt nam', nfd)).toBe(true)
        expect(photoMatchesQuery('scottish cattle, bò ghàidhealach', nfd)).toBe(false)

        // The wire-level `q` must be recomposed too — shipping decomposed
        // code points to Pixabay would 0-hit even with lang=vi set correctly.
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1)]))
        await searchPhotos(nfd, 5, { orientation: 'landscape' })
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(url.searchParams.get('q')).toBe('phở bò')
        expect(url.searchParams.get('lang')).toBe('vi')
    })

    it('[TC-F38-PIXABAY-03] missing PIXABAY_API_KEY → returns [] without fetching', async () => {
        // Arrange
        delete process.env.PIXABAY_API_KEY

        // Act
        const photos = await searchPhotos('nature', 5)

        // Assert
        expect(photos).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
    })

    it('[TC-F38-PIXABAY-04] count=1 requests per_page≥3; result sliced to count', async () => {
        // Arrange — API returns 3 hits, we request only 1
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([makeHit(1), makeHit(2), makeHit(3)]))

        // Act
        const photos = await searchPhotos('test', 1)

        // Assert — sliced to requested count
        expect(photos).toHaveLength(1)
        // per_page sent to API must be ≥ 3 (Pixabay minimum)
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(Number(url.searchParams.get('per_page'))).toBeGreaterThanOrEqual(3)
    })

    it('[TC-F38-PIXABAY-05] size pick: width≥700 → largeImageURL; width<700 → webformatURL', async () => {
        // Arrange
        const hit = makeHit(1)

        // width >= 700 → largeImageURL (≥ LARGE_SIZE_MIN_WIDTH constant)
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([hit]))
        let photos = await searchPhotos('test', 1, { width: 800 })
        expect(photos[0]!.url).toBe(`https://pixabay.com/get/photo-1_1280.jpg`)

        // width < 700 → webformatURL
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([hit]))
        photos = await searchPhotos('test', 1, { width: 640 })
        expect(photos[0]!.url).toBe(`https://pixabay.com/get/photo-1_640.jpg`)
    })

    it('[TC-F38-PIXABAY-09] squarish over-fetches and prefers near-square hits', async () => {
        // Arrange — 1 landscape (ar≈1.78) + 2 square hits, in landscape-first order
        const landscape = makeHit(1, { imageWidth: 1600, imageHeight: 900 })
        const squareA = makeHit(2, { imageWidth: 1000, imageHeight: 1000 })
        const squareB = makeHit(3, { imageWidth: 800, imageHeight: 800 })
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([landscape, squareA, squareB]))

        // Act — request 2 squarish
        const photos = await searchPhotos('team', 2, { orientation: 'squarish' })

        // Assert — square hits float to the front; landscape dropped by slice
        expect(photos.map((p) => p.id)).toEqual(['2', '3'])
        // over-fetch: per_page is count*3 (=6), clamped ≥3
        const url = new URL(vi.mocked(fetch).mock.calls[0]![0] as string)
        expect(Number(url.searchParams.get('per_page'))).toBe(6)
    })

    it('[TC-F38-PIXABAY-06] 429 response (twice) → throws PixabayError RATE_LIMITED', async () => {
        // Arrange — fake timers so the retry jitter (2-2.5s) resolves instantly
        vi.useFakeTimers()
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 429,
            headers: new Headers(),
        } as unknown as Response)

        // Attach .catch synchronously BEFORE advancing timers to suppress unhandled-rejection warning.
        // searchPhotos will reject after the jitter timer fires; we collect the error via `caught`.
        const caught = searchPhotos('nature', 5).catch((e: unknown) => e)

        // Act — advance past the retry jitter (2-2.5s); stays below the 15s abort timeout
        await vi.advanceTimersByTimeAsync(5_000)

        // Assert
        const err = await caught
        expect(err).toBeInstanceOf(PixabayError)
        expect((err as PixabayError).code).toBe('RATE_LIMITED')
        // initial attempt + 1 retry = 2 total fetch calls
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    })

    it('[TC-F38-PIXABAY-10] 401 response → throws PixabayError UNAUTHORIZED without retry', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 401,
            headers: new Headers(),
        } as unknown as Response)

        // Act + Assert — 401 is non-retryable, fails immediately
        await expect(searchPhotos('nature', 5)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    })

    it('[TC-F38-PIXABAY-12] TimeoutError from AbortSignal.timeout → TIMEOUT immediately, no retry', async () => {
        // Arrange — AbortSignal.timeout() rejects fetch with a DOMException
        // named 'TimeoutError' (NOT 'AbortError' — that is manual abort()).
        // Pre-fix this fell into the generic retry branch and surfaced as
        // SERVER_ERROR only after a second 15s hang.
        const timeoutErr = new Error('The operation was aborted due to timeout')
        timeoutErr.name = 'TimeoutError'
        vi.mocked(fetch).mockRejectedValue(timeoutErr)

        // Act + Assert — fail-fast: single attempt, classified TIMEOUT
        await expect(searchPhotos('nature', 5)).rejects.toMatchObject({ code: 'TIMEOUT' })
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    })
})

// ── downloadPhotoBuffer ───────────────────────────────────────────────────────

describe('downloadPhotoBuffer', () => {
    it('[TC-F38-PIXABAY-07] non-allowlisted host → throws PixabayError SSRF_BLOCKED without fetching', async () => {
        // Act + Assert
        await expect(
            downloadPhotoBuffer('https://evil.com/x.jpg'),
        ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' })
        expect(fetch).not.toHaveBeenCalled()
    })

    it('[TC-F38-PIXABAY-08] images.unsplash.com is ALLOWED (static curated fallback allowlist)', async () => {
        // Arrange — small buffer, valid JPEG content-type
        const fakeData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
        vi.mocked(fetch).mockResolvedValue(makeDownloadResponse(fakeData))

        // Act
        const result = await downloadPhotoBuffer('https://images.unsplash.com/x.jpg')

        // Assert — SSRF guard passed; result is a buffer
        expect(result.buffer).toBeInstanceOf(Buffer)
        expect(result.mimetype).toBe('image/jpeg')
        expect(result.size).toBe(fakeData.length)
        expect(fetch).toHaveBeenCalledWith(
            'https://images.unsplash.com/x.jpg',
            expect.objectContaining({ headers: expect.any(Object) }),
        )
    })

    it('[TC-F38-PIXABAY-11] buffer over maxBytes → throws PixabayError TOO_LARGE', async () => {
        // Arrange — 6-byte payload, cap at 2 bytes
        const fakeData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
        vi.mocked(fetch).mockResolvedValue(makeDownloadResponse(fakeData))

        // Act + Assert
        await expect(
            downloadPhotoBuffer('https://pixabay.com/get/photo-1_1280.jpg', 2),
        ).rejects.toMatchObject({ code: 'TOO_LARGE' })
    })
})
