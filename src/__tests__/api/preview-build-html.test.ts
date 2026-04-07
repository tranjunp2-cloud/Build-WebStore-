import { describe, it, expect, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => handler),
}))
vi.mock('@/lib/preview', () => ({
    detectCategory: vi.fn().mockReturnValue('business'),
}))
vi.mock('@/app/api/preview/renderers', () => ({
    renderNav: vi.fn().mockReturnValue('<nav>Nav</nav>'),
    renderHero: vi.fn().mockReturnValue('<section>Hero</section>'),
    renderSections: vi.fn().mockReturnValue('<section>Sections</section>'),
    THEMES: { business: { primary: '#3B82F6', bg: '#fff', text: '#111' } },
    baseCSS: vi.fn().mockReturnValue('* { margin: 0 }'),
    getGoogleFontsLink: vi.fn().mockReturnValue('<link href="fonts">'),
}))
vi.mock('@/app/api/preview/renderers/hero', () => ({
    setHeroCategory: vi.fn(),
    setHeroImageIndex: vi.fn(),
}))
vi.mock('@/app/api/preview/renderers/sections', () => ({
    setSectionCategory: vi.fn(),
}))

import { buildFullHTML } from '@/lib/htmlBuilder'

// ─── TC-F05: Preview HTML rendering ──────────────────────────────────

describe('buildFullHTML [TC-F05]', () => {
    const blocks = [
        { blockType: 'navigation', logoText: 'My Site' },
        { blockType: 'hero', headline: 'Welcome' },
        { blockType: 'about', body: 'About us' },
    ]

    it('returns valid HTML document', () => {
        const html = buildFullHTML(blocks)
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('</html>')
    })

    it('includes nav, hero, and section content', () => {
        const html = buildFullHTML(blocks)
        expect(html).toContain('<nav>Nav</nav>')
        expect(html).toContain('<section>Hero</section>')
        expect(html).toContain('<section>Sections</section>')
    })

    it('includes Google Fonts link', () => {
        const html = buildFullHTML(blocks)
        expect(html).toContain('<link href="fonts">')
    })

    it('includes base CSS', () => {
        const html = buildFullHTML(blocks)
        expect(html).toContain('margin: 0')
    })

    it('uses provided meta for title and description', () => {
        const html = buildFullHTML(blocks, undefined, 'business', {
            name: 'Test Site',
            description: 'A test description',
            lang: 'ms',
        })
        expect(html).toContain('Test Site')
        expect(html).toContain('A test description')
        expect(html).toContain('lang="ms"')
    })

    it('defaults to english language', () => {
        const html = buildFullHTML(blocks)
        expect(html).toContain('lang="en"')
    })

    it('defaults category to business when not provided', () => {
        const html = buildFullHTML(blocks)
        // Should not throw and produce valid output
        expect(html.length).toBeGreaterThan(100)
    })
})
