import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { externalImageUrls, repairRichTextImages } from '@/lib/migration/pw1-richtext-image-repair'
import { uploadImageBuffer } from '@/lib/ai/upload-media'

vi.mock('@/lib/ai/upload-media', () => ({ uploadImageBuffer: vi.fn().mockResolvedValue(88) }))

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64')
const HOSTED = 'https://destination.example/media/pw1-830-0123456789abcdef0123.jpg'
const makePayload = () => ({
    db: { drizzle: { execute: vi.fn().mockResolvedValue({ rows: [] }) } },
    find: vi.fn().mockResolvedValue({ docs: [] }),
    findByID: vi.fn().mockResolvedValue({ url: HOSTED }),
}) as unknown as Payload

// TC-F35.M69: rich-text images left on PW1 are rehosted by the repair script
describe('[TC-F35.M69] externalImageUrls', () => {
    it('lists absolute images still on PW1 with entities decoded, ignoring rehosted and relative ones', () => {
        const html = [
            '<img src="https://cdn.source.example/a.png?e=1&amp;t=sig">',
            '<img src="https://storage.example/media/pw1-830-0123456789abcdef0123.jpg">',
            '<img src="/api/media/file/x.png">',
            '<img src="https://cdn.source.example/a.png?e=1&amp;t=sig">',
            '<p>no image</p>',
        ].join('')
        expect(externalImageUrls(html)).toEqual(['https://cdn.source.example/a.png?e=1&t=sig'])
    })
    it('counts media rehosted under another tenant (cloned template content) as rehosted too', () => {
        expect(externalImageUrls('<img src="http://localhost:9000/media/pw1-126-48ea4e91b6f6198ae01d.jpg">')).toEqual([])
    })
    it('returns nothing for html without images', () => {
        expect(externalImageUrls('<p>hello</p>')).toEqual([])
    })
})

describe('[TC-F35.M69] repairRichTextImages', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.mocked(uploadImageBuffer).mockClear() })

    it('downloads the decoded URL, rehosts it and rewrites the src', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }))
        vi.stubGlobal('fetch', fetchMock)
        const html = '<figure><img src="https://cdn.source.example/a.png?e=1&amp;v=beta" alt="x"></figure>'
        const result = await repairRichTextImages(html, 830, makePayload())
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://cdn.source.example/a.png?e=1&v=beta')
        expect(result).toMatchObject({ changed: true, found: 1, remaining: 0 })
        expect(result.html).toContain(`src="${HOSTED}"`)
        expect(vi.mocked(uploadImageBuffer)).toHaveBeenCalledOnce()
    })

    it('rehosts only the images still on PW1 and never downloads already rehosted ones again', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }))
        vi.stubGlobal('fetch', fetchMock)
        const own = 'https://s.example/media/pw1-830-fedcba9876543210fedc.jpg'
        const result = await repairRichTextImages(`<img src="${own}"><img src="https://cdn.source.example/b.png">`, 830, makePayload())
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://cdn.source.example/b.png')
        expect(result.html).toContain(`src="${own}"`)
        expect(result).toMatchObject({ changed: true, found: 1, remaining: 0 })
    })

    it('does nothing, and downloads nothing, when every image is already rehosted', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const html = '<img src="https://s.example/pw1-830-0123456789abcdef0123.jpg">'
        expect(await repairRichTextImages(html, 830, makePayload())).toEqual({ changed: false, html, found: 0, remaining: 0 })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reports an image that cannot be downloaded as remaining and leaves its html unchanged', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')))
        const html = '<img src="https://dead.example/a.png">'
        expect(await repairRichTextImages(html, 830, makePayload())).toEqual({ changed: false, html, found: 1, remaining: 1 })
    })
})
