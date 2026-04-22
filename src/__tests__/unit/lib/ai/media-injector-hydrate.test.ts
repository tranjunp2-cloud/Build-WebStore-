/**
 * Unit Tests — BUG-F05-12: URL → Media ingest + save pre-pass hydrate
 *
 * Coverage Map:
 *   TC-F05-12-01 → hydrate 6-slot gallery with URL-only images → all survive post-normalize
 *   TC-F05-12-02 → ingestUrlToMediaIfNeeded: numeric passthrough
 *   TC-F05-12-03 → ingestUrlToMediaIfNeeded: {id,url} → extract id
 *   TC-F05-12-04 → ingestUrlToMediaIfNeeded: disallowed host → null
 *   TC-F05-12-05 → ingestUrlToMediaIfNeeded: upload failure → null (no throw)
 *
 * Source:
 *   src/lib/ai/media-injector.ts (ingestUrlToMediaIfNeeded, hydrateUrlUploadsToMedia)
 *   src/lib/block-normalization.ts (normalizeBlocksForPersistence regression)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    ingestUrlToMediaIfNeeded,
    hydrateUrlUploadsToMedia,
    __resetIngestAllowlistCache,
} from '@/lib/ai/media-injector'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'

const CTX = { tenantId: 'tenant-1' }

function fakePayload(createImpl?: (args: unknown) => Promise<{ id: number }>) {
    return {
        create: vi.fn(createImpl ?? (async () => ({ id: 0 }))),
    }
}

function mockFetchOk(body = new Uint8Array([137, 80, 78, 71]), mimetype = 'image/png') {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': mimetype }),
        arrayBuffer: async () => body.buffer,
    } as unknown as Response)
}

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetIngestAllowlistCache()
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────
// ingestUrlToMediaIfNeeded
// ─────────────────────────────────────────────────────────────

describe('ingestUrlToMediaIfNeeded', () => {
    it('TC-F05-12-02: numeric passthrough — returns value unchanged', async () => {
        const payload = fakePayload()
        const result = await ingestUrlToMediaIfNeeded(42, CTX, payload)
        expect(result).toBe(42)
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('TC-F05-12-03: object with numeric id — extracts id, no network call', async () => {
        const payload = fakePayload()
        const result = await ingestUrlToMediaIfNeeded(
            { id: 7, url: 'https://images.unsplash.com/photo-x.jpg', alt: 'x' },
            CTX,
            payload,
        )
        expect(result).toBe(7)
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('{url, alt} on allowlisted host → fetches + uploads → returns new Media id', async () => {
        const fetchSpy = mockFetchOk()
        vi.stubGlobal('fetch', fetchSpy)
        const payload = fakePayload(async () => ({ id: 999 }))

        const result = await ingestUrlToMediaIfNeeded(
            { url: 'https://images.unsplash.com/photo-a.jpg', alt: 'A' },
            CTX,
            payload,
        )

        expect(result).toBe(999)
        expect(fetchSpy).toHaveBeenCalledOnce()
        expect(payload.create).toHaveBeenCalledOnce()
        const args = payload.create.mock.calls[0]![0] as { data: Record<string, unknown>; file: { name: string } }
        expect(args.data.tenant).toBe('tenant-1')
        expect(args.data.aiGenerated).toBe(true)
        expect(args.data.alt).toBe('A')
        expect(args.file.name).toMatch(/^ingest-[a-f0-9]{8}-\d+\.(png|jpg)$/)
    })

    it('TC-F05-12-04: disallowed host → returns null, no network call, warns', async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)
        const payload = fakePayload()

        const result = await ingestUrlToMediaIfNeeded(
            { url: 'https://evil.example.com/a.jpg', alt: '' },
            CTX,
            payload,
        )

        expect(result).toBeNull()
        expect(fetchSpy).not.toHaveBeenCalled()
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('fetch HTTP 500 → returns null (no throw)', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            headers: new Headers(),
            arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response)
        vi.stubGlobal('fetch', fetchSpy)
        const payload = fakePayload()

        const result = await ingestUrlToMediaIfNeeded(
            { url: 'https://images.unsplash.com/photo-b.jpg' },
            CTX,
            payload,
        )

        expect(result).toBeNull()
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('TC-F05-12-05: payload.create throws → returns null (no throw propagated)', async () => {
        vi.stubGlobal('fetch', mockFetchOk())
        const payload = fakePayload(async () => {
            throw new Error('boom')
        })

        const result = await ingestUrlToMediaIfNeeded(
            { url: 'https://images.unsplash.com/photo-c.jpg' },
            CTX,
            payload,
        )

        expect(result).toBeNull()
    })

    it('bare URL string on allowlisted host → ingests', async () => {
        vi.stubGlobal('fetch', mockFetchOk())
        const payload = fakePayload(async () => ({ id: 123 }))

        const result = await ingestUrlToMediaIfNeeded(
            'https://images.pexels.com/photos/1/x.jpg',
            CTX,
            payload,
        )

        expect(result).toBe(123)
    })

    it('null / undefined / non-image value → null', async () => {
        const payload = fakePayload()
        expect(await ingestUrlToMediaIfNeeded(null, CTX, payload)).toBeNull()
        expect(await ingestUrlToMediaIfNeeded(undefined, CTX, payload)).toBeNull()
        expect(await ingestUrlToMediaIfNeeded({ foo: 'bar' }, CTX, payload)).toBeNull()
        expect(payload.create).not.toHaveBeenCalled()
    })
})

// ─────────────────────────────────────────────────────────────
// hydrateUrlUploadsToMedia walker
// ─────────────────────────────────────────────────────────────

describe('hydrateUrlUploadsToMedia', () => {
    it('TC-F05-12-01: 6-slot gallery, mix of numeric + {url,alt} → all become numeric ids, all survive normalize', async () => {
        vi.stubGlobal('fetch', mockFetchOk())
        let nextId = 1000
        const payload = fakePayload(async () => ({ id: nextId++ }))

        const blocks: Record<string, unknown>[] = [
            {
                blockType: 'gallery',
                images: [
                    { image: 11 }, // pre-existing Media id
                    { image: { url: 'https://images.unsplash.com/a.jpg', alt: 'A' } },
                    { image: { url: 'https://images.unsplash.com/b.jpg', alt: 'B' } },
                    { image: 44 },
                    { image: { url: 'https://images.unsplash.com/c.jpg', alt: 'C' } },
                    { image: 66 },
                ],
            },
        ]

        const result = await hydrateUrlUploadsToMedia(blocks, payload, CTX)

        expect(result.hydrated).toBe(3)
        expect(result.failed).toBe(0)
        expect(result.skipped).toBe(0)

        // All 6 items must now have numeric image fields.
        const images = blocks[0]!.images as Record<string, unknown>[]
        expect(images).toHaveLength(6)
        for (const item of images) {
            expect(typeof item.image).toBe('number')
        }

        // Regression: normalizer must not null any slot after hydrate.
        const normalized = normalizeBlocksForPersistence(blocks) as Record<string, unknown>[]
        const normImages = normalized[0]!.images as Record<string, unknown>[]
        expect(normImages).toHaveLength(6)
        for (const item of normImages) {
            expect(typeof item.image).toBe('number')
        }
    })

    it('hero top-level image {url,alt} → hydrated to numeric (PR #681 regression guardrail)', async () => {
        vi.stubGlobal('fetch', mockFetchOk())
        const payload = fakePayload(async () => ({ id: 777 }))

        const blocks: Record<string, unknown>[] = [
            {
                blockType: 'hero',
                headline: 'Welcome',
                image: { url: 'https://images.unsplash.com/hero.jpg', alt: 'Hero' },
            },
        ]

        await hydrateUrlUploadsToMedia(blocks, payload, CTX)

        expect(blocks[0]!.image).toBe(777)
    })

    it('disallowed host on one slot — other allowlisted slots still ingest', async () => {
        const fetchSpy = mockFetchOk()
        vi.stubGlobal('fetch', fetchSpy)
        let nextId = 500
        const payload = fakePayload(async () => ({ id: nextId++ }))

        const blocks: Record<string, unknown>[] = [
            {
                blockType: 'gallery',
                images: [
                    { image: { url: 'https://evil.example.com/x.jpg' } },
                    { image: { url: 'https://images.unsplash.com/ok.jpg', alt: 'ok' } },
                ],
            },
        ]

        const result = await hydrateUrlUploadsToMedia(blocks, payload, CTX)

        expect(result.hydrated).toBe(1)
        expect(result.failed).toBe(1)

        const images = blocks[0]!.images as Record<string, unknown>[]
        // Slot 0 left as-is (object) — downstream normalizer will null it, but slot 1 survives.
        expect(typeof images[0]!.image).toBe('object')
        expect(typeof images[1]!.image).toBe('number')
    })

    it('empty blocks → returns zeros, no calls', async () => {
        const payload = fakePayload()
        const result = await hydrateUrlUploadsToMedia([], payload, CTX)
        expect(result).toEqual({ hydrated: 0, failed: 0, skipped: 0 })
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('caps at 50 slots per call, remainder recorded as skipped', async () => {
        vi.stubGlobal('fetch', mockFetchOk())
        let nextId = 1
        const payload = fakePayload(async () => ({ id: nextId++ }))

        const items = Array.from({ length: 60 }, (_, i) => ({
            image: { url: `https://images.unsplash.com/p-${i}.jpg`, alt: String(i) },
        }))
        const blocks: Record<string, unknown>[] = [{ blockType: 'gallery', images: items }]

        const result = await hydrateUrlUploadsToMedia(blocks, payload, CTX)

        expect(result.hydrated).toBe(50)
        expect(result.skipped).toBe(10)
        // First 50 should have been replaced with numeric ids.
        const images = blocks[0]!.images as Record<string, unknown>[]
        const numericCount = images.filter((x) => typeof x.image === 'number').length
        expect(numericCount).toBe(50)
    })
})
