/**
 * TC-PERF-168 — The dashboard Media library lists the current workspace's files only: its own media plus legacy
 * (untenanted) media its sites / pages / products / blogs use; never private receipts, never another shop's files,
 * never an untenanted file nobody here uses. GET /api/media/library: 401 anonymous, `private, no-store`.
 * TC-PERF-169 — The REST listing of the media collection (`GET /api/media`, `/count`) is limited to the user's own
 * tenants (anonymous: refused, super-admin: all); reads by id, file reads and media populated into other
 * collections keep the public rule (storefront images, template thumbnails).
 * Real: lib/media/workspace-media-library.ts, lib/ai-platform/media-access.ts (referenced ids), lib/media/media-access.ts,
 *   the Media collection, the library route. Faked: Payload's Local API (in-memory store + small `where`
 *   interpreter), getCurrentUser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ media: [] as Row[], blogs: [] as Row[], products: [] as Row[], sites: [] as Row[], pages: [] as Row[] }))

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
        if (op === 'not_equals') return !got.some((v) => same(v, expected))
        if (op === 'in') return got.some((v) => (expected as unknown[]).some((e) => same(v, e)))
        if (op === 'exists') return (got.length > 0) === Boolean(expected)
        throw new Error(`unsupported where operator ${op}`)
    })
}
const cms = {
    find: vi.fn(async (args: { collection: keyof typeof store; where?: unknown; limit?: number; sort?: string }) => {
        let docs = (store[args.collection] as Row[]).filter((d) => matches(d, args.where))
        if (args.sort === '-createdAt') docs = [...docs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        return { docs: docs.slice(0, args.limit ?? 10), totalDocs: docs.length }
    }),
}

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/auth')>()),
    getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}))
vi.mock('payload', async (importOriginal) => ({ ...(await importOriginal<typeof import('payload')>()), getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { Media } from '@/collections/Media'
import { isRestMediaListing } from '@/lib/media/media-access'
import { listWorkspaceMediaLibrary } from '@/lib/media/workspace-media-library'
import { GET } from '@/app/api/media/library/route'

const file = (id: number, tenant: number | null, extra: Row = {}): Row => ({
    id, tenant, private: false, alt: `File ${id}`, filename: `f${id}.jpg`, mimeType: 'image/jpeg',
    createdAt: `2026-10-${String(10 + id).padStart(2, '0')}T00:00:00Z`, ...extra,
})

beforeEach(() => {
    Object.assign(store, {
        media: [
            file(1, 1), // ours
            file(2, 2), // another shop's
            file(3, null), // legacy, our blog cover
            file(4, null), // legacy, our product image
            file(5, null), // legacy, our page hero
            file(6, null), // legacy, the other shop's page only
            file(7, null), // legacy, used by nobody (shared stock / avatar)
            file(8, 1, { mimeType: 'application/pdf', filename: 'size-chart.pdf' }), // ours, not a picture: still listed
            file(9, 1, { private: true, alt: 'Payment proof — order ORD-9' }), // ours, a buyer's receipt
            file(11, null, { private: true }), // legacy receipt our blog points at (should never happen, never listed)
            file(12, 1, { sourceProvider: 'pixabay' }), // a stock picture the copilot saved for us
        ],
        blogs: [{ id: 1, tenant: 1, thumbnail: 3 }, { id: 2, tenant: 1, thumbnail: 11 }, { id: 3, tenant: 2, thumbnail: 6 }],
        products: [{ id: 1, tenant: 1, images: [{ image: 4 }] }, { id: 2, tenant: 2, images: [{ image: 2 }] }],
        sites: [{ id: 10, tenant: 1 }, { id: 20, tenant: 2 }],
        pages: [
            { id: 100, site: 10, layout: [{ blockType: 'hero', backgroundImage: 5 }] },
            { id: 200, site: 20, layout: [{ blockType: 'hero', image: 6 }] },
        ],
    })
    cms.find.mockClear()
    getCurrentUser.mockReset()
})

describe('the workspace Media library [TC-PERF-168]', () => {
    it('lists own files and legacy files the workspace uses, newest first; no receipts, nothing foreign or unused', async () => {
        // Act
        const rows = await listWorkspaceMediaLibrary(cms as never, 1)

        // Assert
        expect(rows.map((r) => r.id)).toEqual([12, 8, 5, 4, 3, 1])
    })

    it('mirrors the rule for the other shop', async () => {
        expect((await listWorkspaceMediaLibrary(cms as never, 2)).map((r) => r.id)).toEqual([6, 2])
    })

    it('lists nothing without a workspace', async () => {
        expect(await listWorkspaceMediaLibrary(cms as never, '')).toEqual([])
    })

    it('GET /api/media/library answers 401 to a visitor', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(null)

        // Act
        const res = await GET(new Request('http://app.test/api/media/library'))

        // Assert
        expect(res.status).toBe(401)
        expect(cms.find).not.toHaveBeenCalled()
    })

    it('GET /api/media/library serves the current (first) workspace of the user, not cacheable', async () => {
        // Arrange — member of shop 2 first, shop 1 second
        getCurrentUser.mockResolvedValue({ id: 7, tenants: [{ tenant: { id: 2 }, status: 'active' }, { tenant: { id: 1 }, status: 'active' }] })

        // Act
        const res = await GET(new Request('http://app.test/api/media/library'))
        const body = await res.json() as { docs: Row[] }

        // Assert
        expect(res.status).toBe(200)
        expect(res.headers.get('cache-control')).toBe('private, no-store')
        expect(body.docs.map((d) => d.id)).toEqual([6, 2])
    })
})

describe('REST listing of media [TC-PERF-169]', () => {
    const member = { id: 1, roles: ['tenant-owner'], tenants: [{ tenant: { id: 1 }, status: 'active' }] }
    const admin = { id: 9, roles: ['super-admin'], tenants: [] }
    const rest = (user: unknown, routeParams: Row, method = 'GET') => ({ user, payloadAPI: 'REST', method, routeParams })
    const read = (req: unknown, isReadingStaticFile = false) =>
        (Media.access!.read as (args: unknown) => unknown)({ req, isReadingStaticFile })

    it('GET /api/media (and /count): own tenants for a member, refused for a visitor, everything for a super-admin', () => {
        expect(read(rest(member, { collection: 'media' }))).toEqual({ tenant: { in: [1] } })
        expect(read(rest(null, { collection: 'media' }))).toBe(false)
        expect(read(rest(admin, { collection: 'media' }))).toBe(true)
        // a member with no active shop lists nothing
        expect(read(rest({ id: 3, tenants: [{ tenant: 1, status: 'suspended' }] }, { collection: 'media' }))).toBe(false)
    })

    it('keeps the public rule for a read by id, a file, media populated into another collection and the Local API', () => {
        const publicRows = { private: { not_equals: true } }

        expect(read(rest(null, { collection: 'media', id: '42' }))).toEqual(publicRows)
        expect(read(rest(null, { collection: 'media', filename: 'f1.jpg' }), true)).toEqual(publicRows)
        expect(read(rest(null, { collection: 'templates' }))).toEqual(publicRows)
        expect(read(rest(null, { collection: 'pages' }))).toEqual(publicRows)
        expect(read({ user: null, payloadAPI: 'local' })).toEqual(publicRows)
        expect(read(rest(member, { collection: 'media', id: '42' }))).toEqual({ or: [publicRows, { tenant: { in: [1] } }] })
    })

    it('only GET requests count as a listing', () => {
        expect(isRestMediaListing({ payloadAPI: 'REST', method: 'GET', routeParams: { collection: 'media' } })).toBe(true)
        expect(isRestMediaListing({ payloadAPI: 'REST', method: 'PATCH', routeParams: { collection: 'media' } })).toBe(false)
        expect(isRestMediaListing({ payloadAPI: 'REST', method: 'GET', routeParams: { collection: 'media' } }, true)).toBe(false)
    })
})

describe('Delete flag on library rows [TC-PERF-187]', () => {
    const member = { id: 7, roles: ['tenant-owner'], tenants: [{ tenant: { id: 1 }, status: 'active' }] }

    it('TC-PERF-187: GET /api/media/library marks own files deletable and legacy (tenant-less) files not', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(member)

        // Act
        const res = await GET(new Request('http://app.test/api/media/library'))
        const body = await res.json() as { docs: Row[] }

        // Assert
        const flags = Object.fromEntries(body.docs.map((d) => [d.id, d.canDelete]))
        expect(flags).toEqual({ 12: true, 8: true, 5: false, 4: false, 3: false, 1: true })
    })

    it('TC-PERF-187: the flag is the row-level answer of Media delete access (write access is not widened)', async () => {
        // Arrange: the Where that Media.access.delete gives the same member, applied to every library row
        const { canWriteMedia } = await import('@/lib/media/media-access')
        const where = (Media.access!.delete as (args: unknown) => unknown)({ req: { user: member } })
        expect(where).toEqual({ tenant: { in: [1] } })
        const rows = await listWorkspaceMediaLibrary(cms as never, 1)

        // Assert
        for (const row of rows) expect(canWriteMedia(member, row.tenant)).toBe(matches(row, where))
        // super-admin may delete legacy rows (as Media access allows); a visitor nothing; a suspended member nothing
        expect(canWriteMedia({ id: 9, roles: ['super-admin'], tenants: [] }, null)).toBe(true)
        expect(canWriteMedia(null, 1)).toBe(false)
        expect(canWriteMedia({ id: 3, tenants: [{ tenant: 1, status: 'suspended' }] }, 1)).toBe(false)
    })
})
