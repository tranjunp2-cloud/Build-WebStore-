/**
 * TC-AIREL-195..197 — "Photos of an existing product": the pictures the workspace's own (not trashed) products use,
 * labelled with the product name as `media:<id>`, only when they also pass the library rule; served by the facade
 * (`media.search source:"product"`) and the attach menu (`GET /api/agent/media?source=product`, pick origin `product`).
 * Real: agent-tools/product-photos, media-tools, media-access, attachments, agent-proxy, handle-agent-tool routing.
 * Faked: Payload's Local API (in-memory store with a small `where` interpreter), file bytes (fetch), agent flag/context.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ media: [] as Row[], blogs: [] as Row[], products: [] as Row[], sites: [] as Row[], pages: [] as Row[], finds: [] as Array<{ collection: string; where?: unknown }> }))

function values(doc: unknown, path: string): unknown[] {
    return path.split('.').reduce<unknown[]>((nodes, key) => nodes.flatMap((node) => (Array.isArray(node) ? node : [node]).map((n) => (n as Row | undefined)?.[key])), [doc])
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
}
const same = (a: unknown, b: unknown) => String(a) === String(b)
function matches(doc: Row, where: unknown): boolean {
    if (!where || typeof where !== 'object') return true
    return Object.entries(where as Row).every(([key, cond]) => {
        if (key === 'and') return (cond as unknown[]).every((c) => matches(doc, c))
        if (key === 'or') return (cond as unknown[]).some((c) => matches(doc, c))
        const [op, expected] = Object.entries(cond as Row)[0]!
        const got = values(doc, key).filter((v) => v !== undefined && v !== null)
        if (op === 'equals') return got.some((v) => same(v, expected))
        if (op === 'in') return got.some((v) => (expected as unknown[]).some((e) => same(v, e)))
        if (op === 'exists') return (got.length > 0) === Boolean(expected)
        if (op === 'like') return got.some((v) => String(v).toLowerCase().includes(String(expected).toLowerCase()))
        throw new Error(`unsupported where operator ${op}`)
    })
}
const cms = {
    find: vi.fn(async (args: { collection: keyof typeof store; where?: unknown; limit?: number }) => {
        store.finds.push({ collection: args.collection, where: args.where })
        const docs = (store[args.collection] as Row[]).filter((d) => matches(d, args.where))
        return { docs: docs.slice(0, args.limit ?? 10), totalDocs: docs.length }
    }),
}

vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true), getAiPlatformUrl: vi.fn(() => 'http://ai-platform.test') }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => ({ user: { id: 3, email: 'owner@shop.my' }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn(async () => ({ user: { id: 3 }, tenantId: '1', organizationId: 'org_1', role: 'owner' })) }))
vi.mock('@/lib/ai/pixabay-client', () => ({ hasPixabayKey: vi.fn(() => true), searchPhotos: vi.fn(), downloadPhotoBuffer: vi.fn() }))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { searchMedia } from '@/lib/ai-platform/agent-tools/media-tools'
import { listProductPhotos } from '@/lib/ai-platform/agent-tools/product-photos'

const OURS = '1'
const media = (id: number, tenant: number | null, extra: Row = {}): Row => ({ id, tenant, alt: `Picture ${id}`, filename: `p${id}.jpg`, mimeType: 'image/jpeg', url: `/api/media/file/p${id}.jpg`, ...extra })

beforeEach(() => {
    store.finds.length = 0
    Object.assign(store, {
        media: [
            media(11, 1),
            media(12, 1),
            media(13, 2), // another workspace's file that one of our products points at
            media(14, null), // legacy file our product uses
            media(15, 1, { mimeType: 'application/pdf', filename: 'sheet.pdf' }), // not a picture
            media(16, 1), // only a trashed product uses it
            media(17, 2), // the other shop's
            media(18, null), // legacy, used by nobody but another shop's product
        ],
        blogs: [],
        sites: [],
        pages: [],
        products: [
            { id: 1, name: 'Batik Scarf', tenant: 1, images: [{ image: 11 }, { image: 12 }] },
            { id: 2, name: 'Linen Bag', tenant: 1, images: [{ image: 12 }, { image: 13 }, { image: 14 }] },
            { id: 3, name: 'Old Hat', tenant: 1, deletedAt: '2026-10-01T00:00:00Z', images: [{ image: 16 }] },
            { id: 4, name: 'Their Mug', tenant: 2, images: [{ image: 17 }, { image: 18 }] },
            { id: 5, name: 'Size Sheet', tenant: 1, images: [{ image: 15 }] },
            { id: 6, name: 'No Photos', tenant: 1, images: [] },
        ],
    })
    cms.find.mockClear()
})

describe('product photos listing [TC-AIREL-195]', () => {
    it('lists the pictures our products use, each labelled with its product, once, as media:<id> in product order', async () => {
        const photos = await listProductPhotos(cms as never, OURS, { limit: 24 })

        expect(photos.map((p) => [`media:${p.id}`, p.productName])).toEqual([
            ['media:11', 'Batik Scarf'],
            ['media:12', 'Batik Scarf'],
            ['media:14', 'Linen Bag'],
        ])
        expect(photos[0]).toMatchObject({ url: '/api/media/file/p11.jpg', mimeType: 'image/jpeg' })
    })

    it('leaves out trashed products, other workspaces\' products and files that are not pictures', async () => {
        const ids = (await listProductPhotos(cms as never, OURS, { limit: 24 })).map((p) => p.id)

        for (const gone of ['16', '17', '18', '15']) expect(ids).not.toContain(gone)
        const query = store.finds.find((find) => find.collection === 'products')
        expect(JSON.stringify(query?.where)).toContain('"tenant":{"equals":1}')
        expect(JSON.stringify(query?.where)).toContain('"deletedAt":{"exists":false}')
    })

    it('filters on the product name and caps the page at 1..24', async () => {
        expect((await listProductPhotos(cms as never, OURS, { query: 'linen' })).map((p) => [p.id, p.productName])).toEqual([
            ['12', 'Linen Bag'],
            ['14', 'Linen Bag'],
        ])
        expect(await listProductPhotos(cms as never, OURS, { query: 'no such product' })).toEqual([])
        expect(await listProductPhotos(cms as never, OURS, { limit: 1 })).toHaveLength(1)
        expect((await listProductPhotos(cms as never, OURS, { limit: 500 })).length).toBeLessThanOrEqual(24)
    })

    it('has nothing for a workspace without product pictures, and skips the library lookup then', async () => {
        expect(await listProductPhotos(cms as never, '9', {})).toEqual([])
        expect(store.finds.some((find) => find.collection === 'media')).toBe(false)
    })
})

describe('only pictures the library rule allows [TC-AIREL-196]', () => {
    it('does not offer another workspace\'s file even when our own product points at it', async () => {
        const ids = (await listProductPhotos(cms as never, OURS, {})).map((p) => p.id)

        expect(ids).not.toContain('13')
        // and a legacy file is offered only because our product uses it
        expect(ids).toContain('14')
    })

    it('is scoped to the asking workspace: the other shop gets its own pictures only', async () => {
        const ids = (await listProductPhotos(cms as never, '2', {})).map((p) => p.id)

        expect(ids).toEqual(['17', '18'])
    })
})

describe('facade and attach menu [TC-AIREL-197]', () => {
    const fetchMock = vi.fn()
    const req = (path: string, init?: RequestInit) => new NextRequest(`http://localhost:3000/api/agent/${path}`, { headers: { host: 'localhost:3000', 'content-type': 'application/json' }, ...init })
    beforeEach(() => {
        fetchMock.mockReset().mockImplementation(async (target: URL | string) => {
            if (String(target).includes('/api/media/file/')) return new Response(Buffer.alloc(2000, 1), { status: 200, headers: { 'content-type': 'image/jpeg' } })
            return new Response(JSON.stringify({ id: 'att_9', kind: 'image', origin: 'product', name: 'Batik Scarf', mime: 'image/jpeg', size: 2000 }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        vi.stubGlobal('fetch', fetchMock)
        process.env.AI_PLATFORM_URL = 'http://ai-platform.test'
    })

    it('media.search source "product" answers the labelled photos (no 501), only for a known workspace', async () => {
        const res = await handleAgentTool(new Request('http://localhost:3000/api/agent-tools/media.search', { method: 'POST', body: JSON.stringify({ source: 'product', query: 'batik' }) }), 'media.search')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            items: [
                expect.objectContaining({ ref: 'media:11', name: 'Batik Scarf', url: '/api/media/file/p11.jpg' }),
                expect.objectContaining({ ref: 'media:12', name: 'Batik Scarf' }),
            ],
        })
        await expect(searchMedia({ source: 'product', query: '' })).rejects.toThrow(/not available/)
    })

    it('lists the photos in the attach menu\'s product tab', async () => {
        const res = await handleAgentProxy(req('media?source=product&q=linen&limit=5'), ['media'])

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([
            expect.objectContaining({ id: 'media:12', origin: 'product', name: 'Linen Bag', url: '/api/media/file/p12.jpg' }),
            expect.objectContaining({ id: 'media:14', origin: 'product', name: 'Linen Bag' }),
        ])
    })

    it('turns a picked product photo into an attachment read from the row\'s own file', async () => {
        const res = await handleAgentProxy(
            req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'product', ref: 'media:11', url: 'https://evil.example/x.jpg', name: 'Batik Scarf' }) }),
            ['attachments', 'pick'],
        )

        expect(res.status).toBe(201)
        expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:3000/api/media/file/p11.jpg')
        expect(JSON.parse(String(fetchMock.mock.calls[1]![1].body))).toMatchObject({ origin: 'product', ref: 'media:11', mime: 'image/jpeg' })
    })

    it.each(['media:13', 'media:17', 'media:18'])('refuses to pick %s (403) and sends nothing', async (ref) => {
        const res = await handleAgentProxy(req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'product', ref, name: 'x' }) }), ['attachments', 'pick'])

        expect(res.status).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('still refuses a non-media ref under the product origin', async () => {
        const res = await handleAgentProxy(req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'product', ref: 'asset:dam-1', name: 'x' }) }), ['attachments', 'pick'])

        expect(res.status).toBe(400)
    })
})
