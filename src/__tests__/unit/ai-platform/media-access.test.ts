/**
 * TC-AIREL-130..139 — which Payload `media` rows a workspace's AI copilot may reuse and list.
 * Rule under test (lib/ai-platform/media-access.ts): a row is allowed for a workspace when media.tenant is that
 * workspace, or when media.tenant is empty (legacy upload) and the workspace's own sites / pages / products /
 * blogs already use it. Another workspace's row, and a legacy row nobody here uses, are refused.
 * Real: media-access.ts, picture-ingest.ts (library branch), media-tools.ts (library search), attachments.ts (pick/list),
 *   the Media collection's tenant hook, the real Pages/Sites field configs.
 * Faked: Payload's Local API (an in-memory store with a small `where` interpreter), file bytes (fetch), the agent flag/context.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ media: [] as Row[], blogs: [] as Row[], products: [] as Row[], sites: [] as Row[], pages: [] as Row[], finds: [] as Array<{ collection: string; where?: unknown }> }))

/** Reads a dotted path through arrays ("images.image" over [{image: 4}, {image: 5}] -> [4, 5]). */
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
    find: vi.fn(async (args: { collection: keyof typeof store; where?: unknown; limit?: number; sort?: string }) => {
        store.finds.push({ collection: args.collection, where: args.where })
        let docs = (store[args.collection] as Row[]).filter((d) => matches(d, args.where))
        if (args.sort === '-createdAt') docs = [...docs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        return { docs: docs.slice(0, args.limit ?? 10), totalDocs: docs.length }
    }),
    create: vi.fn(),
    findByID: vi.fn(),
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
vi.mock('@/lib/ai/pixabay-client', () => ({ hasPixabayKey: vi.fn(() => true), searchPhotos: vi.fn(), downloadPhotoBuffer: vi.fn() }))

import { Media, resolveMediaTenant } from '@/collections/Media'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { collectUploadIds, isMediaRefAllowed, listAllowedMedia, mediaRefId, resolveAllowedMedia } from '@/lib/ai-platform/media-access'
import { searchMedia } from '@/lib/ai-platform/agent-tools/media-tools'

const OURS = '1'
const THEIRS = '2'
const media = (id: number, tenant: number | null, extra: Row = {}): Row => ({ id, tenant, alt: `Picture ${id}`, filename: `p${id}.jpg`, mimeType: 'image/jpeg', url: `/api/media/file/p${id}.jpg`, createdAt: `2026-10-${String(10 + id).padStart(2, '0')}T00:00:00Z`, ...extra })

beforeEach(() => {
    store.finds.length = 0
    Object.assign(store, {
        media: [
            media(1, 1), // ours
            media(2, 2), // another workspace's
            media(3, null), // legacy, used by our blog cover
            media(4, null), // legacy, used by our product
            media(5, null), // legacy, used by our home page hero
            media(6, null), // legacy, used by the other shop only
            media(7, null), // legacy, used by nobody (e.g. a payment QR)
            media(8, 1, { mimeType: 'application/pdf', alt: 'Size chart', filename: 'chart.pdf' }), // ours, not a picture
            media(9, null), // legacy, used by our site's social image
            media(10, null), // legacy, only the payment QR field of our site
        ],
        blogs: [{ id: 1, tenant: 1, thumbnail: 3 }, { id: 2, tenant: 2, thumbnail: 6 }],
        products: [
            { id: 1, tenant: 1, images: [{ image: 4 }] },
            { id: 2, tenant: 2, images: [{ image: 2 }] },
        ],
        sites: [
            { id: 10, tenant: 1, seo: { ogImage: 9 }, payments: { merchantQrCode: 10 } },
            { id: 20, tenant: 2 },
        ],
        pages: [
            { id: 100, site: 10, layout: [{ blockType: 'hero', backgroundImage: 5 }, { blockType: 'gallery', images: [{ image: 1 }] }] },
            { id: 200, site: 20, layout: [{ blockType: 'hero', image: 6 }] },
        ],
    })
    cms.find.mockClear()
})

describe('the ownership rule [TC-AIREL-130]', () => {
    it('allows a row uploaded by the workspace', async () => {
        const allowed = await resolveAllowedMedia(cms as never, OURS, [1])

        expect([...allowed.keys()]).toEqual(['1'])
        expect(allowed.get('1')).toMatchObject({ via: 'tenant', url: '/api/media/file/p1.jpg' })
    })

    it('refuses another workspace\'s row and an id that does not exist', async () => {
        expect((await resolveAllowedMedia(cms as never, OURS, [2, 999])).size).toBe(0)
        expect(await isMediaRefAllowed(cms as never, OURS, 'media:2')).toBe(false)
        expect(await isMediaRefAllowed(cms as never, THEIRS, 'media:1')).toBe(false)
    })

    it('refuses anything that is not a media:<id> ref, without asking the database', async () => {
        for (const ref of ['pixabay:3', 'attachment:att_1', 'asset:9', 'media:', 'media:1x', 'media:-1', 'https://x/y.jpg']) {
            expect(await isMediaRefAllowed(cms as never, OURS, ref)).toBe(false)
        }
        expect(cms.find).not.toHaveBeenCalled()
        expect(mediaRefId('media:42')).toBe('42')
    })

    it('refuses everything when the workspace is unknown', async () => {
        expect((await resolveAllowedMedia(cms as never, '', [1, 3])).size).toBe(0)
    })
})

describe('legacy rows (no tenant) [TC-AIREL-131]', () => {
    it.each([
        [3, 'a blog cover'],
        [4, 'a product image'],
        [5, 'a page block picture on the workspace\'s pages'],
        [9, 'a site social image'],
    ])('allows row %i because the workspace already uses it as %s', async (id) => {
        const allowed = await resolveAllowedMedia(cms as never, OURS, [id])

        expect(allowed.get(String(id))).toMatchObject({ via: 'referenced' })
    })

    it('refuses a legacy row that is only used by another workspace, by nobody, or as a payment QR', async () => {
        for (const id of [6, 7, 10]) expect((await resolveAllowedMedia(cms as never, OURS, [id])).size, `row ${id}`).toBe(0)
    })

    it('mixes owned, legacy-used and refused ids in one call (one reference scan)', async () => {
        const allowed = await resolveAllowedMedia(cms as never, OURS, [1, 2, 3, 6, 7])

        expect([...allowed.keys()].sort()).toEqual(['1', '3'])
        expect(store.finds.filter((f) => f.collection === 'pages')).toHaveLength(1)
    })

    it('does not scan sites, pages, products or blogs when every id is owned', async () => {
        await resolveAllowedMedia(cms as never, OURS, [1])

        expect(store.finds.map((f) => f.collection)).toEqual(['media'])
    })

    it('reads pages as the editor draft', async () => {
        await resolveAllowedMedia(cms as never, OURS, [5])

        const pages = cms.find.mock.calls.find(([args]) => args.collection === 'pages')![0] as { draft?: boolean; overrideAccess?: boolean }
        expect(pages.draft).toBe(true)
        expect(pages.overrideAccess).toBe(true)
    })
})

describe('upload fields in a document [TC-AIREL-132]', () => {
    it('collects picture ids from blocks, rows, slides and populated objects, never from the payment QR', () => {
        const found = collectUploadIds({
            layout: [
                { blockType: 'hero', backgroundImage: 5, slides: [{ image: 12 }, { image: { id: 13, url: '/x' } }] },
                { blockType: 'gallery', images: [{ image: 1 }, { image: null }] },
            ],
            seo: { ogImage: '9' },
            payments: { merchantQrCode: 10 },
            headline: 77,
        })

        expect([...found].sort()).toEqual(['1', '12', '13', '5', '9'])
    })
})

describe('the Media collection stamps its owner [TC-AIREL-133]', () => {
    const member = (tenant: unknown, extra: Row = {}) => ({ id: 9, tenants: [{ tenant, role: 'owner' }, { tenant: 8 }], ...extra })

    it('a tenant user\'s upload belongs to their workspace; a foreign tenant in the request is ignored', () => {
        expect(resolveMediaTenant(member({ id: 4 }), undefined)).toBe(4)
        expect(resolveMediaTenant(member(4), 99)).toBe(4)
    })

    it('a member of several workspaces may name one of them', () => {
        expect(resolveMediaTenant(member(4), '8')).toBe('8')
    })

    it('a platform admin keeps the requested tenant, else falls back to their own', () => {
        expect(resolveMediaTenant(member(4, { roles: ['super-admin'] }), 55)).toBe(55)
        expect(resolveMediaTenant({ id: 1, roles: ['super-admin'], tenants: [] }, undefined)).toBeNull()
    })

    it('no user (the copilot\'s ingest, scripts): the caller\'s explicit tenant is kept; none stays empty', () => {
        expect(resolveMediaTenant(null, 7)).toBe(7)
        expect(resolveMediaTenant(undefined, { id: 7 })).toBe(7)
        expect(resolveMediaTenant(null, undefined)).toBeNull()
    })

    it('the collection has a nullable indexed tenant field, set only on create, immutable afterwards, public file reads unchanged', async () => {
        const field = Media.fields.find((f) => 'name' in f && f.name === 'tenant') as unknown as { required?: boolean; index?: boolean; relationTo?: string; access: { update: () => boolean } }
        expect(field).toMatchObject({ relationTo: 'tenants', index: true })
        expect(field.required).not.toBe(true)
        expect(field.access.update()).toBe(false)
        expect((Media.access!.read as () => boolean)()).toBe(true)

        const hook = Media.hooks!.beforeChange![0]!
        const run = (operation: 'create' | 'update', user: unknown, data: Row) => hook({ data, req: { user }, operation } as never) as Row
        expect(run('create', member(4), { alt: 'x' })).toMatchObject({ tenant: 4 })
        expect(run('create', null, { alt: 'x', tenant: 6 })).toMatchObject({ tenant: 6 })
        expect(run('create', null, { alt: 'x' })).not.toHaveProperty('tenant')
        expect(run('update', member(4), { alt: 'renamed' })).not.toHaveProperty('tenant')
    })
})

describe('the library listing [TC-AIREL-134]', () => {
    it('lists exactly the allowed set: own pictures first, then legacy pictures the workspace uses (newest first); no PDF, nothing foreign', async () => {
        const rows = await listAllowedMedia(cms as never, OURS, { limit: 24 })

        expect(rows.map((r) => [r.id, r.via])).toEqual([
            ['1', 'tenant'],
            ['9', 'referenced'],
            ['5', 'referenced'],
            ['4', 'referenced'],
            ['3', 'referenced'],
        ])
    })

    it('never lists another workspace\'s pictures for that workspace, and mirrors the rule for the other shop', async () => {
        const rows = await listAllowedMedia(cms as never, THEIRS, { limit: 24 })

        expect(rows.map((r) => r.id).sort()).toEqual(['2', '6'])
    })

    it('matches on alt text or file name, and keeps the limit within 1..24', async () => {
        expect((await listAllowedMedia(cms as never, OURS, { query: 'picture 4' })).map((r) => r.id)).toEqual(['4'])
        expect((await listAllowedMedia(cms as never, OURS, { query: 'p5.jpg' })).map((r) => r.id)).toEqual(['5'])
        expect(await listAllowedMedia(cms as never, OURS, { limit: 2 })).toHaveLength(2)
        expect((await listAllowedMedia(cms as never, OURS, { limit: 500 })).length).toBeLessThanOrEqual(24)
    })

    it('returns media:<id> refs through the tool the copilot calls (media.search source "media")', async () => {
        const items = await searchMedia({ source: 'media', query: '', limit: 3 }, OURS)

        expect(items.map((i) => i.ref)).toEqual(['media:1', 'media:9', 'media:5'])
        expect(items[0]).toMatchObject({ name: 'Picture 1', url: '/api/media/file/p1.jpg' })
        expect(items[0]).not.toHaveProperty('credit')
    })

    it('answers the library only for a known workspace (also the product photos, which are scoped to one)', async () => {
        await expect(searchMedia({ source: 'media', query: '' })).rejects.toThrow(/not available/)
        await expect(searchMedia({ source: 'product', query: '' })).rejects.toThrow(/not available/)
    })
})

describe('placing a library picture [TC-AIREL-135]', () => {
    const place = (ref: string, tenant = OURS) => ingestPicture(cms as never, { ref }, 'Alt', undefined, tenant)

    it('reuses an owned row as it is: no copy, no new row', async () => {
        expect(await place('media:1')).toEqual({ id: 1, url: '/api/media/file/p1.jpg' })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it('reuses a legacy row the workspace already uses', async () => {
        expect(await place('media:3')).toEqual({ id: 3, url: '/api/media/file/p3.jpg' })
    })

    it.each(['media:2', 'media:6', 'media:7', 'media:999'])('refuses %s (422): a picture outside the shop\'s library', async (ref) => {
        const failure = await place(ref).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 422 })
        expect(cms.create).not.toHaveBeenCalled()
    })

    it('refuses an own row that is not a picture (a PDF)', async () => {
        await expect(place('media:8')).rejects.toMatchObject({ status: 422, message: 'Only pictures can be used here.' })
    })
})

describe('the attach menu serves the library [TC-AIREL-136]', () => {
    const fetchMock = vi.fn()
    const req = (path: string, init?: RequestInit) => new NextRequest(`http://localhost:3000/api/agent/${path}`, { headers: { host: 'localhost:3000', 'content-type': 'application/json' }, ...init })

    beforeEach(() => {
        fetchMock.mockReset().mockImplementation(async (target: URL | string) => {
            if (String(target).includes('/api/media/file/')) return new Response(Buffer.alloc(2000, 1), { status: 200, headers: { 'content-type': 'image/jpeg' } })
            return new Response(JSON.stringify({ id: 'att_9', kind: 'image', origin: 'media', name: 'Picture 1', mime: 'image/jpeg', size: 2000 }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        vi.stubGlobal('fetch', fetchMock)
        process.env.AI_PLATFORM_URL = 'http://ai-platform.test'
    })

    it('lists the allowed rows with their media: id', async () => {
        const res = await handleAgentProxy(req('media?source=media&limit=2'), ['media'])

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([
            expect.objectContaining({ id: 'media:1', origin: 'media', name: 'Picture 1', url: '/api/media/file/p1.jpg' }),
            expect.objectContaining({ id: 'media:9', origin: 'media' }),
        ])
    })

    it('turns an allowed pick into an attachment read from the row\'s own file (the browser URL is ignored)', async () => {
        const res = await handleAgentProxy(
            req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'media', ref: 'media:1', url: 'https://evil.example/x.jpg', name: 'Picture 1' }) }),
            ['attachments', 'pick'],
        )

        expect(res.status).toBe(201)
        expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:3000/api/media/file/p1.jpg')
        expect(JSON.parse(String(fetchMock.mock.calls[1]![1].body))).toMatchObject({ origin: 'media', ref: 'media:1', mime: 'image/jpeg' })
    })

    it.each(['media:2', 'media:6', 'media:7'])('refuses to pick %s (403) and sends nothing', async (ref) => {
        const res = await handleAgentProxy(req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'media', ref, name: 'x' }) }), ['attachments', 'pick'])

        expect(res.status).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refuses a library file stored on a host that is neither this app nor the media storage', async () => {
        store.media.push(media(11, 1, { url: 'https://evil.example/p11.jpg' }))

        const res = await handleAgentProxy(req('attachments/pick', { method: 'POST', body: JSON.stringify({ origin: 'media', ref: 'media:11', name: 'x' }) }), ['attachments', 'pick'])

        expect(res.status).toBe(502)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
