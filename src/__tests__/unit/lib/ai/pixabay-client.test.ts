// @vitest-environment node
/**
 * Unit tests for src/lib/ai/pixabay-client.ts
 * TC-F38-PIXABAY-01 through TC-F38-PIXABAY-08
 *
 * Tests import from source — no reimplementation of logic.
 * Global fetch is stubbed; no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchPhotos, downloadPhotoBuffer, PixabayError } from '@/lib/ai/pixabay-client'

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

    it('[TC-F38-PIXABAY-05] size pick: width≥900 → largeImageURL; width<900 → webformatURL', async () => {
        // Arrange
        const hit = makeHit(1)

        // width >= 900 → largeImageURL (≥ LARGE_SIZE_MIN_WIDTH constant)
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([hit]))
        let photos = await searchPhotos('test', 1, { width: 1200 })
        expect(photos[0]!.url).toBe(`https://pixabay.com/get/photo-1_1280.jpg`)

        // width < 900 → webformatURL
        vi.mocked(fetch).mockResolvedValue(makeApiResponse([hit]))
        photos = await searchPhotos('test', 1, { width: 640 })
        expect(photos[0]!.url).toBe(`https://pixabay.com/get/photo-1_640.jpg`)
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
})
