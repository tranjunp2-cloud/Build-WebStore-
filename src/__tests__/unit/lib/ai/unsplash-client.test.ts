import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    searchPhotos,
    trackDownload,
    downloadPhotoBuffer,
    buildImgixUrl,
    UnsplashError,
} from '@/lib/ai/unsplash-client'

const ORIGINAL_FETCH = global.fetch
const ORIGINAL_KEY = process.env.UNSPLASH_ACCESS_KEY

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
    })
}

beforeEach(() => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key-12345'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    process.env.UNSPLASH_ACCESS_KEY = ORIGINAL_KEY
    vi.restoreAllMocks()
})

describe('unsplash-client [plan-260414-unsplash]', () => {
    describe('buildImgixUrl', () => {
        it('appends default q=80 and auto=format', () => {
            const result = buildImgixUrl('https://images.unsplash.com/photo-123', {
                w: 800,
                h: 600,
            })
            expect(result).toContain('w=800')
            expect(result).toContain('h=600')
            expect(result).toContain('q=80')
            expect(result).toContain('auto=format')
        })

        it('respects fit and crop params', () => {
            const result = buildImgixUrl('https://images.unsplash.com/photo-1', {
                w: 400,
                h: 400,
                fit: 'crop',
                crop: 'faces',
            })
            expect(result).toContain('fit=crop')
            expect(result).toContain('crop=faces')
        })

        it('handles urls with existing query params', () => {
            const result = buildImgixUrl('https://images.unsplash.com/photo?existing=1', {
                w: 100,
            })
            expect(result).toContain('existing=1')
            expect(result).toContain('w=100')
        })
    })

    describe('searchPhotos', () => {
        it('returns empty array for empty query', async () => {
            const result = await searchPhotos('', 5)
            expect(result).toEqual([])
        })

        it('calls Unsplash with correct headers + params', async () => {
            global.fetch = vi.fn().mockResolvedValue(
                makeResponse({ total: 1, total_pages: 1, results: [{ id: 'abc' }] }),
            )
            await searchPhotos('spa wellness', 10, { orientation: 'landscape' })
            const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
            const url = call[0] as string
            const init = call[1] as RequestInit
            expect(url).toContain('api.unsplash.com/search/photos')
            expect(url).toContain('query=spa+wellness')
            expect(url).toContain('orientation=landscape')
            const headers = init.headers as Record<string, string>
            expect(headers.Authorization).toBe('Client-ID test-key-12345')
        })

        it('returns results array from response', async () => {
            const photo = { id: 'photo-1', urls: { raw: 'https://images.unsplash.com/x' } }
            global.fetch = vi.fn().mockResolvedValue(
                makeResponse({ total: 1, total_pages: 1, results: [photo] }),
            )
            const result = await searchPhotos('cafe', 5)
            expect(result).toHaveLength(1)
            expect(result[0]!.id).toBe('photo-1')
        })

        it('throws UnsplashError NO_KEY when env missing', async () => {
            delete process.env.UNSPLASH_ACCESS_KEY
            await expect(searchPhotos('cafe', 5)).rejects.toThrow(UnsplashError)
        })

        it('throws UNAUTHORIZED on 401', async () => {
            global.fetch = vi.fn().mockResolvedValue(makeResponse({}, 401))
            await expect(searchPhotos('cafe', 5)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
        })

        it('retries once on 429 then succeeds', async () => {
            const photo = { id: 'p', urls: { raw: 'x' } }
            let callCount = 0
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) return Promise.resolve(makeResponse({}, 429))
                return Promise.resolve(makeResponse({ results: [photo] }))
            })
            const result = await searchPhotos('cafe', 5)
            expect(result).toHaveLength(1)
            expect(callCount).toBe(2)
        }, 10000)
    })

    describe('downloadPhotoBuffer', () => {
        it('rejects non-Unsplash hosts (SSRF guard)', async () => {
            await expect(
                downloadPhotoBuffer('https://evil.com/hack.jpg'),
            ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' })
        })

        it('accepts images.unsplash.com', async () => {
            const buf = Buffer.from('fake-image-data')
            global.fetch = vi.fn().mockResolvedValue(
                new Response(buf, {
                    status: 200,
                    headers: { 'content-type': 'image/jpeg' },
                }),
            )
            const result = await downloadPhotoBuffer(
                'https://images.unsplash.com/photo-1?w=800',
            )
            expect(result.buffer.length).toBeGreaterThan(0)
            expect(result.mimetype).toBe('image/jpeg')
        })

        it('rejects oversize downloads', async () => {
            const big = Buffer.alloc(11_000_000)
            global.fetch = vi.fn().mockResolvedValue(
                new Response(big, {
                    status: 200,
                    headers: { 'content-type': 'image/jpeg' },
                }),
            )
            await expect(
                downloadPhotoBuffer('https://images.unsplash.com/photo-x'),
            ).rejects.toMatchObject({ code: 'TOO_LARGE' })
        })
    })

    describe('trackDownload', () => {
        it('never throws even if fetch rejects', () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
            expect(() => trackDownload('https://api.unsplash.com/photos/x/download')).not.toThrow()
        })

        it('never throws when env key missing', () => {
            delete process.env.UNSPLASH_ACCESS_KEY
            expect(() => trackDownload('https://api.unsplash.com/photos/x/download')).not.toThrow()
        })

        it('does nothing for empty URL', () => {
            global.fetch = vi.fn()
            trackDownload('')
            expect(global.fetch).not.toHaveBeenCalled()
        })
    })
})
