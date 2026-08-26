import { describe, it, expect } from 'vitest'
import {
    patchBlockCtaUrls,
    patchBlockCtaUrlsFromLinks,
    patchLocaleInitCtaUrls,
} from '@/lib/ai/patch-block-cta-urls'
import type { NavPageLike } from '@/lib/navigation-url'

// ── Test data setup ────────────────────────────────────────────────────
const pagesFull: NavPageLike[] = [
    { id: '1', slug: '/', isHomepage: true },
    { id: '2', slug: '/about' },
    { id: '3', slug: '/contact' },
]

const pagesNoContact: NavPageLike[] = [
    { id: '1', slug: '/', isHomepage: true },
    { id: '2', slug: '/about' },
]

const pagesEmpty: NavPageLike[] = []

const pagesMS: NavPageLike[] = [
    { id: '1', slug: '/', isHomepage: true },
    { id: '2', slug: '/contact' },
]

// ── TC-F01.CTA-DRAG-01: Hero with both CTAs resolve correctly ─────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Navigation CTAs (hero)', () => {
    it('TC-F01.CTA-DRAG-01: hero with both #contact and #about CTAs → resolve to /contact and /about', () => {
        const block = {
            blockType: 'hero',
            title: 'Welcome',
            ctaButtons: [
                { label: 'Get Started', url: '#contact' },
                { label: 'Learn More', url: '#about' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons).toHaveLength(2)
        expect(result.ctaButtons[0].url).toBe('/contact')
        expect(result.ctaButtons[0].label).toBe('Get Started')
        expect(result.ctaButtons[1].url).toBe('/about')
        expect(result.ctaButtons[1].label).toBe('Learn More')
    })

    // ── TC-F01.CTA-DRAG-02: Per-button hide when page missing ─────────
    it('TC-F01.CTA-DRAG-02: hero on site missing /contact → drop contact button, keep about', () => {
        const block = {
            blockType: 'hero',
            title: 'Welcome',
            ctaButtons: [
                { label: 'Get Started', url: '#contact' },
                { label: 'Learn More', url: '#about' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesNoContact)

        expect(result.ctaButtons).toHaveLength(1)
        expect(result.ctaButtons[0].label).toBe('Learn More')
        expect(result.ctaButtons[0].url).toBe('/about')
    })

    // ── TC-F01.CTA-DRAG-04: MS-style pages (canonical slugs) ─────────
    it('TC-F01.CTA-DRAG-04: MS-style pages with canonical slug → CTA resolves correctly', () => {
        const block = {
            blockType: 'hero',
            title: 'Welcome',
            ctaButtons: [
                { label: 'Contact Us', url: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesMS)

        expect(result.ctaButtons).toHaveLength(1)
        expect(result.ctaButtons[0].url).toBe('/contact')
    })

    // ── TC-F01.CTA-DRAG-06: Empty pages → nav CTAs hidden ───────────
    it('TC-F01.CTA-DRAG-06: hero with pages=[] → ctaButtons hidden (length 0)', () => {
        const block = {
            blockType: 'hero',
            title: 'Welcome',
            ctaButtons: [
                { label: 'Get Started', url: '#contact' },
                { label: 'Learn More', url: '#about' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesEmpty)

        expect(result.ctaButtons).toHaveLength(0)
    })

    // ── Edge: All buttons drop if no pages match ─────────────────────
    it('TC-F01.CTA-DRAG-02 variant: all nav CTAs hidden when no pages match any slug', () => {
        const block = {
            blockType: 'hero',
            title: 'Welcome',
            ctaButtons: [
                { label: 'Services', url: '#services' },
                { label: 'Gallery', url: '#gallery' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons).toHaveLength(0)
    })
})

// ── TC-F01.CTA-DRAG-03: Pricing blocks with action CTAs ─────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Action CTAs (pricing)', () => {
    it('TC-F01.CTA-DRAG-03: pricing with #placeholder → defaults to /contact (not homepage), keep plans count', () => {
        const block = {
            blockType: 'pricing',
            title: 'Plans',
            plans: [
                { name: 'Starter', ctaUrl: '#' },
                { name: 'Pro', ctaUrl: '#' },
                { name: 'Enterprise', ctaUrl: '#' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.plans).toHaveLength(3)
        // Bare `#` is an unset action CTA → defaults to /contact, never the homepage.
        expect(result.plans[0].ctaUrl).toBe('/contact')
        expect(result.plans[1].ctaUrl).toBe('/contact')
        expect(result.plans[2].ctaUrl).toBe('/contact')
    })

    // ── TC-F01.CTA-DRAG-06: Pricing with empty pages → fallback /contact ─
    it('TC-F01.CTA-DRAG-06: pricing with pages=[] → ctaUrl falls back to homepage', () => {
        const block = {
            blockType: 'pricing',
            title: 'Plans',
            plans: [
                { name: 'Starter', ctaUrl: '#' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesEmpty)

        expect(result.plans).toHaveLength(1)
        expect(result.plans[0].ctaUrl).toBe('/')
    })

    it('pricing with resolved CTA URL → preserve resolved URL (no fallback)', () => {
        const block = {
            blockType: 'pricing',
            title: 'Plans',
            plans: [
                { name: 'Starter', ctaUrl: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.plans[0].ctaUrl).toBe('/contact')
    })

    it('TC-F01.CTA-DRAG-08: pricing internal ctaUrl → ctaActionType synced to internal', () => {
        const block = {
            blockType: 'pricing',
            title: 'Plans',
            plans: [
                { name: 'Starter', ctaUrl: '#', ctaActionType: 'external' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        // /contact is internal → editor action type must follow, so the UI shows
        // the page picker instead of the external URL input.
        expect(result.plans[0].ctaUrl).toBe('/contact')
        expect(result.plans[0].ctaActionType).toBe('internal')
    })

    it('pricing with unresolvable CTA (#services when no /services page) → fallback /contact', () => {
        const block = {
            blockType: 'pricing',
            title: 'Plans',
            plans: [
                { name: 'Starter', ctaUrl: '#services' },
            ],
        }

        // pagesFull has no /services page
        const result = patchBlockCtaUrls(block, pagesFull)

        // resolveCtaSlugFromLinks returns '' (no match), so fallback to /contact
        expect(result.plans[0].ctaUrl).toBe('/contact')
    })
})

// ── GH-1412: CTA block action CTAs (ctaUrl / secondaryCtaUrl) ────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — CTA block (GH-1412)', () => {
    it('cta with #contact → resolves ctaUrl to /contact', () => {
        const block = {
            blockType: 'cta',
            headline: 'Ready?',
            ctaLabel: 'Get Started',
            ctaUrl: '#contact',
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.blockType).toBe('cta')
        expect(result.ctaUrl).toBe('/contact')
    })

    it('cta primary CTA never lost — unresolvable URL falls back to /contact', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Go',
            ctaUrl: '#services', // no /services page
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaUrl).toBe('/contact')
    })

    it('cta with pages=[] → ctaUrl falls back to homepage', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Go',
            ctaUrl: '#contact',
        }

        const result = patchBlockCtaUrls(block, pagesEmpty)

        expect(result.ctaUrl).toBe('/')
    })

    it('cta external ctaUrl → passthrough unchanged', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Visit',
            ctaUrl: 'https://example.com',
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaUrl).toBe('https://example.com')
    })

    it('cta secondary CTA resolves when page exists', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Primary',
            ctaUrl: '#contact',
            secondaryCtaLabel: 'Learn',
            secondaryCtaUrl: '#about',
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaUrl).toBe('/contact')
        expect(result.secondaryCtaUrl).toBe('/about')
        expect(result.secondaryCtaLabel).toBe('Learn')
    })

    it('cta primary falls back to an existing page while secondary still resolves (site missing /contact)', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Primary',
            ctaUrl: '#contact', // no /contact page in pagesNoContact → fallback
            secondaryCtaLabel: 'Learn',
            secondaryCtaUrl: '#about', // /about exists → resolves
        }

        const result = patchBlockCtaUrls(block, pagesNoContact)

        expect(result.ctaUrl).toBe('/about')
        expect(result.secondaryCtaUrl).toBe('/about')
        expect(result.secondaryCtaLabel).toBe('Learn')
    })

    it('TC-F01.CTA-AIGEN-02: generated Bakery CTA removes ghost /order and /menu links', () => {
        const block = {
            blockType: 'cta',
            headline: 'Fresh from the oven',
            ctaLabel: 'Order Now',
            ctaUrl: '/order',
            secondaryCtaLabel: 'View Menu',
            secondaryCtaUrl: '/menu',
        }

        const result = patchBlockCtaUrlsFromLinks(block, [
            { url: '/' },
            { url: '/about' },
            { url: '/contact' },
            { url: '/blog' },
        ])

        expect(result.ctaUrl).toBe('/contact')
        expect(result.secondaryCtaUrl).toBeUndefined()
        expect((result as Record<string, unknown>).secondaryCtaLabel).toBeUndefined()
    })

    it('keeps legacy nested CTA payload resolution compatible with AI generation', () => {
        const result = patchBlockCtaUrlsFromLinks({
            blockType: 'cta',
            headline: 'Visit us',
            ctaButton: { label: 'Contact', url: '#contact' },
        }, [
            { url: '/' },
            { url: '/contact' },
        ])

        expect(result.ctaButton).toEqual({ label: 'Contact', url: '/contact' })
    })

    it('cta secondary CTA dropped when no matching page', () => {
        const block = {
            blockType: 'cta',
            ctaLabel: 'Primary',
            ctaUrl: '#contact',
            secondaryCtaLabel: 'Gallery',
            secondaryCtaUrl: '#gallery', // no /gallery page anywhere
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaUrl).toBe('/contact')
        expect(result.secondaryCtaUrl).toBeUndefined()
        expect((result as Record<string, unknown>).secondaryCtaLabel).toBeUndefined()
    })
})

// ── TC-F01.CTA-DRAG-05: Non-CTA blocks pass through unchanged ────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Non-CTA blocks', () => {
    it('TC-F01.CTA-DRAG-05: block without ctaButtons or plans → return unchanged', () => {
        const block = {
            blockType: 'newsletter',
            buttonLabel: 'Subscribe',
            placeholder: 'Enter your email',
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result).toEqual(block)
    })

    it('block with unrelated fields → unchanged', () => {
        const block = {
            blockType: 'testimonial',
            heading: 'Client Reviews',
            testimonials: [
                { quote: 'Great service', author: 'John' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result).toEqual(block)
    })
})

// ── TC-F01.CTA-DRAG: Locale variant content (en/ms slots) ───────────
describe('[TC-F01.CTA-DRAG] patchLocaleInitCtaUrls — en/ms locale slots', () => {
    it('patchLocaleInitCtaUrls: hero content in en/ms slots → both locales resolve CTAs', () => {
        const localeInit = {
            en: {
                ctaButtons: [
                    { label: 'Get Started', url: '#contact' },
                    { label: 'Learn More', url: '#about' },
                ],
            },
            ms: {
                ctaButtons: [
                    { label: 'Mulai', url: '#contact' },
                    { label: 'Ketahui Lebih', url: '#about' },
                ],
            },
        }

        const result = patchLocaleInitCtaUrls(localeInit, pagesFull)

        // EN: both CTAs resolve
        expect(result.en.ctaButtons).toHaveLength(2)
        expect(result.en.ctaButtons[0].url).toBe('/contact')
        expect(result.en.ctaButtons[1].url).toBe('/about')

        // MS: both CTAs resolve
        expect(result.ms.ctaButtons).toHaveLength(2)
        expect(result.ms.ctaButtons[0].url).toBe('/contact')
        expect(result.ms.ctaButtons[1].url).toBe('/about')
    })

    it('patchLocaleInitCtaUrls: missing /contact page → both locales drop contact button', () => {
        const localeInit = {
            en: {
                ctaButtons: [
                    { label: 'Get Started', url: '#contact' },
                    { label: 'Learn More', url: '#about' },
                ],
            },
            ms: {
                ctaButtons: [
                    { label: 'Mulai', url: '#contact' },
                    { label: 'Ketahui Lebih', url: '#about' },
                ],
            },
        }

        const result = patchLocaleInitCtaUrls(localeInit, pagesNoContact)

        // EN: only about button
        expect(result.en.ctaButtons).toHaveLength(1)
        expect(result.en.ctaButtons[0].label).toBe('Learn More')
        expect(result.en.ctaButtons[0].url).toBe('/about')

        // MS: only about button
        expect(result.ms.ctaButtons).toHaveLength(1)
        expect(result.ms.ctaButtons[0].label).toBe('Ketahui Lebih')
        expect(result.ms.ctaButtons[0].url).toBe('/about')
    })

    it('patchLocaleInitCtaUrls: pricing in locale slots → fallback points to homepage', () => {
        const localeInit = {
            en: {
                plans: [
                    { name: 'Starter', ctaUrl: '#' },
                ],
            },
            ms: {
                plans: [
                    { name: 'Permulaan', ctaUrl: '#' },
                ],
            },
        }

        const result = patchLocaleInitCtaUrls(localeInit, pagesEmpty)

        expect(result.en.plans[0].ctaUrl).toBe('/')
        expect(result.ms.plans[0].ctaUrl).toBe('/')
    })

    it('patchLocaleInitCtaUrls: non-CTA content → unchanged', () => {
        const localeInit = {
            en: {
                heading: 'Newsletter',
                placeholder: 'Enter email',
            },
            ms: {
                heading: 'Surat Berita',
                placeholder: 'Masukkan e-mel',
            },
        }

        const result = patchLocaleInitCtaUrls(localeInit, pagesFull)

        expect(result.en).toEqual(localeInit.en)
        expect(result.ms).toEqual(localeInit.ms)
    })
})

// ── Null/undefined pages handling ──────────────────────────────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Robustness', () => {
    it('pages=null → CTAs hidden (empty resolution)', () => {
        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Contact', url: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, null)

        expect(result.ctaButtons).toHaveLength(0)
    })

    it('pages=undefined → CTAs hidden', () => {
        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Contact', url: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, undefined)

        expect(result.ctaButtons).toHaveLength(0)
    })

    it('pages with null slug → skipped', () => {
        const pages: NavPageLike[] = [
            { id: '1', slug: '/', isHomepage: true },
            { id: '2', slug: null },
        ]

        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'About', url: '#about' },
            ],
        }

        const result = patchBlockCtaUrls(block, pages)

        // Only homepage in pages, #about doesn't match
        expect(result.ctaButtons).toHaveLength(0)
    })

    it('pages with slug without leading slash → normalized', () => {
        const pages: NavPageLike[] = [
            { id: '1', slug: '/', isHomepage: true },
            { id: '2', slug: 'contact' }, // No leading slash
        ]

        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Contact', url: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, pages)

        expect(result.ctaButtons).toHaveLength(1)
        expect(result.ctaButtons[0].url).toBe('/contact')
    })
})

