import { describe, expect, it } from 'vitest'
import { validatePw1MediaUrl } from '@/lib/migration/pw1-media'

describe('[TC-F35.M12] Source media URL boundary', () => {
    it('accepts the observed PW1 shared template bucket', () => {
        expect(validatePw1MediaUrl('https://tm-prime-web.sgp1.digitaloceanspaces.com/a.jpg').hostname).toBe('tm-prime-web.sgp1.digitaloceanspaces.com')
    })
    it('accepts the exact HTTPS PW1 bucket', () => {
        const url = 'https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/a.jpg'
        const accepted = validatePw1MediaUrl(url)
        expect(accepted.href).toBe(url)
    })
    it.each([
        'http://tm-prime-web-dev.sgp1.digitaloceanspaces.com/a.jpg',
        'https://tm-prime-web-dev.sgp1.digitaloceanspaces.com.evil.example/a.jpg',
        'https://127.0.0.1/a.jpg',
        'https://tm-prime-web-dev.sgp1.digitaloceanspaces.com:8443/a.jpg',
        'https://user:password@tm-prime-web-dev.sgp1.digitaloceanspaces.com/a.jpg',
    ])('rejects unapproved source URL %s', url => {
        const check = () => validatePw1MediaUrl(url)
        expect(check).toThrow('not approved')
    })
})
