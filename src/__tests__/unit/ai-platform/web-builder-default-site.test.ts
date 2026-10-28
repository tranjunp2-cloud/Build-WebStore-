/**
 * TC-AICP-273 — a website tool called away from the site editor (dashboard dock, campaign) says siteId "auto": the
 * facade uses the workspace's only usable website; with 0 or several websites it refuses as data the model can act on
 * (no site yet / which one?). A real id is never replaced; other tools are untouched.
 * Real: handle-agent-tool.ts routing, site-default.ts, site read, the site access check. Faked: the agent flag, the
 * forwarded merchant, Payload (sites of the workspace, one page list).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER, PAGE_ID, SITE_ID, site } from './web-builder-fixtures'
import { withDefaultSite } from '@/lib/ai-platform/site/site-default'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'

const db = vi.hoisted(() => ({ sites: [] as Array<Record<string, unknown>>, findWhere: [] as unknown[] }))

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) =>
            collection === 'sites' ? (db.sites.find((s) => String(s.id) === String(id)) ?? null) : null,
        ),
        find: vi.fn(async ({ collection, where }: { collection: string; where?: unknown }) => {
            if (collection === 'sites') {
                db.findWhere.push(where)
                return { docs: db.sites, totalDocs: db.sites.length }
            }
            return { docs: [{ id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, _status: 'draft' }], totalDocs: 1 }
        }),
    })),
}))

function call(tool: string, body: unknown) {
    return handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
}

beforeEach(() => {
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    db.sites = [site()]
    db.findWhere = []
})

describe('siteId "auto" [TC-AICP-273]', () => {
    it('uses the workspace\'s only website and looks only in this workspace', async () => {
        const res = await call('site.read', { view: 'pages', siteId: 'auto' })

        const body = await res.json()
        expect(body.error).toBeUndefined()
        expect(body.site).toEqual({ id: String(SITE_ID), name: 'Kedai Batik' })
        expect(body.pages).toHaveLength(1)
        expect(db.findWhere[0]).toEqual({ tenant: { equals: OWNER.tenantId } })
    })

    it('reads a missing siteId the same way', async () => {
        const body = await (await call('site.read', { view: 'pages' })).json()

        expect(body.site).toMatchObject({ id: String(SITE_ID) })
    })

    it('ignores a site still being generated and picks the usable one', async () => {
        db.sites = [site({ id: 9, name: 'Draft AI', generationStatus: 'generating' }), site()]

        const body = await (await call('site.read', { view: 'pages', siteId: 'auto' })).json()

        expect(body.site).toMatchObject({ id: String(SITE_ID) })
    })

    it('says there is no website when the workspace has none usable', async () => {
        db.sites = [site({ generationStatus: 'failed' })]

        const body = await (await call('site.read', { view: 'pages', siteId: 'auto' })).json()

        expect(body.error.code).toBe('site_404')
        expect(body.error.message).toMatch(/no website/i)
    })

    it('lists the websites when there are several, so the model can ask which one', async () => {
        db.sites = [site(), site({ id: 6, name: 'Kedai Kopi' })]

        const body = await (await call('site.read', { view: 'pages', siteId: 'auto' })).json()

        expect(body.error.code).toBe('site_409')
        expect(body.error.message).toContain('Kedai Batik (siteId 5)')
        expect(body.error.message).toContain('Kedai Kopi (siteId 6)')
    })

    it('leaves a real id alone, even when the workspace has several sites', async () => {
        db.sites = [site(), site({ id: 6, name: 'Kedai Kopi' })]

        const body = await (await call('site.read', { view: 'pages', siteId: '6' })).json()

        expect(body.site).toEqual({ id: '6', name: 'Kedai Kopi' })
        expect(db.findWhere).toHaveLength(0)
    })

    it('does not touch tools that are not website tools', async () => {
        const body = { filter: 'all', siteId: 'auto' }

        expect(await withDefaultSite(OWNER, 'store.discounts', body)).toBe(body)
        expect(db.findWhere).toHaveLength(0)
    })
})
