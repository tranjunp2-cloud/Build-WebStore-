import { describe, expect, it } from 'vitest'
import { htmlImageUrls, htmlPlaceholders, swapHtmlImageSource, swapImageSource } from '@/lib/migration/pw1-html-placeholder-repair'
import { pw1MediaFilename, pw1PlaceholderFilename } from '@/lib/migration/pw1-placeholder-image-repair'
import { isPw1StorageUrl } from '@/lib/migration/pw1-image-origin'

const THIRD_PARTY = 'https://www.oecd.org/adobe/dynamicmedia/deliver/a.jpg?x=1&y=2'
const OWN = 'https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-primeweb/img/2026/a.png'

// TC-F35.M74: only PW1 storage images are copied into destination media
describe('[TC-F35.M74] isPw1StorageUrl', () => {
    it('recognises DigitalOcean Spaces buckets (prod, dev, other) and nothing else', () => {
        expect(isPw1StorageUrl(OWN)).toBe(true)
        expect(isPw1StorageUrl('https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/x.jpg')).toBe(true)
        expect(isPw1StorageUrl('https://TM-PRIME-WEB.SGP1.CDN.DIGITALOCEANSPACES.COM/x.jpg')).toBe(true)
        expect(isPw1StorageUrl(THIRD_PARTY)).toBe(false)
        expect(isPw1StorageUrl('https://evil.example/digitaloceanspaces.com/x.jpg')).toBe(false)
        expect(isPw1StorageUrl('not a url')).toBe(false)
    })
})

// TC-F35.M75: rich-text images replaced by the placeholder get a real (or original) source back
describe('[TC-F35.M75] htmlImageUrls', () => {
    it('collects absolute <img> sources from every html string of a nested contract, entities decoded', () => {
        const contract = { pages: [{ components: [{ model_settings: [{ value: `<p><img src="${THIRD_PARTY.replace(/&/g, '&amp;')}"><img src="/relative.png"></p>` }, { value: 'plain text' }] }] }], logo: 'https://x.example/logo.png' }
        expect([...htmlImageUrls(contract)]).toEqual([THIRD_PARTY])
    })
})

describe('[TC-F35.M75] htmlPlaceholders', () => {
    it('matches a source image to its placeholder media through the tenant/hash file name, hashing the https form', () => {
        const http = 'http://www.example.org/a.jpg'
        const media = [
            { filename: pw1PlaceholderFilename(830, THIRD_PARTY), url: 'https://s.example/media/pw1-830-aaaaaaaaaaaaaaaaaaaa-placeholder.jpg' },
            { filename: pw1PlaceholderFilename(830, 'https://www.example.org/a.jpg'), url: 'https://s.example/media/pw1-830-bbbbbbbbbbbbbbbbbbbb-placeholder.jpg' },
            { filename: pw1PlaceholderFilename(999, OWN), url: 'https://s.example/other-tenant.jpg' },
        ]
        expect(htmlPlaceholders([THIRD_PARTY, http, OWN], 830, media)).toEqual([
            { url: THIRD_PARTY, placeholderUrl: media[0].url },
            { url: http, placeholderUrl: media[1].url },
        ])
    })
})

describe('[TC-F35.M75] htmlPlaceholders (any stored copy of a third-party image)', () => {
    const copy = (url: string, extra: object = {}) => ({ filename: pw1MediaFilename(3023, url) + '', url: 'https://s.example/media/' + pw1MediaFilename(3023, url), ...extra })
    it('swaps back a third-party image whatever copy the migration stored, even a normal downloaded one', () => {
        const media = [copy(THIRD_PARTY, { width: 800, height: 600, filesize: 120000 })]
        expect(htmlPlaceholders([THIRD_PARTY], 3023, media)).toEqual([{ url: THIRD_PARTY, placeholderUrl: media[0].url }])
    })
    it('leaves a good copy of an image on PW1 storage alone but swaps its neutral placeholder', () => {
        const good = copy(OWN, { width: 800, height: 600, filesize: 120000 })
        const neutral = copy(OWN, { width: 960, height: 640, filesize: 9447 })
        expect(htmlPlaceholders([OWN], 3023, [good])).toEqual([])
        expect(htmlPlaceholders([OWN], 3023, [neutral])).toEqual([{ url: OWN, placeholderUrl: neutral.url }])
    })
})

describe('[TC-F35.M75] swapImageSource', () => {
    it('replaces every occurrence of the placeholder URL and writes the new URL entity-encoded', () => {
        const html = '<img src="https://s.example/p.jpg"><p>keep</p><img src="https://s.example/p.jpg" alt="x">'
        expect(swapImageSource(html, 'https://s.example/p.jpg', THIRD_PARTY)).toBe(`<img src="${THIRD_PARTY.replace(/&/g, '&amp;')}"><p>keep</p><img src="${THIRD_PARTY.replace(/&/g, '&amp;')}" alt="x">`)
    })
})

describe('[TC-F35.M75] swapHtmlImageSource', () => {
    it('backs up each block, rewrites it guarded by its previous html and then its draft versions', async () => {
        const block = { id: 'b1', page_id: 7, html: '<img src="https://s.example/p.jpg"><p>mine</p>' }
        const calls: Array<{ text: string; params?: unknown[] }> = []
        const query = (async (text: string, params?: unknown[]) => { calls.push({ text, params }); return text.startsWith('SELECT') ? { rows: [block], rowCount: 1 } : { rows: [], rowCount: 1 } }) as never
        const saved: unknown[] = []
        const updated = await swapHtmlImageSource(query, 55, 'https://s.example/p.jpg', THIRD_PARTY, async b => { saved.push(b.html) })
        expect(updated).toBe(1)
        expect(saved).toEqual([block.html])
        expect(calls[1].params).toEqual(['b1', swapImageSource(block.html, 'https://s.example/p.jpg', THIRD_PARTY), block.html])
        expect(calls[1].text).toContain('AND html = $3')
        expect(calls[2].params).toEqual([7, 'https://s.example/p.jpg', THIRD_PARTY.replace(/&/g, '&amp;')])
    })
    it('does nothing when no block shows the placeholder', async () => {
        const query = (async () => ({ rows: [], rowCount: 0 })) as never
        expect(await swapHtmlImageSource(query, 55, 'https://s.example/p.jpg', THIRD_PARTY, async () => { throw new Error('no backup expected') })).toBe(0)
    })
})
