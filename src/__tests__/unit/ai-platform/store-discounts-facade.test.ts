/**
 * TC-AICP-151 — the discount tools through the agent-tool facade and the applier dispatch:
 * store.discounts (read) and store.prepare_discounts (draft) route to the discount code, never build the
 * commerce client, and hand the model a malformed card as data; an approved `store.discounts_patch` and its
 * undo `store.discounts_restore` reach the discount applier. Real: handle-agent-tool.ts, appliers/index.ts,
 * record-edits.ts (undo dispatch), store-discounts*.ts. Faked: the agent flag, the forwarded merchant,
 * Payload (in memory), the Discounts write core.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER } from './web-builder-fixtures'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { createDiscountAs, deleteDiscountAs } from '@/lib/discounts/discount-service'

const db = vi.hoisted(() => ({ discounts: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/auth', () => ({ tenantIdForQuery: vi.fn(() => 1) }))
vi.mock('@/lib/commerce/products-server-client', () => ({
    getProductsServerClient: vi.fn(async () => {
        throw new Error('discount tools must not build the commerce client')
    }),
}))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        find: vi.fn(async ({ collection }: { collection: string }) => ({
            docs: collection === 'discounts' ? db.discounts.map((d) => ({ ...d })) : [],
            totalDocs: collection === 'discounts' ? db.discounts.length : 0,
        })),
        count: vi.fn(async () => ({ totalDocs: 0 })),
    })),
}))
vi.mock('@/lib/discounts/discount-service', () => ({
    DiscountServiceError: class extends Error {},
    createDiscountAs: vi.fn(async (_actor: unknown, data: Record<string, unknown>) => ({ id: 77, updatedAt: 'n1', ...data })),
    updateDiscountAs: vi.fn(),
    deleteDiscountAs: vi.fn(async () => undefined),
}))

const call = (tool: string, body: unknown) => handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
const step = { op: 'create', code: 'RAYA10', type: 'percentage', amount: 10, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    db.discounts = [{ id: 1, code: 'SUMMER10', type: 'percentage', value: 10, status: 'active', usageCount: 2, usageLimit: null, updatedAt: 'u1' }]
})

describe('discount tools in the facade [TC-AICP-151]', () => {
    it('reads the shop\'s codes for the calling merchant without the commerce client', async () => {
        const res = await call('store.discounts', { filter: 'all', limit: 5 })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ counts: { total: 1, active: 1 }, discounts: [{ id: '1', code: 'SUMMER10' }] })
    })

    it('drafts a card, and answers a malformed one as data the model can fix', async () => {
        const ok = await call('store.prepare_discounts', { why: 'Raya', changes: [step] })
        const bad = await call('store.prepare_discounts', { why: 'Raya', changes: [{ op: 'create', code: 'X' }] })
        const taken = await call('store.prepare_discounts', { why: 'Raya', changes: [{ ...step, code: 'summer10' }] })

        expect(await ok.json()).toMatchObject({ kind: 'store.discounts_patch', title: 'New discount: RAYA10' })
        expect(bad.status).toBe(200)
        expect(await bad.json()).toMatchObject({ error: { code: 'invalid_input' } })
        expect(await taken.json()).toMatchObject({ error: { code: 'code_taken' } })
    })

    it('answers 404 while the AI assistant is off', async () => {
        vi.mocked(isAiAgentEnabled).mockReturnValue(false)

        expect((await call('store.discounts', {})).status).toBe(404)
    })
})

describe('discount change dispatch [TC-AICP-151]', () => {
    it('applies an approved store.discounts_patch and hands back the undo', async () => {
        const plan = { steps: [{ op: 'create', data: { code: 'RAYA10', description: null, type: 'percentage', value: 10, status: 'inactive', usageLimit: null, startsAt: null, expiresAt: null, site: null } }], base: {} }

        const result = await applyChangeSet({ id: 'cs_1', action: { kind: 'store.discounts_patch', payload: plan } } as never, OWNER)

        expect(createDiscountAs).toHaveBeenCalledWith(expect.objectContaining({ strictTenant: true }), expect.objectContaining({ code: 'RAYA10' }))
        expect(result.undo).toMatchObject({ kind: 'store.discounts_restore', payload: { ops: [{ op: 'created', id: 77 }] } })
    })

    it('runs store.discounts_restore as an undo', async () => {
        db.discounts = [{ id: 77, code: 'RAYA10', type: 'percentage', value: 10, status: 'inactive', usageCount: 0, updatedAt: 'n1' }]

        await applyUndo({ kind: 'store.discounts_restore', payload: { ops: [{ op: 'created', id: 77, updatedAt: 'n1' }] }, until: new Date(Date.now() + 60_000).toISOString() }, OWNER, 'cs_1')

        expect(deleteDiscountAs).toHaveBeenCalledWith(expect.objectContaining({ strictTenant: true }), 77)
    })
})
