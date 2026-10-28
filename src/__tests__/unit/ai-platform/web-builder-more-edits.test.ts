/**
 * TC-AIWB-55…59 — the rest of the editor the copilot can now automate:
 * 55 whole sections in the read (lists up to 60 items, texts up to 4000 characters) and pictures named by alt;
 * 56 a section's own locked content: video links (YouTube / Vimeo / https files only), comparison columns,
 *    quick-view cards; picture URL fields stay pictures;
 * 57 an item's picture in the same list edit (new card with its photo, a new gallery picture), image captions by path;
 * 58 products grid: picked products switch it to fixed, a category must be the store's;
 * 59 the menu's shop name and button, the footer's tagline, copyright and social links.
 * Real: site-read.ts, site-shown.ts, site-prepare.ts, site-patch.ts, site-nav.ts, site-blocks.ts, the block registry.
 * Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { blockCopy } from '@/lib/ai-platform/site/site-read'
import { describeShown } from '@/lib/ai-platform/site/site-shown'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { runPagePatch, type PagePatchOp } from '@/lib/ai-platform/site/site-patch'
import { buildFrame, NavChangeError } from '@/lib/ai-platform/site/site-nav'
import { editableKeys, isEmbeddableVideo } from '@/lib/ai-platform/site/site-blocks'

const db = vi.hoisted(() => ({ current: { site: null, page: null, products: [] } as FakeDb, media: [] as unknown[], categories: [] as unknown[] }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({
            docs: collection === 'products' ? db.current.products : collection === 'media' ? db.media : collection === 'categories' ? db.categories : [],
        })),
    })),
}))

const GALLERY = { blockType: 'gallery', id: '00000000-0000-4000-8000-0000000000f5', variant: 'grid', headline: 'Kedai', images: [{ id: 'cccccccccccccccccccccccc', image: 36, caption: 'Cà phê' }] }
const TEAM = { blockType: 'team', id: '00000000-0000-4000-8000-0000000000f6', variant: 'grid', headline: 'Team', members: [{ id: 'aaaaaaaaaaaaaaaaaaaaaaa1', name: 'Aisyah', role: 'Founder', image: 31 }] }
const VIDEO = { blockType: 'video', id: '00000000-0000-4000-8000-0000000000f7', variant: 'embed', headline: 'Raya', videoUrl: 'https://youtu.be/abc' }
const GRID = { blockType: 'products-grid', id: '00000000-0000-4000-8000-0000000000d1', variant: 'grid-3', headline: 'Shop', selectionMode: 'all' }
const PICTURE = { ref: 'pixabay:9', name: 'Hijab' }

type Result = { error?: { code: string; message: string }; plan?: { ops: PagePatchOp[] }; diffs?: Array<{ field: string; before: string | null; after: string }> }
const patch = (ops: unknown[]) => preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Edit', ops }) as Promise<Result>

beforeEach(() => {
    db.current = { site: site(), page: page([NAV, HERO, GALLERY, TEAM, VIDEO, GRID, FOOTER]), products: [{ id: '1' }] }
    db.media = []
    db.categories = []
})

describe('whole sections in the read [TC-AIWB-55]', () => {
    it('keeps up to 60 items and 4000 characters', () => {
        const long = 'x'.repeat(3000)
        const copy = blockCopy({ faqs: Array.from({ length: 15 }, (_, i) => ({ question: `Q${i}`, answer: long })) }) as { faqs: Array<{ answer: string }> }

        expect(copy.faqs).toHaveLength(15)
        expect(copy.faqs[14]!.answer).toHaveLength(3000)
    })

    it('names own pictures by their alt text', async () => {
        db.media = [{ id: 36, alt: 'coffee cup on a table' }]

        const shown = await describeShown(GALLERY as never, { siteId: String(SITE_ID), tenantId: '1' }, true)

        expect(shown.pictures[0]!.now).toBe('your picture (media 36: “coffee cup on a table”)')
    })
})

describe('locked content a section owns [TC-AIWB-56]', () => {
    it('takes a YouTube / Vimeo / https video file, never another page', async () => {
        expect(isEmbeddableVideo('https://www.youtube.com/watch?v=x')).toBe(true)
        expect(isEmbeddableVideo('https://cdn.shop.my/raya.mp4')).toBe(true)
        expect(isEmbeddableVideo('https://evil.example/page')).toBe(false)
        expect(isEmbeddableVideo('http://youtu.be/x')).toBe(false)

        expect((await patch([{ op: 'set_value', blockId: VIDEO.id, path: 'videoUrl', value: 'https://vimeo.com/1' }])).error).toBeUndefined()
        expect((await patch([{ op: 'set_value', blockId: VIDEO.id, path: 'videoUrl', value: 'https://evil.example/x' }])).error).toMatchObject({ code: 'bad_video' })
    })

    it('comparison columns and quick-view cards are editable; picture URL fields are not text', () => {
        expect(editableKeys('feature-comparison')).toContain('products')
        expect(editableKeys('product-quick-view')).toContain('products')
        expect(editableKeys('products-featured')).not.toContain('products')
    })
})

describe('an item\'s picture in the same list edit [TC-AIWB-57]', () => {
    it('a new member comes with its photo; apply writes the copied media id', async () => {
        const result = await patch([{ op: 'edit_list', blockId: TEAM.id, path: 'members', rows: [{ keep: 0 }, { fields: { name: 'Dina', role: 'Sales' }, picture: { image: PICTURE } }] }])

        expect(result.error).toBeUndefined()
        const op = result.plan!.ops[0] as Extract<PagePatchOp, { op: 'edit_list' }>
        expect(op.rows[1]).toEqual({ fields: { name: 'Dina', role: 'Sales' }, picture: { key: 'image', image: PICTURE } })
        expect(result.diffs!.map((d) => [d.field, d.after])).toContainEqual(['members · new item 2 · picture', 'New picture: Hijab'])
        const applied = runPagePatch([TEAM] as never, [{ ...op, rows: [op.rows[0]!, { ...op.rows[1]!, mediaId: 88 }] }]).next[0] as typeof TEAM
        expect(applied.members[1]).toEqual({ name: 'Dina', role: 'Sales', image: 88 })
    })

    it('a gallery takes a new picture by edit_list (picture required); a caption by path', async () => {
        expect((await patch([{ op: 'edit_list', blockId: GALLERY.id, path: 'images', rows: [{ keep: 0 }, { fields: { caption: 'Hijab' } }] }])).error).toMatchObject({ code: 'bad_patch' })
        expect((await patch([{ op: 'edit_list', blockId: GALLERY.id, path: 'images', rows: [{ keep: 0 }, { fields: { caption: 'Hijab' }, picture: { image: PICTURE } }] }])).error).toBeUndefined()
        expect((await patch([{ op: 'set_value', blockId: GALLERY.id, path: 'images.0.caption', value: 'Quầy cà phê' }])).error).toBeUndefined()
        expect((await patch([{ op: 'edit_list', blockId: GALLERY.id, path: 'images', rows: [{ keep: 0, picture: { image: { ref: 'media:5' } } }] }])).error).toMatchObject({ code: 'unknown_image' })
    })
})

describe('products grid choices [TC-AIWB-58]', () => {
    it('picking products switches the grid to fixed (shown on the card)', async () => {
        const result = await patch([{ op: 'set_fields', blockId: GRID.id, fields: { selectedProductIds: ['1'] } }])

        expect(result.plan!.ops[0]).toMatchObject({ fields: { selectedProductIds: ['1'], selectionMode: 'fixed' } })
        expect(result.diffs!.map((d) => [d.field, d.before, d.after])).toContainEqual(['selectionMode', 'all', 'fixed'])
    })

    it('a category must be one of the store\'s', async () => {
        expect((await patch([{ op: 'set_fields', blockId: GRID.id, fields: { category: '42' } }])).error).toMatchObject({ code: 'unknown_category' })
        db.categories = [{ id: 42, name: 'Baju Kurung' }]
        expect((await patch([{ op: 'set_fields', blockId: GRID.id, fields: { category: '42' } }])).error).toBeUndefined()
    })
})

describe('menu and footer settings [TC-AIWB-59]', () => {
    const current = {
        header: { blockType: 'navigation', logoText: 'Kedai', links: [], ctaButton: { show: true, label: 'Shop', url: '/shop' } },
        footer: { blockType: 'footer', tagline: 'Old', copyrightText: '© Kedai', columns: [{ title: 'Help', links: [] }] },
    }

    it('sets the shop name, the menu button, tagline, copyright and socials; keeps what it does not name', () => {
        const built = buildFrame(current, {
            header: { logoText: 'Kedai Demo', cta: { label: 'Xem áo dài Raya', url: '/raya' } },
            footer: { tagline: 'Áo dài may tại Kelantan', copyrightText: '© 2026 Kedai Demo', socials: [{ platform: 'Instagram', url: 'https://instagram.com/kedai' }] },
        })

        expect(built.header).toMatchObject({ logoText: 'Kedai Demo', ctaButton: { show: true, label: 'Xem áo dài Raya', url: '/raya' }, links: [] })
        expect(built.footer).toMatchObject({ tagline: 'Áo dài may tại Kelantan', copyrightText: '© 2026 Kedai Demo', socials: [{ platform: 'instagram', url: 'https://instagram.com/kedai' }], columns: [{ title: 'Help' }] })
        expect(buildFrame(current, { header: { cta: null }, footer: null }).header?.ctaButton).toMatchObject({ show: false, label: 'Shop' })
    })

    it('refuses a social link that is not https and an unsafe button link', () => {
        expect(() => buildFrame(current, { header: null, footer: { socials: [{ platform: 'facebook', url: 'http://fb.com/x' }] } })).toThrow(NavChangeError)
        expect(() => buildFrame(current, { header: { cta: { label: 'Go', url: 'javascript:alert(1)' } }, footer: null })).toThrow(NavChangeError)
    })
})

describe('menu links sent back unchanged [TC-AIWB-60]', () => {
    it('keep the menu block as it is (its translations too) when only the button changes', () => {
        const header = { blockType: 'navigation', links: [{ id: 'a', label: 'Home', url: '/' }], _localeContent: { en: { links: [{ label: 'Home' }] } }, ctaButton: { show: true, label: 'Shop Now', url: '/products' } }

        const built = buildFrame({ header, footer: null }, { header: { links: [{ label: 'Home', url: '/' }], cta: { label: 'Shop Now', url: '/contact' } }, footer: null })

        expect(built.header).toMatchObject({ links: [{ id: 'a', label: 'Home', url: '/' }], _localeContent: { en: { links: [{ label: 'Home' }] } }, ctaButton: { url: '/contact' } })
    })
})
