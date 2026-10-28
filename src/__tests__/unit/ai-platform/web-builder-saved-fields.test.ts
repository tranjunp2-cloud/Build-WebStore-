/**
 * TC-AIWB-51 / 52 — only what a save keeps: fields the block schema names but Payload has no column for
 * (hero overlayOpacity, sectionLabel on most blocks, service card buttons…) are not offered to the copilot,
 * so the card never shows a change that is dropped on save. Hero slide pictures (a JSON list) are written as
 * { url, alt }, which the save checks, instead of a bare media id that made the whole save fail.
 * Real: site-persisted.ts (the Pages collection config), site-blocks.ts, site-prepare.ts, site-patch.ts,
 * block-normalization.ts, the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { runPagePatch } from '@/lib/ai-platform/site/site-patch'
import { editableKeys } from '@/lib/ai-platform/site/site-blocks'
import { storedKeys } from '@/lib/ai-platform/site/site-persisted'
import { describeShown } from '@/lib/ai-platform/site/site-shown'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'

const db = vi.hoisted((): { current: FakeDb } => ({ current: { site: null, page: null, products: [] } }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? db.current.products : [] })),
    })),
}))

const SERVICES_ID = '00000000-0000-4000-8000-0000000000f3'
const SERVICES = { blockType: 'service-cards', id: SERVICES_ID, variant: 'grid', headline: 'Services', services: [{ id: 'bbbbbbbbbbbbbbbbbbbbbbb1', title: 'Tailoring', description: 'Made to fit', icon: '✂️' }] }
const SLIDES = { ...HERO, variant: 'slideshow', slides: [{ headline: 'Raya', ctaButtons: [] }] }
const PICTURE = { ref: 'pixabay:1', name: 'Raya collection' }

const patch = (ops: unknown[]) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Edit', ops }) as Promise<{ error?: { code: string }; plan?: { ops: unknown[] }; guardrails?: Array<{ ok: boolean; detail: string }> }>

beforeEach(() => {
    db.current = { site: site(), page: page([NAV, HERO, SERVICES, FOOTER]), products: [] }
})

describe('only fields a save keeps are offered [TC-AIWB-51]', () => {
    it('drops schema fields Payload has no column for from editableFields', () => {
        expect(editableKeys('hero')).toContain('headline')
        expect(editableKeys('hero')).not.toContain('overlayOpacity')
        expect(editableKeys('hero')).not.toContain('sectionLabel')
        expect(editableKeys('features')).toContain('sectionLabel')
        expect(storedKeys('service-cards', ['services'])).not.toContain('cta')
        expect(storedKeys('hero', ['slides'])).toBeNull()
    })

    it('skips such a field in set_fields, and in a list item; refuses it in set_value', async () => {
        const fields = await patch([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Raya sale', overlayOpacity: 0.5 } }])
        expect(fields.plan?.ops).toEqual([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Raya sale' } }])
        expect(fields.guardrails?.some((g) => !g.ok && g.detail.includes('overlayOpacity'))).toBe(true)

        const list = await patch([{ op: 'edit_list', blockId: SERVICES_ID, path: 'services', rows: [{ keep: 0, fields: { title: 'Alterations', cta: { label: 'Book', url: '/book' } } }] }])
        expect(list.plan?.ops).toEqual([{ op: 'edit_list', blockId: SERVICES_ID, path: 'services', rows: [{ keep: 0, fields: { title: 'Alterations' } }] }])

        expect((await patch([{ op: 'set_value', blockId: SERVICES_ID, path: 'services.0.cta', value: 'x' }])).error).toMatchObject({ code: 'not_stored' })
    })
})

describe('hero slide pictures [TC-AIWB-52]', () => {
    it('a slide picture is written as { url, alt }, and the save accepts it', () => {
        const { next } = runPagePatch([SLIDES] as never, [{ op: 'set_image', blockId: HERO.id, path: 'slides.0.image', image: PICTURE, mediaId: 77, mediaUrl: 'https://media.test/raya.jpg' }])

        expect((next[0] as typeof SLIDES & { slides: Array<{ image?: unknown }> }).slides[0]!.image).toEqual({ url: 'https://media.test/raya.jpg', alt: 'Raya collection' })
        expect(() => normalizeBlocksForPersistence(next as never)).not.toThrow()
    })

    it('an upload field still gets the media id', () => {
        const { next } = runPagePatch([HERO] as never, [{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE, mediaId: 77, mediaUrl: 'https://media.test/raya.jpg' }])

        expect((next[0] as Record<string, unknown>).image).toBe(77)
    })
})

describe('sample pictures of picture-heavy sections [TC-AIWB-47]', () => {
    const ctx = { siteId: String(SITE_ID), tenantId: '1' }

    it('hero styles that fill an empty picture with a stock photo say so; centered does not', async () => {
        expect((await describeShown({ ...HERO, variant: 'split-left', image: null }, ctx)).pictures).toEqual([expect.objectContaining({ where: 'image', source: 'sample' })])
        expect((await describeShown({ ...HERO, variant: 'centered', image: null }, ctx)).pictures).toEqual([expect.objectContaining({ where: 'image', source: 'empty' })])
    })

    it('a carousel without items shows 6 samples to add as items; an item without a picture a sample', async () => {
        const empty = await describeShown({ blockType: 'carousel', items: [] }, ctx)
        expect(empty.pictures).toHaveLength(6)
        expect(empty.pictures[0]!.change).toContain('edit_list path "items"')
        const one = await describeShown({ blockType: 'carousel', items: [{ title: 'A', image: null }, { title: 'B', image: 5 }] }, ctx)
        expect(one.pictures.map((p) => [p.where, p.source])).toEqual([['items.0.image', 'sample'], ['items.1.image', 'own']])
    })
})
