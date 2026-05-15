import { describe, it, expect } from 'vitest'
import {
    buildSlugCanonicalMap,
    resolveInternalUrlPath,
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
        // `/ok` + bare `ok` → 2 entries.
        // Homepage aliases always added when pages.length > 0:
        // `/`, `/home`, `home`, `/index`, `index` → 5 entries.
        expect(map.get('/ok')).toBe('/ok')
        expect(map.get('ok')).toBe('/ok')
        expect(map.size).toBe(7)
    })

    it('TC-F05-nav-resolver-14: aliases /home, /index, home, index to canonical homepage /', () => {
        // AI-seeded nav often hardcodes /Home as the first link label.
        // Homepage's stored slug is `/`, so without aliasing /home would
        // 404. These aliases let the resolver collapse them to canonical /.
        const map = buildSlugCanonicalMap(samplePages)
        expect(map.get('/home')).toBe('/')
        expect(map.get('home')).toBe('/')
        expect(map.get('/index')).toBe('/')
        expect(map.get('index')).toBe('/')
    })

    it('TC-F05-nav-resolver-15: an explicit /home page wins over the homepage alias', () => {
        // If a site actually owns a slug `/home`, that page's canonical
        // entry is written first (first-write-wins) so the alias block
        // does not clobber it.
        const map = buildSlugCanonicalMap([
            { id: 1, slug: '/', isHomepage: true },
            { id: 2, slug: '/home' },
        ])
        expect(map.get('/home')).toBe('/home')
        expect(map.get('home')).toBe('/home')
        // Root homepage is still addressable.
        expect(map.get('/')).toBe('/')
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

    it('TC-F05-nav-resolver-10: unmatched internal paths fall back to lowercase so URL bar stays clean', () => {
        // `/coming-soon` is not in samplePages but already lowercase — unchanged.
        expect(rewriteLiveUrl('/coming-soon', map)).toBe('/coming-soon')
        // Label-cased path for a page that no longer exists (user-reported
        // `/Contact` after deletion) or forward-declared — lowercase the path
        // so the URL bar never shows mixed-case.
        expect(rewriteLiveUrl('/Nonexistent-Page', map)).toBe('/nonexistent-page')
        expect(rewriteLiveUrl('/Coming-Soon?ref=A', map)).toBe('/coming-soon?ref=A')
    })

    it('TC-F05-nav-resolver-11: homepage always resolves to /', () => {
        expect(rewriteLiveUrl('/', map)).toBe('/')
        // `/#features` — path is `/`, tail is `#features`
        expect(rewriteLiveUrl('/#features', map)).toBe('/#features')
    })

    it('TC-F05-nav-resolver-16: /Home, /Index (any casing) resolve to canonical /', () => {
        // User-reported symptom: AI-seeded nav label "Home" emits `/Home`;
        // homepage's stored slug is `/`, so without aliasing the live URL
        // lands on `/Home` (404). Aliases collapse it to `/`.
        expect(rewriteLiveUrl('/Home', map)).toBe('/')
        expect(rewriteLiveUrl('/HOME', map)).toBe('/')
        expect(rewriteLiveUrl('/home', map)).toBe('/')
        expect(rewriteLiveUrl('/Index', map)).toBe('/')
        expect(rewriteLiveUrl('/Home#team', map)).toBe('/#team')
    })

    it('TC-F05-nav-resolver-17: link to a deleted page is lowercased so URL bar stays clean', () => {
        // User deleted `/contact`, so it is not in the pages list; nav still
        // has an AI-seeded `/Contact` link that would otherwise stay
        // mixed-case in the URL bar. Lowercase fallback normalizes it.
        const mapWithoutContact = buildSlugCanonicalMap([
            { id: 1, slug: '/', isHomepage: true },
            { id: 2, slug: '/about' },
            { id: 3, slug: '/services' },
        ])
        expect(rewriteLiveUrl('/Contact', mapWithoutContact)).toBe('/contact')
        expect(rewriteLiveUrl('/Contact?utm=x', mapWithoutContact)).toBe('/contact?utm=x')
    })

    it('TC-F05-nav-resolver-12: handles empty / null / undefined safely', () => {
        expect(rewriteLiveUrl('', map)).toBe('')
        expect(rewriteLiveUrl(null, map)).toBe('')
        expect(rewriteLiveUrl(undefined, map)).toBe('')
    })

    it('TC-F05-nav-resolver-13: with an empty slug map, internal URLs are lowercased (no hits possible)', () => {
        // Defensive behavior — if pages list hasn't loaded yet, we still
        // lowercase the path so the URL bar never leaks label casing.
        // External URLs / anchors still pass through untouched.
        const emptyMap = buildSlugCanonicalMap([])
        expect(rewriteLiveUrl('/Services', emptyMap)).toBe('/services')
        expect(rewriteLiveUrl('/', emptyMap)).toBe('/')
        expect(rewriteLiveUrl('https://Google.com', emptyMap)).toBe('https://Google.com')
    })
})

describe('[TC-F05-nav-resolver] resolveInternalUrlPath', () => {
    const map = buildSlugCanonicalMap(samplePages)

    it('TC-F05-nav-resolver-18: canonicalizes internal URLs for hidden-page comparisons', () => {
        expect(resolveInternalUrlPath('/Services', map)).toBe('/services')
        expect(resolveInternalUrlPath('/Services?utm=x', map)).toBe('/services')
        expect(resolveInternalUrlPath('/Services#pricing', map)).toBe('/services')
        expect(resolveInternalUrlPath('/Services/?utm=x#top', map)).toBe('/services')
        expect(resolveInternalUrlPath('services', map)).toBe('/services')
    })

    it('TC-F05-nav-resolver-19: preserves homepage aliases and ignores non-internal URLs', () => {
        expect(resolveInternalUrlPath('/Home', map)).toBe('/')
        expect(resolveInternalUrlPath('/Index#top', map)).toBe('/')
        expect(resolveInternalUrlPath('https://example.com/services', map)).toBeNull()
        expect(resolveInternalUrlPath('mailto:hello@example.com', map)).toBeNull()
        expect(resolveInternalUrlPath('#pricing', map)).toBeNull()
    })

    it('TC-F05-nav-resolver-20: unmatched internal URLs still return normalized paths for not-found warnings', () => {
        expect(resolveInternalUrlPath('/Missing-Page?x=1', map)).toBe('/missing-page')
    })
})
