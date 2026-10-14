import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { uploadImageBuffer } from '@/lib/ai/upload-media'
import type { Payload } from 'payload'
import { importPw1BlockMedia, validatePw1MediaUrl } from '@/lib/migration/pw1-media'

vi.mock('@/lib/ai/upload-media', () => ({ uploadImageBuffer: vi.fn().mockResolvedValue(77) }))

describe('[TC-F35.M12] Source media URL boundary', () => {
    it.each([
        'tm-prime-web.sgp1.digitaloceanspaces.com',
        'tm-prime-web-dev.sgp1.digitaloceanspaces.com',
        'images.ecommercehub.unifi.com.my',
        'storage.dev.ecommercehub.my',
        'new-source-cdn.example',
    ])('accepts HTTPS source images without a host allowlist: %s', host => {
        const url = `https://${host}/images/source.png`
        expect(validatePw1MediaUrl(url).href).toBe(url)
    })
    it.each([
        'http://source.example/a.jpg',
        'ftp://source.example/a.jpg',
        'https://source.example:8443/a.jpg',
        'https://user:password@source.example/a.jpg',
    ])('rejects invalid transport or credentials: %s', url => {
        expect(() => validatePw1MediaUrl(url)).toThrow('HTTPS without credentials or a custom port')
    })
    it('rejects a malformed URL', () => {
        expect(() => validatePw1MediaUrl('not a URL')).toThrow()
    })
    it('[TC-F35.M22] retains actual uploaded dimensions for JSON slides', async () => {
        const payload = {
            db: { drizzle: { execute: vi.fn().mockResolvedValue({ rows: [{ media_id: 74156 }] }) } },
            findByID: vi.fn().mockResolvedValue({ url: 'https://destination.example/banner.png', alt: 'Banner', width: 1893, height: 560 }),
        } as unknown as Payload
        const block = { slides: [{ image: { url: 'https://source.example/banner.png', width: 800, height: 600 } }] }
        await importPw1BlockMedia([[block]], 830, payload)
        expect(block.slides[0].image).toEqual({ url: 'https://destination.example/banner.png', alt: 'Banner', width: 1893, height: 560 })
    })
    it('[TC-F35.M63] decodes HTML entities in rich-text image URLs before downloading', async () => {
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64')
        const fetchMock = vi.fn().mockResolvedValue(new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }))
        vi.stubGlobal('fetch', fetchMock)
        const payload = {
            db: { drizzle: { execute: vi.fn().mockResolvedValue({ rows: [] }) } },
            find: vi.fn().mockResolvedValue({ docs: [] }),
            findByID: vi.fn().mockResolvedValue({ url: 'https://destination.example/hosted.png' }),
        } as unknown as Payload
        const block = { html: '<figure><img src="https://cdn.source.example/a.png?e=1&amp;v=beta&amp;t=sig" alt="x"></figure>' }
        await importPw1BlockMedia([[block]], 830, payload)
        vi.unstubAllGlobals()
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://cdn.source.example/a.png?e=1&v=beta&t=sig')
        expect(vi.mocked(uploadImageBuffer)).toHaveBeenCalled()
        expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toMatch(/^Mozilla\//)
        expect(block.html).toContain('src="https://destination.example/hosted.png"')
    })
    describe('[TC-F35.M67] placeholder results never stick', () => {
        const realPng = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#336699' } }).png().toBuffer()
        const makePayload = (cachedRow?: Record<string, unknown>) => {
            const execute = vi.fn().mockResolvedValue({ rows: cachedRow ? [cachedRow] : [] })
            const payload = { db: { drizzle: { execute } }, find: vi.fn().mockResolvedValue({ docs: [] }), findByID: vi.fn().mockResolvedValue({ url: 'https://destination.example/new.png' }) } as unknown as Payload
            return { payload, execute }
        }
        beforeEach(() => vi.mocked(uploadImageBuffer).mockClear())
        afterEach(() => vi.unstubAllGlobals())

        it('does not register a placeholder in the URL cache, so the next run retries the download', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('blocked', { status: 403 })))
            const { payload, execute } = makePayload()
            const block = { html: '<img src="https://blocked.example/a.png">' }
            await importPw1BlockMedia([[block]], 830, payload)
            expect(vi.mocked(uploadImageBuffer).mock.calls[0][2]).toMatch(/-placeholder\.jpg$/)
            expect(execute).toHaveBeenCalledTimes(1) // only the cache lookup, no INSERT
        })
        it('retries a cached placeholder and caches the real image under a new filename', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(await realPng(), { headers: { 'content-type': 'image/png' } })))
            const { payload, execute } = makePayload({ media_id: 5, mime_type: 'image/png', width: 960, height: 640 })
            const block = { html: '<img src="https://cdn.example/a.png">' }
            await importPw1BlockMedia([[block]], 830, payload)
            expect(vi.mocked(uploadImageBuffer).mock.calls[0][2]).toMatch(/r\.jpg$/)
            expect(execute).toHaveBeenCalledTimes(2) // lookup + INSERT of the real image
            expect(block.html).toContain('https://destination.example/new.png')
        })
        it('keeps reusing a cached real image without downloading again', async () => {
            const fetchMock = vi.fn()
            vi.stubGlobal('fetch', fetchMock)
            const { payload } = makePayload({ media_id: 9, mime_type: 'image/jpeg', width: 1200, height: 600 })
            await importPw1BlockMedia([[{ html: '<img src="https://cdn.example/a.png">' }]], 830, payload)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(vi.mocked(uploadImageBuffer)).not.toHaveBeenCalled()
        })
    })
})

