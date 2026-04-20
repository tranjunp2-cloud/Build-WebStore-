import { describe, it, expect } from 'vitest'
import {
    buildSlugCanonicalMap,
    rewriteLiveUrl,
    splitPathAndTail,
} from '@/lib/navigation-url'

// Pages list used by most tests — mirrors a premium AI-generated site.
const samplePages = [
    { id: 1, slug: '/', isHomepage: true },
    { id: 2, slug: '/about' },
    { id: 3, slug: '/services' },
    { id: 4, slug: '/contact' },
    { id: 5, slug: '/blog' },
    { id: 6, slug: '/case-studies' },
]

describe('[TC-F05-nav-resolver] buildSlugCanonicalMap', () => {
    it('TC-F05-nav-resolver-01: indexes exact + lowercased + bare forms per page', () => {
        const map = buildSlugCanonicalMap(samplePages)
        // exact
        expect(map.get('/services')).toBe('/services')
        // lowercased form of same slug is identity — just a sanity check
        expect(map.get('/services')).toBe('/services')
        // bare (no leading slash) form
        expect(map.get('services')).toBe('/services')
        // homepage
        expect(map.get('/')).toBe('/')
    })

    it('TC-F05-nav-resolver-02: lowercase entry resolves AI-seeded label-cased URLs to canonical slug', () => {
        const map = buildSlugCanonicalMap(samplePages)
        // The bug symptom — AI gen produced `/Services`; needs to resolve to stored `/services`.
        expect(map.get('/Services'.toLowerCase())).toBe('/services')
        expect(map.get('/Case-Studies'.toLowerCase())).toBe('/case-studies')
    })

    it('TC-F05-nav-resolver-03: gracefully handles null / undefined / empty pages', () => {
        expect(buildSlugCanonicalMap(null).size).toBe(0)
        expect(buildSlugCanonicalMap(undefined).size).toBe(0)
        expect(buildSlugCanonicalMap([]).size).toBe(0)
    })

    it('TC-F05-nav-resolver-04: skips pages with empty/whitespace slugs', () => {
        const map = buildSlugCanonicalMap([
            { id: 1, slug: '' },
            { id: 2, slug: '  ' },
            { id: 3, slug: null },
            { id: 4, slug: '/ok' },
        ])
        // Only `/ok` + its lowercased + bare forms should be present.
        expect(map.get('/ok')).toBe('/ok')
        expect(map.get('ok')).toBe('/ok')
        expect(map.size).toBe(3)
    })
})

describe('[TC-F05-nav-resolver] splitPathAndTail', () => {
    it('TC-F05-nav-resolver-05: splits at first ? or # whichever comes first', () => {
        expect(splitPathAndTail('/services')).toEqual(['/services', ''])
        expect(splitPathAndTail('/services?tab=a')).toEqual(['/services', '?tab=a'])
        expect(splitPathAndTail('/services#section')).toEqual(['/services', '#section'])
        expect(splitPathAndTail('/services?tab=a#section')).toEqual(['/services', '?tab=a#section'])
        expect(splitPathAndTail('/services#section?tab=a')).toEqual(['/services', '#section?tab=a'])
    })
})

describe('[TC-F05-nav-resolver] rewriteLiveUrl', () => {
    const map = buildSlugCanonicalMap(samplePages)

    it('TC-F05-nav-resolver-06: rewrites case-mismatched internal paths to canonical slug', () => {
        // The exact bug the user screenshotted.
        expect(rewriteLiveUrl('/Services', map)).toBe('/services')
        expect(rewriteLiveUrl('/ABOUT', map)).toBe('/about')
        expect(rewriteLiveUrl('/Case-Studies', map)).toBe('/case-studies')
    })

    it('TC-F05-nav-resolver-07: preserves query + hash unchanged', () => {
        expect(rewriteLiveUrl('/Services?tab=Pricing', map)).toBe('/services?tab=Pricing')
        expect(rewriteLiveUrl('/About#Team', map)).toBe('/about#Team')
        expect(rewriteLiveUrl('/Blog?page=2#Posts', map)).toBe('/blog?page=2#Posts')
    })

    it('TC-F05-nav-resolver-08: bare slugs (no leading slash on AI output) also resolve', () => {
        // Some gen paths produced `services` without the leading slash.
        // buildSlugCanonicalMap indexes this form too.
        expect(map.get('services')).toBe('/services')
    })

    it('TC-F05-nav-resolver-09: passes through external URLs, mailto, tel, #-anchors unchanged', () => {
        expect(rewriteLiveUrl('https://Google.com/Path', map)).toBe('https://Google.com/Path')
        expect(rewriteLiveUrl('http://example.com', map)).toBe('http://example.com')
        expect(rewriteLiveUrl('mailto:HELLO@x.com', map)).toBe('mailto:HELLO@x.com')
        expect(rewriteLiveUrl('tel:+60-12-345', map)).toBe('tel:+60-12-345')
        expect(rewriteLiveUrl('#section', map)).toBe('#section')
    })

    it('TC-F05-nav-resolver-10: leaves unmatched internal paths untouched so forward-declared pages are respected', () => {
        // `/coming-soon` is not in samplePages — user may have plans. Don't guess.
        expect(rewriteLiveUrl('/coming-soon', map)).toBe('/coming-soon')
        expect(rewriteLiveUrl('/Nonexistent-Page', map)).toBe('/Nonexistent-Page')
    })

    it('TC-F05-nav-resolver-11: homepage always resolves to /', () => {
        expect(rewriteLiveUrl('/', map)).toBe('/')
        // `/#features` — path is `/`, tail is `#features`
        expect(rewriteLiveUrl('/#features', map)).toBe('/#features')
    })

    it('TC-F05-nav-resolver-12: handles empty / null / undefined safely', () => {
        expect(rewriteLiveUrl('', map)).toBe('')
        expect(rewriteLiveUrl(null, map)).toBe('')
        expect(rewriteLiveUrl(undefined, map)).toBe('')
    })

    it('TC-F05-nav-resolver-13: with an empty slug map, every internal URL is returned untouched', () => {
        // Defensive behavior — if pages list hasn't loaded yet, don't mangle URLs.
        const emptyMap = buildSlugCanonicalMap([])
        expect(rewriteLiveUrl('/Services', emptyMap)).toBe('/Services')
        expect(rewriteLiveUrl('/', emptyMap)).toBe('/')
    })
})
