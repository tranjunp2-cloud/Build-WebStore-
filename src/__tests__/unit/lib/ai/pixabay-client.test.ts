// @vitest-environment node
/**
 * Unit tests for src/lib/ai/pixabay-client.ts
 * TC-F38-PIXABAY-01 through TC-F38-PIXABAY-11
 *
 * Tests import from source — no reimplementation of logic.
 * Global fetch is stubbed; no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchPhotos, downloadPhotoBuffer, detectQueryLang, photoMatchesQuery, photoMatchesTerms, PixabayError, PIXABAY_CATEGORY_BY_COMPOSER, __resetPixabayCircuitForTests } from '@/lib/ai/pixabay-client'

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
    __resetPixabayCircuitForTests()
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

    it('[TC-F38-PIXABAY-06] 429 opens the circuit without retrying', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 429,
            headers: new Headers(),
        } as unknown as Response)

        // Act + Assert
        await expect(searchPhotos('nature', 5)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
        await expect(searchPhotos('city', 5)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: false })
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    })

    it('[TC-GENPERF-W3-09] 503 opens the circuit for later search branches', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 503,
            headers: new Headers(),
        } as unknown as Response)

        await expect(searchPhotos('spa', 6)).rejects.toMatchObject({ code: 'SERVER_ERROR', status: 503 })
        await expect(searchPhotos('beauty', 6)).rejects.toMatchObject({ code: 'SERVER_ERROR', retryable: false })
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
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

    it('[TC-F38-PIXABAY-13] TimeoutError on download → TIMEOUT, not DOWNLOAD_FAIL', async () => {
        // Arrange — same bug class as TC-12: downloadPhotoBuffer's own
        // AbortSignal.timeout throws 'TimeoutError', previously misfiled
        // as DOWNLOAD_FAIL because only 'AbortError' was matched.
        const timeoutErr = new Error('The operation was aborted due to timeout')
        timeoutErr.name = 'TimeoutError'
        vi.mocked(fetch).mockRejectedValue(timeoutErr)

        // Act + Assert
        await expect(
            downloadPhotoBuffer('https://pixabay.com/get/photo-1_1280.jpg'),
        ).rejects.toMatchObject({ code: 'TIMEOUT' })
    })
})

// ── GH-1611: term-aware relevance gate ──────────────────────────────────────

describe('TC-GH1611 — photoMatchesTerms (term-aware gate)', () => {
    it('[TC-GH1611-20] keeps the GH-1185 invariant: a 2-word term needs both words', () => {
        // The original bug: q="phở bò" matched Scottish cattle tagged "bò ghàidhealach".
        expect(photoMatchesTerms('scottish cattle, bò ghàidhealach', ['phở bò'])).toBe(false)
        expect(photoMatchesTerms('phở bò, món ăn việt nam', ['phở bò'])).toBe(true)
    })

    it('[TC-GH1611-21] a multi-term query does not demand one photo satisfy every term', () => {
        // AND-matching the joined query would require a photo be both a cake and a
        // baguette — no photo is, so every on-industry photo was thrown away and the
        // pool fell through to off-industry fallbacks (clothing in a bakery gallery).
        const terms = ['chocolate birthday cake', 'crusty baguette bread']
        expect(photoMatchesTerms('cake, chocolate, dessert', terms)).toBe(true)
        expect(photoMatchesTerms('bread, baguette, bakery', terms)).toBe(true)
    })

    it('[TC-GH1611-22] a 3+ word term needs the head noun AND a modifier', () => {
        // Head noun ("cake") + a modifier ("chocolate") → it is the product.
        expect(photoMatchesTerms('cake, chocolate, dessert', ['chocolate birthday cake'])).toBe(true)
        // Modifiers without the head noun → a balloon party, not a cake.
        expect(photoMatchesTerms('birthday, party, balloons, chocolate', ['chocolate birthday cake'])).toBe(false)
        // Head noun alone is NOT enough — that rule let the shirt-rack photo from the
        // GH-1611 report satisfy a leather-goods shop via the shared word "store".
        expect(photoMatchesTerms('shirt rack, clothing store, retail', ['leather handbag store'])).toBe(false)
        // Deliberate false negative: a real cake tagged only "cake, sweet, food" is
        // dropped. The ladder backfills on-category; a wrong photo cannot be undone.
        expect(photoMatchesTerms('cake, sweet, food', ['chocolate birthday cake'])).toBe(false)
    })

    it('[TC-GH1611-26] GH-1185 holds at longer arities, not just 2-word dishes', () => {
        // The original GH-1185 example: q="cơm cá kho tộ" must NOT match dried anchovy
        // ("cá cơm") photos, which share the words "cá" and "cơm". A "2 of N" rule would
        // have let this back in — hence the head-noun requirement ("tộ" is absent).
        expect(photoMatchesTerms('cá cơm, anchovy, dried fish', ['cơm cá kho tộ'])).toBe(false)
        expect(photoMatchesTerms('cơm tấm, sườn nướng, món việt', ['cơm tấm sườn nướng'])).toBe(true)
    })

    it('[TC-GH1611-27] matches whole tag tokens, not substrings', () => {
        // Substring matching made "tea" match "team", "art" match "cartoon", and
        // "pho" match "photography" — a bubble-tea shop got office meeting photos.
        expect(photoMatchesTerms('team, meeting, office', ['tea'])).toBe(false)
        expect(photoMatchesTerms('cartoon, drawing, kids', ['art'])).toBe(false)
        expect(photoMatchesTerms('photography, camera, lens', ['pho'])).toBe(false)
        // Compounds still count from 4 chars up: a cupcake IS a cake.
        expect(photoMatchesTerms('cupcake, frosting, sweet', ['cake'])).toBe(true)
        // ...and so do inflections of the same stem (5+ chars): Pixabay tags the
        // cupcake photo "frosting" while the merchant typed "frosted cupcake".
        expect(photoMatchesTerms('cupcake, frosting, sweet', ['frosted cupcake'])).toBe(true)
        // The stem rule must not resurrect the substring false positives:
        expect(photoMatchesTerms('breadboard, circuit, arduino', ['artisan sourdough bread'])).toBe(false)
        expect(photoMatchesTerms('punching bag, gym, boxing', ['handmade leather bag'])).toBe(false)
    })

    it('[TC-GH1611-29] a compound must END with the word — starting with it is a different thing', () => {
        // These all passed under naive substring/prefix matching and are the whole
        // reason the rule is suffix-anchored: a breadboard is not bread, a tablet is
        // not a table, a plantation is not a plant.
        expect(photoMatchesTerms('breadboard, circuit, arduino', ['bread'])).toBe(false)
        expect(photoMatchesTerms('tablet, computer, screen', ['table'])).toBe(false)
        expect(photoMatchesTerms('plantation, field, palm', ['plant'])).toBe(false)
        expect(photoMatchesTerms('paperclip, office, desk', ['paper'])).toBe(false)
        expect(photoMatchesTerms('cabinet, kitchen, wooden', ['rustic wooden cabin'])).toBe(false)
        // The suffix must be attached to a real morpheme (>=3 chars), or the rule
        // reads "price" as rice and "chair" as hair.
        expect(photoMatchesTerms('price tag, sale, discount', ['rice'])).toBe(false)
        expect(photoMatchesTerms('chair, furniture, wood', ['hair'])).toBe(false)
        expect(photoMatchesTerms('coats, winter, fashion', ['oats'])).toBe(false)
        // Real compounds (word at the END) still match — a cupcake IS a cake.
        expect(photoMatchesTerms('cheesecake, berry, slice', ['cake'])).toBe(true)
        // Inflections still match — "grilled" IS "grill".
        expect(photoMatchesTerms('grilled pork, bbq, charcoal', ['grill'])).toBe(true)
    })

    it('[TC-GH1611-30] merchant plurals match Pixabay singulars (and vice versa)', () => {
        // Merchants type their product list in the plural ("Cakes, Cupcakes, Pastries")
        // while Pixabay tags the singular subject ("cake"). A stemmer applied
        // asymmetrically ("cakes"→"cak" but "cake"→"cake") rejects every photo of the
        // very product the gate exists to find — the bakery then fills its gallery from
        // the ungated category tier, which is how GH-1611 looked in the first place.
        expect(photoMatchesTerms('cake, chocolate, dessert', ['cakes'])).toBe(true)
        expect(photoMatchesTerms('cupcake, frosting, sweet', ['cupcakes'])).toBe(true)
        expect(photoMatchesTerms('pastry, croissant, bakery', ['pastries'])).toBe(true)
        expect(photoMatchesTerms('cookie, biscuit, dessert', ['cookies'])).toBe(true)
        expect(photoMatchesTerms('noodle, soup, asian', ['noodles'])).toBe(true)
        expect(photoMatchesTerms('dress, fashion, model', ['dresses'])).toBe(true)
        // Reverse direction — Pixabay tags the plural, merchant typed the singular.
        expect(photoMatchesTerms('cakes, birthday, party', ['cake'])).toBe(true)
        // Plural + compound head together: cheesecake IS a cake.
        expect(photoMatchesTerms('cheesecake, dessert, slice', ['cakes'])).toBe(true)
        // Still rejects the off-industry photo — matching plurals must not soften the gate.
        expect(photoMatchesTerms('jeans, denim, fashion', ['cakes'])).toBe(false)
    })

    it('[TC-GH1611-28] never gate on mood adjectives — they admit anything', () => {
        // A 1-word term needs 1 hit, so "minimalist"/"bright" as gate terms would let a
        // clothing flatlay into a bakery pool. Callers pass SUBJECT terms only; this
        // test documents WHY (the gate itself cannot tell an adjective from a noun).
        expect(photoMatchesTerms('jeans, flatlay, minimalist', ['minimalist'])).toBe(true)
        expect(photoMatchesTerms('jeans, flatlay, minimalist', ['chocolate birthday cake'])).toBe(false)
    })

    it('[TC-GH1611-23] rejects cross-industry photos — the reported symptom', () => {
        expect(
            photoMatchesTerms('jeans, knit hat, flatlay', ['chocolate birthday cake', 'frosted cupcake']),
        ).toBe(false)
        expect(
            photoMatchesTerms('shirt rack, clothing store, retail', ['banh mi', 'vietnamese bread']),
        ).toBe(false)
    })

    it('[TC-GH1611-24] single-word term must appear; empty tags/terms handled', () => {
        expect(photoMatchesTerms('ramen, noodle soup', ['ramen'])).toBe(true)
        expect(photoMatchesTerms('pizza, italian', ['ramen'])).toBe(false)
        expect(photoMatchesTerms(null, ['ramen'])).toBe(false)
        expect(photoMatchesTerms('anything', [])).toBe(true) // no terms → nothing to gate on
    })

    it('[TC-GH1611-25] NFC-normalizes both sides (decomposed VN input)', () => {
        const decomposed = 'phở bò'.normalize('NFD')
        expect(photoMatchesTerms('phở bò, món ăn việt nam', [decomposed])).toBe(true)
    })

    it('[TC-GH1611-M1] Vietnamese head-initial anchoring vs English head-final anchoring', () => {
        // Vietnamese term: 4 words, head is words[0] = "bánh"
        const viTerm = 'bánh mì thịt nướng'
        
        // Match: tags contain head "bánh" + modifier "mì" (2 hits total)
        expect(photoMatchesTerms('bánh mì, sandwich, vietnam', [viTerm])).toBe(true)
        
        // Reject: tags contain modifiers "thịt", "nướng" (2 hits) but miss the head "bánh"
        expect(photoMatchesTerms('thịt nướng, bbq, grill', [viTerm])).toBe(false)

        // English term: 3 words, head is words[2] = "cake"
        const enTerm = 'chocolate birthday cake'
        
        // Match: tags contain head "cake" + modifier "chocolate"
        expect(photoMatchesTerms('cake, chocolate, dessert', [enTerm])).toBe(true)
        
        // Reject: tags contain modifiers "chocolate", "birthday" (2 hits) but miss the head "cake"
        expect(photoMatchesTerms('chocolate, birthday, celebration', [enTerm])).toBe(false)
    })
})
