// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { downloadSourceImage } from '@/lib/migration/pw1-media'
import { PW1_PLACEHOLDER_URL } from '@/lib/migration/pw1-placeholder'

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
        const bytes = Buffer.alloc(11 * 1024 * 1024)
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
    it('enforces the new limit for streamed responses without content-length', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.alloc(31 * 1024 * 1024), {headers:{'content-type':'image/png'}})))
        await expect(downloadSourceImage('https://source.example/too-large.png')).rejects.toThrow('30 MiB')
    })
})
