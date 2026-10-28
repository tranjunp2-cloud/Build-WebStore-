/**
 * TC-AIWB-40 / TC-AIWB-63 — "Show": where a line of a copilot change is in the editor.
 * A section names its page through the plan (one page, or the page of several whose ops touch it)
 * and its field by the line's `path`; the menu / footer by their path (older cards: by the field's
 * words); SEO by the page field; a page by its id; a theme change has no place.
 * Real: revealTargetOf, revealTargetsOf, elementRevealTarget, valueAtRevealPath. Faked: nothing.
 */

import { describe, expect, it } from 'vitest'
import { elementRevealTarget, revealTargetOf, revealTargetsOf, translatedInto, valueAtRevealPath } from '@/lib/editor/reveal/reveal-target'

const line = (kind: string, id: string, field: string, extra: { path?: string; label?: string } = {}) => ({
    entity: { kind, id, ...(extra.label ? { label: extra.label } : {}) },
    field,
    ...(extra.path ? { path: extra.path } : {}),
    before: 'old',
    after: 'new',
})

describe('revealTargetOf [TC-AIWB-40] [TC-AIWB-63]', () => {
    it('a section line of a one-page change: that page, section and field', () => {
        const change = { action: { kind: 'site.page_patch', payload: { siteId: '1', pageId: '7', ops: [] } } }

        expect(revealTargetOf(change, line('site_block', 'blk_hero', 'ctaButtons · “Mua ngay” · label', { path: 'ctaButtons.0.label', label: 'Hero · Home' }))).toEqual({
            surface: 'block',
            pageId: '7',
            blockId: 'blk_hero',
            path: 'ctaButtons.0.label',
            where: 'Hero · ctaButtons · “Mua ngay” · label',
            before: 'old',
            after: 'new',
        })
    })

    it('a section of a several-page change: the page whose ops touch it (edited or inserted)', () => {
        const change = {
            action: {
                kind: 'site.pages_patch',
                payload: {
                    siteId: '1',
                    pages: [
                        { pageId: '7', ops: [{ op: 'set_fields', blockId: 'blk_a' }] },
                        { pageId: '9', ops: [{ op: 'insert_block', block: { id: 'blk_new' } }] },
                    ],
                },
            },
        }

        expect(revealTargetOf(change, line('site_block', 'blk_a', 'headline'))).toMatchObject({ surface: 'block', pageId: '7', blockId: 'blk_a' })
        expect(revealTargetOf(change, line('site_block', 'blk_new', 'section'))).toMatchObject({ pageId: '9', blockId: 'blk_new' })
        expect(revealTargetOf(change, line('site_block', 'blk_unknown', 'headline'))).not.toHaveProperty('pageId')
    })

    it('menu or footer by path, older cards by the field; SEO by the page field; a theme change nowhere', () => {
        const nav = { action: { kind: 'site.nav_patch', payload: { siteId: '1' } } }

        expect(revealTargetOf(nav, line('site_navigation', '1', 'menu links', { path: 'header.links' }))).toMatchObject({ surface: 'menu', path: 'header.links' })
        expect(revealTargetOf(nav, line('site_navigation', '1', 'social links', { path: 'footer.socials' }))).toMatchObject({ surface: 'footer' })
        expect(revealTargetOf(nav, line('site_navigation', '1', 'footer column 2'))).toMatchObject({ surface: 'footer' })
        const seo = { action: { kind: 'site.seo_patch', payload: { siteId: '1', pageId: '7' } } }
        expect(revealTargetOf(seo, line('site_page', '7', 'SEO title', { path: 'seoTitle' }))).toMatchObject({ surface: 'seo', pageId: '7', path: 'seoTitle' })
        expect(revealTargetOf(seo, line('site_page', '7', 'SEO description'))).toMatchObject({ surface: 'seo' })
        expect(revealTargetOf({ action: { kind: 'site.publish' } }, line('site_page', '9', 'live site'))).toMatchObject({ surface: 'page', pageId: '9' })
        // a new page's id is its address until it exists: no page switch to a slug
        expect(revealTargetOf({ action: { kind: 'site.page_create' } }, line('site_page', 'about-us', 'page'))).not.toHaveProperty('pageId')
        expect(revealTargetOf({ action: { kind: 'site.theme_patch' } }, line('site_theme', '1', 'primaryColor'))).toBeNull()
    })

    it('revealTargetsOf: every line with a place, in card order (theme lines dropped)', () => {
        const change = {
            action: { kind: 'site.page_patch', payload: { pageId: '7' } },
            diffs: [line('site_block', 'blk_hero', 'headline', { path: 'headline' }), line('site_theme', '1', 'primaryColor'), line('site_block', 'blk_faq', 'title', { path: 'title' })],
        }

        expect(revealTargetsOf(change).map((t) => t.blockId)).toEqual(['blk_hero', 'blk_faq'])
    })
})

describe('element chips and values [TC-AIWB-63]', () => {
    it('an element chip of the chat points at the same place', () => {
        expect(elementRevealTarget({ kind: 'button', label: 'Mua ngay', pageId: '7', blockId: 'blk_hero', path: 'ctaButtons.0.label', value: 'Mua ngay' })).toEqual({
            surface: 'block',
            pageId: '7',
            blockId: 'blk_hero',
            path: 'ctaButtons.0.label',
            where: 'Mua ngay',
            after: 'Mua ngay',
        })
        expect(elementRevealTarget({ kind: 'seo', label: 'Home', pageId: '7', path: 'seoTitle' })).toMatchObject({ surface: 'seo' })
    })

    it('reads the stored value at a dot path (list index included)', () => {
        const block = { ctaButtons: [{ label: 'Mua ngay' }], images: [{ image: { url: '/a.jpg' } }] }
        expect(valueAtRevealPath(block, 'ctaButtons.0.label')).toBe('Mua ngay')
        expect(valueAtRevealPath(block, 'images.0.image')).toEqual({ url: '/a.jpg' })
        expect(valueAtRevealPath(block, 'missing.0')).toBeUndefined()
        expect(valueAtRevealPath(block, undefined)).toBeUndefined()
    })
})

// TC-AIWB-105 — a translation writes the page's copy in that language: its lines carry the
// language, so "Show" switches the canvas to it (the copy on screen would look unchanged)
describe('a translation line names its language [TC-AIWB-105]', () => {
    it('carries the plan locale on a translate change, and nothing on other changes', () => {
        const translate = { action: { kind: 'site.translate_page', payload: { siteId: '1', pageId: '7', locale: 'ms' } } }
        const patch = { action: { kind: 'site.page_patch', payload: { siteId: '1', pageId: '7', ops: [] } } }

        expect(revealTargetOf(translate, line('site_block', 'blk_t', 'quote', { path: 'testimonials.0.quote' }))).toMatchObject({ surface: 'block', pageId: '7', locale: 'ms' })
        expect(translatedInto(translate)).toBe('ms')
        expect(revealTargetOf(patch, line('site_block', 'blk_t', 'quote'))).not.toHaveProperty('locale')
        expect(translatedInto(patch)).toBeUndefined()
    })
})
