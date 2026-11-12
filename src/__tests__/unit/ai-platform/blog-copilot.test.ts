/**
 * TC-AIREL-140..149 — the blog copilot on the release (server side): the facade reads posts as the merchant and
 * pinned to the workspace; approved changes (draft, edit, publish/trash) are applied through the blog editor's own
 * save path with a version guard and an undo; pictures come in through the shop's library rule; Blogs gets its trash.
 * Real: handle-agent-tool.ts blog routing, content-tools, record-snapshot, blog-draft.ts, blog-edits.ts, appliers
 *   index + undo switch, the Blogs collection config, db-setup migrations, agent-starters.
 * Faked: Payload's Local API, the blog editor's save (saveBlogForUser), picture-ingest, the merchant (tool-actor), the plan gate.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ posts: [] as Row[] }))
const cms = {
    find: vi.fn(async (args: { where?: { and?: Array<Record<string, { equals?: unknown; exists?: boolean }>> }; trash?: boolean }) => {
        const clauses = (args.where?.and ?? []).flatMap((c) => Object.entries(c))
        const wanted = clauses.map(([k, v]) => [k, v.equals] as const).filter(([, v]) => v !== undefined)
        const onlyTrashed = clauses.some(([k, v]) => k === 'deletedAt' && v.exists === true)
        const docs = state.posts.filter((p) => wanted.every(([k, v]) => String(p[k]) === String(v)) && (onlyTrashed ? Boolean(p.deletedAt) : args.trash || !p.deletedAt))
        return { docs, totalDocs: docs.length }
    }),
    update: vi.fn(),
}
vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({ getActivePlanSubscription: vi.fn(async () => ({ plan: 'BUSINESS' })), canUse: vi.fn(async () => true) }))
vi.mock('@/lib/blog/save-blog', async (importActual) => ({ ...(await importActual<typeof import('@/lib/blog/save-blog')>()), saveBlogForUser: vi.fn() }))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn() }))

import { Blogs } from '@/collections/Blogs'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { applyBlogDraft } from '@/lib/ai-platform/appliers/blog-draft'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { applyBlogStatus, applyBlogUpdate } from '@/lib/ai-platform/appliers/blog-edits'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { agentStarters } from '@/components/agent/agent-starters'
import { saveBlogForUser } from '@/lib/blog/save-blog'
import { MIGRATIONS } from '../../../../scripts/db-setup.js'
import { dockShownOn } from '@/components/agent/agent-dock-routes'

const ACTOR = { user: { id: 3, email: 'owner@shop.my', tenants: [{ tenant: { id: 1 }, role: 'owner' }] }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const post = (extra: Row = {}): Row => ({ id: 4, tenant: 1, title: 'Batik care', slug: 'batik-care', status: 'draft', content: '<p>old</p>', updatedAt: 't1', seo: { metaTitle: 'Old' }, thumbnail: null, ...extra })
const call = (tool: string, body: unknown) => handleAgentTool(new Request(`http://localhost:3000/api/agent-tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)

beforeEach(() => {
    state.posts = [post(), post({ id: 5, tenant: 2, title: 'Other shop post' })]
    cms.find.mockClear()
    cms.update.mockReset().mockResolvedValue({ updatedAt: 't2' })
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(ACTOR)
    vi.mocked(saveBlogForUser).mockReset().mockResolvedValue({ id: 31 } as never)
    vi.mocked(ingestPicture).mockReset().mockImplementation(async (_cms, image) => {
        if (image.ref === 'media:2') throw new ChangeSetApplyError('A picture is not in this shop\'s library.', 422)
        return { id: image.ref === 'media:1' ? 1 : 60, url: `/api/media/file/${image.ref.replace(':', '-')}.jpg` }
    })
})

describe('facade: reading posts [TC-AIREL-140]', () => {
    it('searches the merchant\'s posts as the merchant, inside their workspace only', async () => {
        const res = await call('content.search_items', { kind: 'blog_post', query: 'batik', status: 'draft' })

        expect(res.status).toBe(200)
        const body = (await res.json()) as { items: Array<{ id: string }> }
        expect(body.items.map((i) => i.id)).toEqual(['4'])
        expect(cms.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blogs', overrideAccess: false, user: ACTOR.user, where: { and: [{ tenant: { equals: 1 } }, { title: { like: 'batik' } }, { status: { equals: 'draft' } }] } }))
    })

    it('searches the trash with the trash flag', async () => {
        state.posts.push(post({ id: 6, deletedAt: 'x' }))

        const res = await call('content.search_items', { kind: 'blog_post', status: 'trash' })

        expect(((await res.json()) as { items: Array<{ id: string }> }).items.map((i) => i.id)).toEqual(['6'])
        expect(cms.find).toHaveBeenCalledWith(expect.objectContaining({ trash: true }))
    })

    it('reads a post with SEO facts, and snapshots its exact version; another workspace\'s post is a 404', async () => {
        const read = await call('content.read_item', { kind: 'blog_post', id: '4' })
        const snap = await call('content.snapshot', { kind: 'blog_post', id: '4' })
        const foreign = await call('content.read_item', { kind: 'blog_post', id: '5' })

        expect(await read.json()).toMatchObject({ kind: 'blog_post', id: '4', title: 'Batik care', facts: expect.arrayContaining([{ label: 'Meta description', value: 'missing' }]) })
        expect(await snap.json()).toMatchObject({ kind: 'blog_post', id: '4', version: 't1', removed: false, fields: { seoTitle: 'Old' } })
        expect(foreign.status).toBe(404)
    })
})

describe('change kinds the blog copilot applies [TC-AIREL-141]', () => {
    const cs = (kind: string, payload: unknown) => ({ id: 'cs_1', action: { kind, payload } }) as never

    it('applies blog.create_draft, blog.update and blog.set_status; store/Product Master kinds still fail closed', async () => {
        const draft = await applyChangeSet(cs('blog.create_draft', { locale: 'en', title: 'T', slug: 't', contentHtml: '<p>x</p>' }), ACTOR)
        const edit = await applyChangeSet(cs('blog.update', { id: '4', base: 't1', changes: { title: 'New title' } }), ACTOR)
        cms.find.mockResolvedValueOnce({ docs: [post()], totalDocs: 1 }).mockResolvedValueOnce({ docs: [post({ status: 'published' })], totalDocs: 1 })
        const status = await applyChangeSet(cs('blog.set_status', { id: '4', base: { status: 'draft', removed: false }, to: 'publish' }), ACTOR)

        expect(draft.entities).toEqual([{ kind: 'blog_post', id: '31', label: 'T' }])
        expect(edit.undo?.kind).toBe('blog.restore_fields')
        expect(status.undo?.kind).toBe('blog.set_status')
        await expect(applyChangeSet(cs('product_master.update', {}), ACTOR)).rejects.toThrow(/can't be applied/)
    })

    it('undoes through the undo switch, and refuses an expired undo', async () => {
        const until = new Date(Date.now() + 60_000).toISOString()
        const restored = await applyUndo({ kind: 'blog.restore_fields', payload: { id: '4', base: 't1', data: { title: 'Old title' } }, until }, ACTOR, 'cs_1')

        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ id: 4, data: { title: 'Old title' }, overrideAccess: false }))
        expect(restored.undo?.kind).toBe('blog.restore_fields')
        await expect(applyUndo({ kind: 'blog.restore_fields', payload: {}, until: new Date(Date.now() - 1000).toISOString() }, ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
    })
})

describe('applying a blog draft [TC-AIREL-142]', () => {
    const base = { locale: 'en', title: 'Caring for batik', slug: 'caring-for-batik', seoTitle: 'Batik care', seoDescription: 'How to wash batik.' }

    it('saves a draft (never published) through the blog editor\'s save path with sanitized HTML', async () => {
        const result = await applyBlogDraft({ ...base, contentHtml: '<h2 onclick="x()">Wash</h2><p>cold <script>alert(1)</script>water</p>' }, ACTOR)

        expect(saveBlogForUser).toHaveBeenCalledWith(ACTOR.user, expect.objectContaining({ status: 'draft', slug: 'caring-for-batik', seo: { metaTitle: 'Batik care', metaDescription: 'How to wash batik.' }, content: '<h2>Wash</h2><p>cold water</p>' }))
        expect(result.links?.[0]).toEqual({ label: 'Open blog draft', href: '/blog/31' })
    })

    it('puts the cover and figure pictures in through the library rule (stock copied, a library pick reused) for this workspace', async () => {
        await applyBlogDraft(
            {
                ...base,
                contentHtml: '<p>a</p><figure data-ref="pixabay:11"><img src="x"></figure><p>b</p>',
                cover: { ref: 'media:1', name: 'Cover' },
                images: [{ ref: 'pixabay:11', url: 'https://cdn.pixabay.com/photo/11.jpg', caption: 'Folded cloth', credit: 'Pixabay · Mei' }],
            },
            ACTOR,
        )

        expect(vi.mocked(ingestPicture).mock.calls.map((c) => [c[1].ref, c[4]])).toEqual([['media:1', '1'], ['pixabay:11', '1']])
        const saved = vi.mocked(saveBlogForUser).mock.calls[0]![1]
        expect(saved.thumbnail).toBe('1')
        expect(saved.content).toContain('<img src="/api/media/file/pixabay-11.jpg" alt="Folded cloth"><p><em>Pixabay · Mei · Folded cloth</em></p>')
    })

    it('still saves the draft when a library picture is not allowed, and says how many photos were left out', async () => {
        const result = await applyBlogDraft({ ...base, contentHtml: '<p>a</p>', cover: { ref: 'media:2' } }, ACTOR)

        expect(vi.mocked(saveBlogForUser).mock.calls[0]![1]).not.toHaveProperty('thumbnail')
        expect(result.links?.[0]?.label).toBe('Open blog draft (1 photo could not be added)')
    })

    it('refuses to save into another workspace than the one the blog editor uses, writing nothing', async () => {
        const other = { ...(ACTOR as unknown as Row), tenantId: '2' } as never

        await expect(applyBlogDraft({ ...base, contentHtml: '<p>a</p>' }, other)).rejects.toMatchObject({ status: 409 })
        expect(saveBlogForUser).not.toHaveBeenCalled()
        expect(ingestPicture).not.toHaveBeenCalled()
    })

    it('reports the editor\'s refusal (plan gate) instead of success', async () => {
        vi.mocked(saveBlogForUser).mockResolvedValue({ error: 'Content management is not available on your current plan.' } as never)

        await expect(applyBlogDraft({ ...base, contentHtml: '<p>a</p>' }, ACTOR)).rejects.toThrow('Content management is not available')
    })
})

describe('editing a post [TC-AIREL-143]', () => {
    it('refuses a stale edit, writing nothing; a fresh one saves and returns the old fields as undo', async () => {
        await expect(applyBlogUpdate({ id: '4', base: 't0', changes: { title: 'X' } }, ACTOR)).rejects.toMatchObject({ status: 409 })
        expect(cms.update).not.toHaveBeenCalled()

        const result = await applyBlogUpdate({ id: '4', base: 't1', changes: { title: 'New title', seoDescription: 'Fresh' } }, ACTOR)

        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ id: 4, user: ACTOR.user, overrideAccess: false, data: { title: 'New title', seo: { metaTitle: 'Old', metaDescription: 'Fresh' } } }))
        expect(result.undo).toMatchObject({ kind: 'blog.restore_fields', payload: { id: '4', base: 't2', data: { title: 'Batik care', seo: { metaTitle: 'Old' } } } })
    })

    it('refuses another workspace\'s post, a trashed post and a rich-text body', async () => {
        await expect(applyBlogUpdate({ id: '5', base: 't1', changes: { title: 'X' } }, ACTOR)).rejects.toMatchObject({ status: 409 })
        state.posts.push(post({ id: 6, deletedAt: 'x' }))
        await expect(applyBlogUpdate({ id: '6', base: 't1', changes: { title: 'X' } }, ACTOR)).rejects.toMatchObject({ status: 409 })
        state.posts.push(post({ id: 7, content: { root: { children: [] } } }))
        await expect(applyBlogUpdate({ id: '7', base: 't1', changes: { contentHtml: '<p>x</p>' } }, ACTOR)).rejects.toMatchObject({ status: 422 })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('a new cover comes in through the library rule; one the shop may not use stops the whole change', async () => {
        const ok = await applyBlogUpdate({ id: '4', base: 't1', changes: { cover: { ref: 'media:1' } } }, ACTOR)
        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ data: { thumbnail: 1 } }))
        expect(ok.undo?.payload).toMatchObject({ data: { thumbnail: null } })
        expect(vi.mocked(ingestPicture).mock.calls[0]![4]).toBe('1')

        cms.update.mockClear()
        await expect(applyBlogUpdate({ id: '4', base: 't1', changes: { title: 'Y', cover: { ref: 'media:2' } } }, ACTOR)).rejects.toMatchObject({ status: 422 })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('new text keeps the post\'s pictures', async () => {
        state.posts[0] = post({ content: '<p>a</p><img src="/m/1.jpg" alt=""><p>b</p><p>c</p>' })

        await applyBlogUpdate({ id: '4', base: 't1', changes: { contentHtml: '<p>one</p><p>two</p><p>three</p>' } }, ACTOR)

        expect((cms.update.mock.calls[0]![0] as { data: { content: string } }).data.content).toContain('<img src="/m/1.jpg" alt="">')
    })
})

describe('publishing, unpublishing, trash [TC-AIREL-144]', () => {
    const status = (to: string, base = { status: 'draft', removed: false }) => applyBlogStatus({ id: '4', base, to }, ACTOR)

    it('publishes with a published date, and its undo is unpublish', async () => {
        cms.find.mockResolvedValueOnce({ docs: [post()], totalDocs: 1 }).mockResolvedValueOnce({ docs: [post({ status: 'published' })], totalDocs: 1 })

        const result = await status('publish')

        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'published', publishedAt: expect.any(String) }) }))
        expect(result.undo?.payload).toEqual({ id: '4', base: { status: 'published', removed: false }, to: 'unpublish' })
    })

    it('trashes with the trash flag (undo = restore), and reads back so an ignored write is never reported done', async () => {
        cms.find.mockResolvedValueOnce({ docs: [post()], totalDocs: 1 }).mockResolvedValueOnce({ docs: [post({ deletedAt: 'now' })], totalDocs: 1 })
        const result = await status('trash')
        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ trash: true, data: { deletedAt: expect.any(String) } }))
        expect(result.undo?.payload).toMatchObject({ to: 'restore', base: { removed: true } })

        // the CMS ignored deletedAt: still there
        await expect(status('trash')).rejects.toMatchObject({ status: 409, message: 'The blog trash is not available right now. Nothing was removed.' })
    })

    it('refuses when the post\'s status changed since the draft, and for a post outside the workspace', async () => {
        await expect(status('publish', { status: 'published', removed: false })).rejects.toMatchObject({ status: 409 })
        await expect(applyBlogStatus({ id: '5', base: { status: 'draft', removed: false }, to: 'publish' }, ACTOR)).rejects.toMatchObject({ status: 409 })
        expect(cms.update).not.toHaveBeenCalled()
    })
})

describe('Blogs trash and the schema [TC-AIREL-145]', () => {
    it('Blogs moves deleted posts to the trash, and the migrations add deleted_at (+ index) and media.tenant_id (+ index) without a DROP', () => {
        expect((Blogs as { trash?: boolean }).trash).toBe(true)
        const sql = (name: string) => (MIGRATIONS as Array<{ name: string; sql: string }>).find((m) => m.name === name)?.sql ?? ''
        expect(sql('blogs.deleted_at')).toMatch(/ALTER TABLE blogs ADD COLUMN IF NOT EXISTS deleted_at timestamp/)
        expect(sql('blogs.deleted_at_idx')).toMatch(/CREATE INDEX IF NOT EXISTS blogs_deleted_at_idx ON blogs\(deleted_at\)/)
        expect(sql('media.tenant_id')).toMatch(/ALTER TABLE media ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants\(id\) ON DELETE SET NULL/)
        expect(sql('media.tenant_idx')).toMatch(/CREATE INDEX IF NOT EXISTS media_tenant_idx ON media \(tenant_id\)/)
        for (const name of ['blogs.deleted_at', 'blogs.deleted_at_idx', 'media.tenant_id', 'media.tenant_idx']) expect(sql(name)).not.toMatch(/DROP/i)
    })
})

describe('blog editor strings [TC-AIREL-146]', () => {
    const dir = join(__dirname, '../../../i18n/locales')
    const editor = (lang: string) => (JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as { dashboard: { blog: { editor: Record<string, string> } } }).dashboard.blog.editor

    it('every AI string of the inline blog writer exists in en and ms, none empty', () => {
        const keys = ['aiTab', 'settingsTab', 'aiMarkTag', 'aiUndoPart', 'aiKeepPart', 'aiDraftTitle', 'aiEditTitle', 'aiPendingNote', 'aiAppliedTitle', 'aiAppliedNote', 'aiSavedTitle', 'aiSavedNote', 'aiKeepAll', 'aiDiscard', 'aiAskChanges', 'aiUndoAll', 'aiDone', 'aiPartTitle', 'aiPartContent', 'aiPartCover', 'aiPartSeo', 'aiLocked', 'aiWriting', 'aiSeoFill', 'aiSeoWriting', 'aiSeoFilled', 'aiSeoUndo', 'aiSeoFailed', 'aiSeoNeedsText', 'aiKeepFailed', 'aiStale', 'aiAskAgain', 'aiSaveFirst']
        for (const lang of ['en', 'ms']) for (const key of keys) expect(editor(lang)[key], `${lang}.${key}`).toBeTruthy()
    })

    it('has no duplicate keys in either locale file (strings were inserted as text)', () => {
        for (const lang of ['en', 'ms']) {
            const text = readFileSync(join(dir, `${lang}.json`), 'utf8')
            const block = text.slice(text.indexOf('"editor": {', text.indexOf('"blog": {')))
            const names = [...block.slice(0, block.indexOf('\n    }')).matchAll(/^ {6}"([A-Za-z0-9]+)":/gm)].map((m) => m[1])
            expect(new Set(names).size, lang).toBe(names.length)
        }
    })
})

describe('dashboard dock starters [TC-AIREL-147]', () => {
    it('blog and product pages get three starters, other pages the default two', () => {
        expect(agentStarters('blog', 'en')).toHaveLength(3)
        expect(agentStarters('products', 'en')).toHaveLength(3)
        expect(agentStarters('orders', 'ms')).toHaveLength(2)
        expect(agentStarters('blog', 'vi')[0]?.label).toMatch(/blog/i)
    })

    it('offer nothing the release cannot do: no Product Master, inventory or store-from-master starter', () => {
        const all = ['en', 'ms', 'vi'].flatMap((lang) => ['blog', 'products', 'store', 'inventory', 'dashboard'].flatMap((m) => agentStarters(m, lang)))
        for (const starter of all) expect(`${starter.label} ${starter.prompt ?? ''}`).not.toMatch(/product master|stok hari ini|run out|tồn kho|inventory/i)
    })

    it('the dock has no commerce portal routes or inbox menu, skips the blog editor (own chat) but not the categories page', () => {
        const source = readFileSync(join(__dirname, '../../../components/agent/DashboardAgentDock.tsx'), 'utf8')
        expect(source).not.toMatch(/\/commerce|PORTAL_PREFIXES|Customer inbox/)
        expect(dockShownOn('/blog/12')).toBe(false)
        expect(dockShownOn('/blog/new')).toBe(false)
        expect(dockShownOn('/blog/categories')).toBe(true)
        expect(dockShownOn('/blog')).toBe(true)
    })
})
