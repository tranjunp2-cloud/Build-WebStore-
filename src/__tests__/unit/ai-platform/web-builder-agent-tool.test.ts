/**
 * TC-AIWB-01 — the facade's site.* tools: the flag, the workspace of the calling merchant, and the
 * refusals the model sees as data (SiteToolError → 200 with {error:{code:"site_<status>"}}).
 * Real: handle-agent-tool.ts routing, site read/prepare, the site access check. Faked: the agent flag,
 * the forwarded merchant (tool-actor), the commerce client (not used by site tools), Payload.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'

const db = vi.hoisted(() => ({
    sites: {} as Record<string, unknown>,
    pages: {} as Record<string, unknown>,
}))

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) =>
            collection === 'sites' ? (db.sites[String(id)] ?? null) : (db.pages[String(id)] ?? null),
        ),
        find: vi.fn(async ({ collection }: { collection: string }) => ({
            docs: collection === 'pages' ? [{ id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, _status: 'draft' }] : [],
            totalDocs: 1,
        })),
    })),
}))

function call(tool: string, body: unknown) {
    return handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
}

beforeEach(() => {
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    db.sites = { [String(SITE_ID)]: site() }
    db.pages = { [String(PAGE_ID)]: page(structuredClone(LAYOUT)) }
})

describe('site.* facade tools [TC-AIWB-01]', () => {
    it('answers 404 and does not resolve the merchant while the AI assistant is off', async () => {
        vi.mocked(isAiAgentEnabled).mockReturnValue(false)

        const res = await call('site.read', { view: 'pages', siteId: String(SITE_ID) })

        expect(res.status).toBe(404)
        expect(await res.json()).toMatchObject({ status: 404, detail: 'The AI assistant is not enabled.' })
        expect(resolveToolActor).not.toHaveBeenCalled()
    })

    it("answers site_403 for a site in another workspace, as data the model can act on", async () => {
        db.sites[String(SITE_ID)] = site({ tenant: { id: 2 } })

        const res = await call('site.read', { view: 'pages', siteId: String(SITE_ID) })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ error: { code: 'site_403', message: 'This site belongs to another workspace.' } })
    })

    it("answers site_403 when the site's workspace is not the one the call acts for", async () => {
        // the merchant is an active member of workspace 2 as well, but this call acts for workspace 1
        vi.mocked(resolveToolActor).mockResolvedValue({ ...OWNER, tenantId: '2' })
        db.sites[String(SITE_ID)] = site({ tenant: { id: 1 } })

        const res = await call('site.read', { view: 'pages', siteId: String(SITE_ID) })

        expect(await res.json()).toMatchObject({ error: { code: 'site_403' } })
    })

    it('answers site_404 for an unknown site', async () => {
        const res = await call('site.read', { view: 'pages', siteId: '999' })

        expect(await res.json()).toEqual({ error: { code: 'site_404', message: 'No such site in this workspace.' } })
    })

    it('returns the page sections for a site in the merchant workspace', async () => {
        const res = await call('site.read', { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })

        expect(res.status).toBe(200)
        const body = (await res.json()) as { blocks: Array<{ id: string }> }
        expect(body.blocks.map((b) => b.id)).toEqual([NAV.id, HERO.id, FAQ.id, PRODUCTS.id, FOOTER.id])
    })

    it('returns a refused page edit as data (not an HTTP error) so the model can fix it', async () => {
        const res = await call('site.prepare_patch', {
            siteId: String(SITE_ID),
            pageId: String(PAGE_ID),
            why: 'Shorter hero',
            ops: [{ op: 'set_fields', blockId: 'missing-section', fields: { headline: 'x' } }],
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ error: { code: 'unknown_section' } })
    })

    it('returns invalid tool input to the model as data it can fix', async () => {
        const res = await call('site.read', { view: 'nope', siteId: String(SITE_ID) })

        expect(res.status).toBe(200)
        expect((await res.json()).error).toMatchObject({ code: 'invalid_input' })
    })
})
