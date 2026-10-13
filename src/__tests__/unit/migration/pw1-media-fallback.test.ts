// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { downloadSourceImage } from '@/lib/migration/pw1-media'
import { PW1_PLACEHOLDER_URL } from '@/lib/migration/pw1-placeholder'
import { fetchImageViaBrowser } from '@/lib/migration/pw1-media-browser'

vi.mock('@/lib/migration/pw1-media-browser', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/migration/pw1-media-browser')>(), fetchImageViaBrowser: vi.fn().mockResolvedValue(null) }))

afterEach(() => vi.unstubAllGlobals())
describe('[TC-F35.M12] Missing/forbidden images and download size', () => {
    it('creates a valid local placeholder without fetching a missing category image', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const asset = await downloadSourceImage(PW1_PLACEHOLDER_URL)
        expect((await sharp(asset.buffer).metadata()).format).toBe('png')
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it('replaces a 403 response with a valid placeholder', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', {status:403})))
        const asset = await downloadSourceImage('https://source.example/blocked.png')
        expect((await sharp(asset.buffer).metadata()).width).toBe(960)
    })
    it('still rejects a server error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Failure', {status:500})))
        await expect(downloadSourceImage('https://source.example/error.png')).rejects.toThrow('HTTP 500')
    })
    it('accepts downloads over the old 10 MiB limit', async () => {
        const bytes = Buffer.alloc(11 * 1024 * 1024); bytes.set([0x89, 0x50, 0x4E, 0x47])
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, {headers:{'content-type':'image/png'}})))
        expect((await downloadSourceImage('https://source.example/large.png')).buffer.length).toBe(bytes.length)
    })
    it('re-encodes GIF source images to PNG so Media signature validation accepts them', async () => {
        // Arrange: a real GIF served with a GIF content-type
        const gif = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#ff0000' } }).gif().toBuffer()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(gif, {headers:{'content-type':'image/gif'}})))
        // Act
        const asset = await downloadSourceImage('https://source.example/logo.gif')
        // Assert: PNG bytes, same dimensions
        expect(asset.mimetype).toBe('image/png')
        expect(await sharp(asset.buffer).metadata()).toMatchObject({ format: 'png', width: 4, height: 3 })
    })
    it('trusts JPEG bytes served with the non-standard image/jpg content-type', async () => {
        // Arrange
        const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#00ff00' } }).jpeg().toBuffer()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(jpeg, {headers:{'content-type':'image/jpg'}})))
        // Act
        const asset = await downloadSourceImage('https://source.example/photo.jpg')
        // Assert
        expect(asset).toEqual({ buffer: jpeg, mimetype: 'image/jpeg' })
    })
    it('uses the placeholder when a banner image slot points at a video', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('0000001c66747970', 'hex'), {headers:{'content-type':'video/mp4'}})))
        const asset = await downloadSourceImage('https://source.example/banner.mp4')
        expect(await sharp(asset.buffer).metadata()).toMatchObject({ format: 'png', width: 960 })
    })
    it('uses the placeholder when mislabelled image bytes cannot be decoded', async () => {
        // Arrange: AVIF container header served as PNG, truncated so no decoder can read it
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('000000186674797061766966', 'hex'), {headers:{'content-type':'image/png'}})))
        // Act
        const asset = await downloadSourceImage('https://source.example/broken.png')
        // Assert
        expect(asset.mimetype).toBe('image/png')
        expect((await sharp(asset.buffer).metadata()).width).toBe(960)
    })
    it('still rejects a non-image response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', {headers:{'content-type':'text/html'}})))
        await expect(downloadSourceImage('https://source.example/page.png')).rejects.toThrow('not a supported raster image')
    })
    it('enforces the new limit for streamed responses without content-length', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.alloc(31 * 1024 * 1024), {headers:{'content-type':'image/png'}})))
        await expect(downloadSourceImage('https://source.example/too-large.png')).rejects.toThrow('30 MiB')
    })
    it('[TC-F35.M30] loads a bot-protected image through the browser fallback instead of the placeholder', async () => {
        const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#336699' } }).png().toBuffer()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('challenge', { status: 403 })))
        vi.mocked(fetchImageViaBrowser).mockResolvedValueOnce({ buffer: png, mimetype: 'image/png' })
        const asset = await downloadSourceImage('https://blocked.example/a.png')
        expect((await sharp(asset.buffer).metadata()).width).toBe(4)
    })
    it('[TC-F35.M30] follows redirects and validates each hop', async () => {
        const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#336699' } }).png().toBuffer()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/moved/a.png' } }))
            .mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }))
        vi.stubGlobal('fetch', fetchMock)
        expect((await sharp((await downloadSourceImage('https://cdn.example/a.png')).buffer).metadata()).width).toBe(4)
        expect(String(fetchMock.mock.calls[1][0])).toBe('https://cdn.example/moved/a.png')
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://insecure.example/a.png' } })))
        await expect(downloadSourceImage('https://cdn.example/b.png')).rejects.toThrow('HTTPS')
    })
    it('[TC-F35.M30] accepts image bytes labelled with a generic content-type but not other bytes', async () => {
        const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#336699' } }).png().toBuffer()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(png, { headers: { 'content-type': 'image' } })))
        expect((await downloadSourceImage('https://s3.example/a.jpg')).mimetype).toBe('image/png')
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('hello', { headers: { 'content-type': 'application/octet-stream' } })))
        await expect(downloadSourceImage('https://s3.example/b.jpg')).rejects.toThrow('not a supported raster image')
    })
})
