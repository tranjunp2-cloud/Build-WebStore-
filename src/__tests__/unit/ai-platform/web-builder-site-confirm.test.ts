/**
 * TC-AIWB-36 — the typed site name that a site change needs before it is applied: decided by prime-web from the
 * change and the site as prime-web reads it (requiredConfirmation), and checked again by the approval route
 * (agent-proxy decide()). Publish and theme edits always need it; a multi-page edit needs it above 3 pages.
 * Real: appliers/site-confirm.ts, site-read.ts (site access), site-access.ts, agent-proxy.ts (decide), the
 * change-set schema of @ech/agent-core.
 * Faked: Payload Local API (the site row), the agent context and the platform calls (aiPlatformJson), the apply
 * step of the approval (applyChangeSet), the agent flag and the forwarded merchant.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { requiredConfirmation } from '@/lib/ai-platform/appliers/site-confirm'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { resolveAgentActor } from '@/lib/ai-platform/context'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { aiPlatformJson } from '@/lib/ai-platform/upstream'
import { OWNER, SITE_ID, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({ site: null as Record<string, unknown> | null }))

vi.mock('@/lib/ai-platform/apply-receipts', () => import('./apply-receipts-off'))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        // the site row by id, as the database answers it (a missing id finds nothing)
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) =>
            collection === 'sites' && state.site && String(id) === String((state.site as { id?: unknown }).id) ? state.site : null,
        ),
    })),
}))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async () => OWNER),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    callAiPlatform: vi.fn(),
    aiPlatformJson: vi.fn(),
}))
vi.mock('@/lib/ai-platform/appliers', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai-platform/appliers')>('@/lib/ai-platform/appliers')
    return { ...actual, applyChangeSet: vi.fn() }
})

type Action = { kind: string; payload: Record<string, unknown> }
const changeSetWith = (action: Action) => ({
    id: 'cs_1',
    runId: 'run_1',
    domain: 'cms',
    title: 'Site change',
    summary: '',
    risk: 'high',
    blastRadius: { kind: 'site', count: 1, label: '1 site' },
    diffs: [{ entity: { kind: 'site', id: String(SITE_ID) }, field: 'x', before: null, after: 'y', provenance: 'generated' }],
    guardrails: [],
    status: 'pending',
    stagedBy: 'agent',
    stagedAt: '2026-10-20T00:00:00Z',
    expiresAt: '2026-10-21T00:00:00Z',
    action,
}) as never

const SITE_NAME = 'Kedai Batik'
const pagesPatch = (count: number) => ({ siteId: String(SITE_ID), pages: Array.from({ length: count }, (_, i) => ({ pageId: String(10 + i), ops: [] })) })

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveAgentActor).mockResolvedValue(OWNER)
    vi.mocked(aiPlatformJson).mockReset()
    state.site = site()
})

// ─── requiredConfirmation: per kind ────────────────────────────────────────

describe('requiredConfirmation — the typed site name per kind [TC-AIWB-36]', () => {
    it('asks for the site name to publish (it goes live at once)', async () => {
        expect(await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID), pages: {}, frame: '' } }), OWNER)).toBe(SITE_NAME)
    })

    it('asks for the site name to change the theme (it goes live at once)', async () => {
        expect(await requiredConfirmation(changeSetWith({ kind: 'site.theme_patch', payload: { siteId: String(SITE_ID), changes: { primaryColor: '#f97316' } } }), OWNER)).toBe(SITE_NAME)
    })

    it('asks for the site name when a multi-page edit touches more than three pages', async () => {
        expect(await requiredConfirmation(changeSetWith({ kind: 'site.pages_patch', payload: pagesPatch(4) }), OWNER)).toBe(SITE_NAME)
    })

    it.each([[2], [3]])('does not ask when a multi-page edit touches %i pages', async (count) => {
        expect(await requiredConfirmation(changeSetWith({ kind: 'site.pages_patch', payload: pagesPatch(count) }), OWNER)).toBeNull()
    })

    it('does not ask when the multi-page edit has no page list', async () => {
        expect(await requiredConfirmation(changeSetWith({ kind: 'site.pages_patch', payload: { siteId: String(SITE_ID), pages: 'many' } }), OWNER)).toBeNull()
    })

    it.each([
        ['site.page_patch'],
        ['site.seo_patch'],
        ['site.translate_page'],
        ['site.nav_patch'],
        ['site.page_create'],
        ['site.page_restore'],
        ['site.pages_restore'],
        ['site.nav_restore'],
        ['site.theme_restore'],
        ['blog.set_status'],
    ])('does not ask for %s', async (kind) => {
        expect(await requiredConfirmation(changeSetWith({ kind, payload: { siteId: String(SITE_ID) } }), OWNER)).toBeNull()
    })

    it('takes the name from the site as prime-web reads it, not from what the change says', async () => {
        const spoofed = changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID), siteName: 'Nothing to see' } })

        expect(await requiredConfirmation(spoofed, OWNER)).toBe(SITE_NAME)
    })

    it('cuts a very long site name to 200 characters', async () => {
        state.site = site({ name: 'x'.repeat(250) })

        expect(await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID) } }), OWNER)).toHaveLength(200)
    })

    it('answers the name "site" when the site has no name', async () => {
        state.site = site({ name: undefined })

        expect(await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID) } }), OWNER)).toBe('site')
    })

    it('a site with an empty name still asks for a typed name ("site", as the card does)', async () => {
        // input: a publish of a site whose name is ''. Observed: requiredConfirmation returns '' (falsy), so no name is
        // asked and the publish applies without any typed confirmation. Expected: a non-empty name is required.
        state.site = site({ name: '' })

        const required = await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID) } }), OWNER)

        expect(required).toBeTruthy()
    })

    it('refuses a change to a site that is not there (409, the site is not found)', async () => {
        const failure = await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: {} }), OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 409, message: 'No such site in this workspace.' })
    })

    it('refuses a change to a site of another workspace (403)', async () => {
        state.site = site({ tenant: { id: 2 } })

        const failure = await requiredConfirmation(changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID) } }), OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 403, message: 'This site belongs to another workspace.' })
    })
})

// ─── decide(): the approval route asks for the name before applying ─────────

describe('agent-proxy decide() — a publish waits for the typed site name [TC-AIWB-36]', () => {
    const request = (body: unknown) =>
        new NextRequest('http://localhost:3000/api/agent/change-sets/cs_1/decision', {
            method: 'POST',
            headers: { host: 'localhost:3000', 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
    const publish = changeSetWith({ kind: 'site.publish', payload: { siteId: String(SITE_ID), pages: {}, frame: '' } })

    it('answers 400 with the name to type and releases the claim, when no name was typed', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(publish) // staged read
            .mockResolvedValueOnce(publish) // claim
            .mockResolvedValueOnce({ released: true }) // release

        const res = await handleAgentProxy(request({ decision: 'approve' }), ['change-sets', 'cs_1', 'decision'])

        expect(res.status).toBe(400)
        expect((await res.json()).detail).toBe(`Type “${SITE_NAME}” to confirm.`)
        expect(vi.mocked(aiPlatformJson).mock.calls.map((c) => c[0].path)).toEqual([
            '/agent/change-sets/cs_1',
            '/agent/change-sets/cs_1/claim',
            '/agent/change-sets/cs_1/release',
        ])
        expect(applyChangeSet).not.toHaveBeenCalled()
    })

    it('applies the publish when the name is typed (case and spaces ignored)', async () => {
        vi.mocked(aiPlatformJson)
            .mockResolvedValueOnce(publish)
            .mockResolvedValueOnce(publish)
            .mockResolvedValueOnce({ ...publish, status: 'applied' })
        vi.mocked(applyChangeSet).mockResolvedValue({ entities: [{ kind: 'site', id: String(SITE_ID) }], links: [] })

        const res = await handleAgentProxy(request({ decision: 'approve', confirm: '  kedai   BATIK ' }), ['change-sets', 'cs_1', 'decision'])

        expect(res.status).toBe(200)
        expect(applyChangeSet).toHaveBeenCalledTimes(1)
    })
})
