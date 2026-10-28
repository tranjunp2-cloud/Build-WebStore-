/**
 * Blog copilot changes that are retried or undone twice (audit R-M2 / R-M4 / R-M6):
 * TC-AISEC-106 — undo of a blog edit / status change that already ran (its record was lost, a second tab)
 *   succeeds again without writing; a post that moved on to something else is still refused.
 * TC-AISEC-107 — a blog edit whose post changed or vanished since the draft is closed (final, stale), not left pending.
 * TC-AISEC-108 — a second apply of the same `blog.create_draft` change finds the post it created (its change set id
 *   is stored on the post) and returns it: no second post, no new photos; the editor's own save can't set that id.
 * TC-AISEC-109 — `blog.trash_created` undo: the new draft goes to the trash while untouched; already trashed or gone
 *   is a no-op; edited since is refused.
 * Real: appliers/blog-draft.ts, appliers/blog-edits.ts, appliers/record-edits.ts, lib/blog/save-blog.ts, the blog
 * editor's save action. Faked: Payload (in memory: blogs, sites), the plan lookup, picture ingest, the session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Post = Record<string, unknown> & { id: number }
const h = vi.hoisted(() => ({ blogs: [] as Post[], nextId: 50, clock: 0, writes: [] as Array<{ op: string; data?: unknown }>, ingested: 0 }))

/** `where` with equals / and, the shapes the blog code uses */
const matches = (doc: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean => {
    if (!where) return true
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'and') return (cond as Array<Record<string, unknown>>).every((c) => matches(doc, c))
        const value = doc[key]
        const id = (v: unknown) => String(v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
        return id(value) === id((cond as { equals?: unknown }).equals)
    })
}

vi.mock('payload', () => {
    const cms = {
        find: vi.fn(async ({ collection, where, trash }: { collection: string; where?: Record<string, unknown>; trash?: boolean }) => {
            if (collection === 'sites') return { docs: [{ id: 5, tenant: 1 }] }
            const docs = h.blogs.filter((d) => (trash || !d.deletedAt) && matches(d, where)).map((d) => structuredClone(d))
            return { docs, totalDocs: docs.length }
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            const doc = { id: h.nextId++, ...data, updatedAt: `t${++h.clock}` }
            h.blogs.push(doc)
            h.writes.push({ op: 'create', data })
            return structuredClone(doc)
        }),
        update: vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
            const doc = h.blogs.find((d) => d.id === Number(id))!
            Object.assign(doc, data, { updatedAt: `t${++h.clock}` })
            h.writes.push({ op: 'update', data })
            return structuredClone(doc)
        }),
    }
    return { getPayload: vi.fn(async () => cms) }
})
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'BUSINESS' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({
    ingestPicture: vi.fn(async () => ({ id: 900 + ++h.ingested, url: `/api/media/file/p${h.ingested}.jpg` })),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => ({ id: 3, email: 'owner@kedai.my', tenants: [{ tenant: 1 }] })) }))

import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { applyBlogRestoreFields, applyBlogStatus, applyBlogUpdate } from '@/lib/ai-platform/appliers/blog-edits'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { saveBlogAction } from '@/app/(dashboard)/blog/actions'

