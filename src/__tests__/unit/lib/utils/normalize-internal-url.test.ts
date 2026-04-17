import { describe, it, expect } from 'vitest'
import {
    normalizeInternalUrl,
    normalizeNavLinks,
    normalizeFooterColumns,
} from '@/lib/utils/normalize-internal-url'

describe('[TC-F05-nav-url] normalizeInternalUrl', () => {
    it('TC-F05-nav-url-01: lowercases pathname of a relative URL', () => {
        expect(normalizeInternalUrl('/Services')).toBe('/services')
        expect(normalizeInternalUrl('/About-Us')).toBe('/about-us')
        expect(normalizeInternalUrl('/')).toBe('/')
    })

    it('TC-F05-nav-url-02: preserves query string and hash casing', () => {
        expect(normalizeInternalUrl('/Services?Tab=A')).toBe('/services?Tab=A')
        expect(normalizeInternalUrl('/Products#Featured')).toBe('/products#Featured')
        expect(normalizeInternalUrl('/Docs?Tab=A#Section')).toBe('/docs?Tab=A#Section')
    })

    it('TC-F05-nav-url-03: leaves external / non-path URLs unchanged', () => {
        expect(normalizeInternalUrl('https://Google.com/Path')).toBe('https://Google.com/Path')
        expect(normalizeInternalUrl('mailto:HELLO@EXAMPLE.COM')).toBe('mailto:HELLO@EXAMPLE.COM')
        expect(normalizeInternalUrl('tel:+60-12-345')).toBe('tel:+60-12-345')
        expect(normalizeInternalUrl('#Anchor')).toBe('#Anchor')
    })

    it('TC-F05-nav-url-04: handles empty / null / undefined safely', () => {
        expect(normalizeInternalUrl('')).toBe('')
        expect(normalizeInternalUrl(null)).toBe('')
        expect(normalizeInternalUrl(undefined)).toBe('')
    })

    it('TC-F05-nav-url-05: lowercases multi-segment paths', () => {
        expect(normalizeInternalUrl('/Services/Pricing')).toBe('/services/pricing')
        expect(normalizeInternalUrl('/Blog/Post-Title')).toBe('/blog/post-title')
    })
})

describe('[TC-F05-nav-url] normalizeNavLinks', () => {
    it('TC-F05-nav-url-06: normalizes top-level links', () => {
        const input = [
            { label: 'Services', url: '/Services' },
            { label: 'About', url: '/About' },
        ]
        const out = normalizeNavLinks(input)
        expect(out).toEqual([
            { label: 'Services', url: '/services' },
            { label: 'About', url: '/about' },
        ])
    })

    it('TC-F05-nav-url-07: recursively normalizes children', () => {
        const input = [
            {
                label: 'Services',
                url: '/Services',
                children: [
                    { label: 'Dental', url: '/Services/Dental' },
                    { label: 'Vision', url: '/Services/Vision' },
                ],
            },
        ]
        const out = normalizeNavLinks(input)
        expect(out[0].url).toBe('/services')
        expect(out[0].children).toEqual([
            { label: 'Dental', url: '/services/dental' },
            { label: 'Vision', url: '/services/vision' },
        ])
    })

    it('TC-F05-nav-url-08: handles undefined / empty inputs', () => {
        expect(normalizeNavLinks(undefined)).toEqual([])
        expect(normalizeNavLinks(null)).toEqual([])
        expect(normalizeNavLinks([])).toEqual([])
    })

    it('TC-F05-nav-url-09: leaves external URLs untouched inside a mixed list', () => {
        const input = [
            { label: 'Home', url: '/' },
            { label: 'Twitter', url: 'https://twitter.com/Acme' },
            { label: 'Services', url: '/Services' },
        ]
        const out = normalizeNavLinks(input)
        expect(out.map(l => l.url)).toEqual([
            '/',
            'https://twitter.com/Acme',
            '/services',
        ])
    })
})

describe('[TC-F05-nav-url] normalizeFooterColumns', () => {
    it('TC-F05-nav-url-10: normalizes link URLs in every footer column', () => {
        const input = [
            {
                title: 'Company',
                links: [
                    { label: 'About', url: '/About' },
                    { label: 'Careers', url: '/Careers' },
                ],
            },
            {
                title: 'Legal',
                links: [{ label: 'Privacy', url: '/Privacy-Policy' }],
            },
        ]
        const out = normalizeFooterColumns(input)
        expect(out[0].links!.map(l => l.url)).toEqual(['/about', '/careers'])
        expect(out[1].links![0].url).toBe('/privacy-policy')
    })

    it('TC-F05-nav-url-11: preserves column titles + handles empty links', () => {
        const input = [{ title: 'Empty', links: [] }]
        const out = normalizeFooterColumns(input)
        expect(out).toEqual([{ title: 'Empty', links: [] }])
    })
})