// ── Field detection (blockType vs field-based) ────────────────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Field detection', () => {
    it('block with ctaButtons field (no blockType) → process as hero content', () => {
        const block = {
            title: 'Some Title',
            ctaButtons: [
                { label: 'Contact', url: '#contact' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons).toHaveLength(1)
        expect(result.ctaButtons[0].url).toBe('/contact')
    })

    it('block with plans field (no blockType) → process as pricing content', () => {
        const block = {
            description: 'Choose your plan',
            plans: [
                { name: 'Basic', ctaUrl: '#' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        // Bare `#` is an unset action CTA → defaults to /contact, never the homepage.
        expect(result.plans[0].ctaUrl).toBe('/contact')
    })
})

// ── Integration: CTA with fuzzy keyword match ──────────────────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Fuzzy keyword resolution', () => {
    it('hero #contact-us → resolves to /contact via keyword match (≥3 chars)', () => {
        const pages: NavPageLike[] = [
            { id: '1', slug: '/', isHomepage: true },
            { id: '2', slug: '/contact' },
        ]

        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Contact Us', url: '#contact-us' },
            ],
        }

        const result = patchBlockCtaUrls(block, pages)

        expect(result.ctaButtons).toHaveLength(1)
        expect(result.ctaButtons[0].url).toBe('/contact')
    })

    it('pricing #book → resolves to /booking via fuzzy match', () => {
        const pages: NavPageLike[] = [
            { id: '1', slug: '/', isHomepage: true },
            { id: '2', slug: '/booking' },
        ]

        const block = {
            blockType: 'pricing',
            plans: [
                { name: 'Plan', ctaUrl: '#book' },
            ],
        }

        const result = patchBlockCtaUrls(block, pages)

        expect(result.plans[0].ctaUrl).toBe('/booking')
    })
})