const actor = { user: { id: 3, email: 'owner@kedai.my', tenants: [{ tenant: 1 }] }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const soon = () => new Date(Date.now() + 86_400_000).toISOString()
const draftCard = (id = 'cs_blog_1') =>
    ({
        id,
        action: {
            kind: 'blog.create_draft',
            payload: { locale: 'en', title: 'Batik care', slug: 'batik-care', contentHtml: '<p>Wash cold.</p>', cover: { ref: 'stock:1', url: 'https://cdn.pixabay.com/a.jpg' } },
        },
    }) as never
const post = (id: number) => h.blogs.find((d) => d.id === id)!

beforeEach(() => {
    vi.clearAllMocks()
    h.blogs = [{ id: 4, tenant: 1, title: 'Old title', slug: 'old', status: 'draft', content: '<p>old</p>', seo: { metaTitle: 'Old' }, thumbnail: null, updatedAt: 't0' }]
    h.nextId = 50
    h.clock = 0
    h.writes = []
    h.ingested = 0
})

describe('blog draft replay key [TC-AISEC-108]', () => {
    it('a second apply of the same change returns the post it created: one post, photos ingested once', async () => {
        const first = await applyChangeSet(draftCard(), actor)
        const second = await applyChangeSet(draftCard(), actor)

        expect(h.blogs.filter((d) => d.title === 'Batik care')).toHaveLength(1)
        expect(post(50)).toMatchObject({ slug: 'batik-care', aiChangeSetId: 'cs_blog_1', status: 'draft', thumbnail: 901 })
        expect(h.ingested).toBe(1)
        expect(second.entities).toEqual(first.entities)
        expect(second.undo).toMatchObject({ kind: 'blog.trash_created', payload: { id: '50' } })
    })

    it('another change set makes its own post (the slug de-dup still applies)', async () => {
        await applyChangeSet(draftCard('cs_blog_1'), actor)
        await applyChangeSet(draftCard('cs_blog_2'), actor)

        expect(h.blogs.filter((d) => d.title === 'Batik care').map((d) => d.slug)).toEqual(['batik-care', 'batik-care-1'])
    })

    it('the blog editor\'s own save can\'t set the copilot replay key', async () => {
        await saveBlogAction({ title: 'Mine', slug: 'mine', content: '<p>x</p>', status: 'draft', aiChangeSetId: 'cs_blog_1' })

        expect(h.blogs.find((d) => d.title === 'Mine')).not.toHaveProperty('aiChangeSetId')
    })
})

describe('blog draft undo [TC-AISEC-109]', () => {
    it('moves the untouched new draft to the trash, and a repeated undo is a no-op', async () => {
        const result = await applyChangeSet(draftCard(), actor)
        const undo = { ...result.undo!, until: soon() }

        await applyUndo(undo, actor, 'cs_blog_1')
        expect(post(50).deletedAt).toEqual(expect.any(String))
        const writes = h.writes.length

        await expect(applyUndo(undo, actor, 'cs_blog_1')).resolves.toMatchObject({ entities: [] })
        expect(h.writes).toHaveLength(writes)
    })

    it('refuses once the merchant edited the draft', async () => {
        const result = await applyChangeSet(draftCard(), actor)
        Object.assign(post(50), { title: 'My own title', updatedAt: 'edited' })

        await expect(applyUndo({ ...result.undo!, until: soon() }, actor, 'cs_blog_1')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('edited after') })
        expect(post(50).deletedAt).toBeUndefined()
    })
})

describe('blog edit version guard closes the card [TC-AISEC-107]', () => {
    it('a post changed since the draft, or gone, is a final stale refusal; nothing is written', async () => {
        const changed = await applyBlogUpdate({ id: '4', base: 'older', changes: { title: 'New' } }, actor).catch((e) => e)
        const gone = await applyBlogUpdate({ id: '77', base: 't0', changes: { title: 'New' } }, actor).catch((e) => e)
        const status = await applyBlogStatus({ id: '4', base: { status: 'published', removed: false }, to: 'unpublish' }, actor).catch((e) => e)

        for (const error of [changed, gone, status]) expect(error).toMatchObject({ status: 409, final: true, stale: true })
        expect(h.writes).toEqual([])
    })
})

describe('blog undo that already ran [TC-AISEC-106]', () => {
    it('restore of fields: already the pre-image → success without writing; moved on → refused', async () => {
        const edit = await applyBlogUpdate({ id: '4', base: 't0', changes: { title: 'New', seoTitle: 'New SEO' } }, actor)
        const payload = edit.undo!.payload

        await applyBlogRestoreFields(payload, actor)
        expect(post(4)).toMatchObject({ title: 'Old title', seo: { metaTitle: 'Old' } })
        const writes = h.writes.length
        await expect(applyBlogRestoreFields(payload, actor)).resolves.toMatchObject({ entities: [{ kind: 'blog_post', id: '4' }] })
        expect(h.writes).toHaveLength(writes)

        Object.assign(post(4), { title: 'Third title', updatedAt: 'later' })
        await expect(applyBlogRestoreFields(payload, actor)).rejects.toMatchObject({ status: 409 })
    })

    it('status undo: the post already where the undo puts it → success without writing', async () => {
        const published = await applyBlogStatus({ id: '4', base: { status: 'draft', removed: false }, to: 'publish' }, actor)
        const undo = { ...published.undo!, until: soon() }

        await applyUndo(undo, actor, 'cs_x')
        expect(post(4).status).toBe('draft')
        const writes = h.writes.length

        await expect(applyUndo(undo, actor, 'cs_x')).resolves.toMatchObject({ entities: [{ id: '4' }] })
        expect(h.writes).toHaveLength(writes)
    })
})
