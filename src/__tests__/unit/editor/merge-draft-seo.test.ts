import { describe, expect, it } from 'vitest'
import { mergeDraftSeo, seoChangeNeedsPublish } from '@/lib/editor/merge-draft-seo'

const pages = [
    { id: '5381', seoTitle: 'New page 1', seoDescription: null },
    { id: '5382', seoTitle: 'Other', seoDescription: 'x' },
]

describe('GH-2256 mergeDraftSeo', () => {
    it('TC-F37-12-01: overlays draft SEO onto the current page only', () => {
        const out = mergeDraftSeo(pages, '5381', { title: 'QA-TEST moi', description: 'desc moi' })
        expect(out[0]).toMatchObject({ seoTitle: 'QA-TEST moi', seoDescription: 'desc moi' })
        expect(out[1]).toBe(pages[1])
    })

    it('TC-F37-12-02: no draft SEO or no current page leaves pages untouched', () => {
        expect(mergeDraftSeo(pages, '5381', null)).toBe(pages)
        expect(mergeDraftSeo(pages, undefined, { title: 'a' })).toBe(pages)
    })

    it('TC-F37-12-03: empty draft meta stays null (placeholder, not a saved value)', () => {
        const out = mergeDraftSeo(pages, 5381, { title: null, description: null })
        expect(out[0]).toMatchObject({ seoTitle: null, seoDescription: null })
    })
})

describe('GH-2256 seoChangeNeedsPublish', () => {
    it('TC-F37-12-04: true only for SEO edits on a published site', () => {
        expect(seoChangeNeedsPublish('published', { seoTitle: 'a' })).toBe(true)
        expect(seoChangeNeedsPublish('published', { seoDescription: '' })).toBe(true)
        expect(seoChangeNeedsPublish('draft', { seoTitle: 'a' })).toBe(false)
        expect(seoChangeNeedsPublish('published', {})).toBe(false)
    })
})