// ── External URL passthrough ───────────────────────────────────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — External URL handling', () => {
    it('hero CTA with https URL → passthrough unchanged', () => {
        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Visit', url: 'https://example.com' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons[0].url).toBe('https://example.com')
    })

    it('hero CTA with mailto → passthrough unchanged', () => {
        const block = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Email', url: 'mailto:hi@example.com' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons[0].url).toBe('mailto:hi@example.com')
    })

    it('pricing CTA with tel → passthrough unchanged', () => {
        const block = {
            blockType: 'pricing',
            plans: [
                { name: 'Plan', ctaUrl: 'tel:+1234567890' },
            ],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.plans[0].ctaUrl).toBe('tel:+1234567890')
    })
})

// ── Empty array handling ──────────────────────────────────────────────
describe('[TC-F01.CTA-DRAG] patchBlockCtaUrls — Empty collections', () => {
    it('hero with ctaButtons: [] → stays empty', () => {
        const block = {
            blockType: 'hero',
            ctaButtons: [],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.ctaButtons).toHaveLength(0)
    })

    it('pricing with plans: [] → stays empty', () => {
        const block = {
            blockType: 'pricing',
            plans: [],
        }

        const result = patchBlockCtaUrls(block, pagesFull)

        expect(result.plans).toHaveLength(0)
    })
})
