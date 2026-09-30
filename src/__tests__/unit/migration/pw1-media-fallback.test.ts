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
    it('enforces the new limit for streamed responses without content-length', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.alloc(31 * 1024 * 1024), {headers:{'content-type':'image/png'}})))
        await expect(downloadSourceImage('https://source.example/too-large.png')).rejects.toThrow('30 MiB')
    })
})
