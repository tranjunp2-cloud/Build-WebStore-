/**
 * TC-AIREL-73/74 — the agent tool facade on the release: site and stock-photo tools work with no commerce
 * platform at all; tools that only existed for Product Master / inventory are unknown (404). (Blog tools and the shop's
 * picture library: blog-copilot.test.ts / media-access.test.ts; product photos and saved generated pictures: shop-media-gaps.test.ts.)
 * Real: handle-agent-tool.ts routing, site read/prepare, media-tools.
 * Faked: the agent flag, the forwarded merchant (tool-actor), Payload, Pixabay.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { hasPixabayKey, searchPhotos } from '@/lib/ai/pixabay-client'

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/ai/pixabay-client', () => ({
    hasPixabayKey: vi.fn(() => true),
    searchPhotos: vi.fn(async () => [{ id: 11, url: 'https://cdn.pixabay.com/photo/11.jpg', alt: 'batik cloth', photographer: 'Mei', width: 800, height: 600 }]),
    downloadPhotoBuffer: vi.fn(),
}))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? site() : page(structuredClone(LAYOUT)))),
        find: vi.fn(async () => ({ docs: [{ id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, _status: 'draft' }], totalDocs: 1 })),
    })),
}))

function call(tool: string, body: unknown) {
    return handleAgentTool(new Request(`http://localhost:3000/api/agent-tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
}

beforeEach(() => {
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    vi.mocked(hasPixabayKey).mockReturnValue(true)
    vi.mocked(searchPhotos).mockClear()
})

describe('site and stock tools with no commerce platform [TC-AIREL-73]', () => {
    it('reads the site (pages, one page)', async () => {
        const pages = await call('site.read', { view: 'pages', siteId: String(SITE_ID) })
        const sections = await call('site.read', { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })

        expect(pages.status).toBe(200)
        expect(sections.status).toBe(200)
        const body = (await sections.json()) as { blocks: Array<{ id: string }> }
        expect(body.blocks.map((b) => b.id)).toEqual([NAV.id, HERO.id, FAQ.id, PRODUCTS.id, FOOTER.id])
    })

    it('drafts a page edit (site.prepare_patch)', async () => {
        const res = await call('site.prepare_patch', {
            siteId: String(SITE_ID),
            pageId: String(PAGE_ID),
            why: 'Warmer hero',
            ops: [{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Batik, made by hand' } }],
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ kind: 'site.page_patch' })
    })

    it('searches stock photos and names each one by a pixabay: ref', async () => {
        const res = await call('media.search', { source: 'stock', query: 'batik' })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ items: [expect.objectContaining({ ref: 'pixabay:11', credit: 'Pixabay · Mei' })] })
    })

    it('says stock photos are not set up (503) when there is no Pixabay key', async () => {
        vi.mocked(hasPixabayKey).mockReturnValue(false)

        const res = await call('media.search', { source: 'stock', query: 'batik' })

        expect(res.status).toBe(503)
    })

    it('hands a malformed site edit back to the model as data, not a failure', async () => {
        const res = await call('site.prepare_patch', { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'x', ops: [] })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ error: { code: 'invalid_input' } })
    })
})

describe('parts of the assistant that are not in this release answer clearly [TC-AIREL-74]', () => {
    it.each(['catalog.families', 'catalog.family_schema', 'inventory.read', 'inventory.prepare', 'product.prepare', 'product.prepare_publish'])(
        '%s was a Product Master tool: unknown here (404)',
        async (tool) => {
            expect((await call(tool, {})).status).toBe(404)
        },
    )

    it('is off (404) when the assistant is not enabled', async () => {
        const { isAiAgentEnabled } = await import('@/lib/ai-platform/config')
        vi.mocked(isAiAgentEnabled).mockReturnValueOnce(false)

        expect((await call('site.read', { view: 'pages', siteId: String(SITE_ID) })).status).toBe(404)
    })
})
