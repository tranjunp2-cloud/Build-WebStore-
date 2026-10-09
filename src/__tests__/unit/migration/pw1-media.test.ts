import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { importPw1BlockMedia, validatePw1MediaUrl } from '@/lib/migration/pw1-media'

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
})
