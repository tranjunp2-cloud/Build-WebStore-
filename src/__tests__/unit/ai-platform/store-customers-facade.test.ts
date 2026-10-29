/**
 * TC-AICP-213 — the customer tools through the agent-tool facade and the applier dispatch: store.customers (read)
 * and store.prepare_customers (draft) route to the customer code for the calling merchant, never build the
 * commerce client, and hand the model a malformed or refused card as data; an approved `store.customers_patch`
 * and its undo `store.customers_restore` reach the customer applier (a sent email is not part of the undo).
 * Real: handle-agent-tool.ts, appliers/index.ts, record-edits.ts, store-customers*.ts, the services.
 * Faked: the agent flag, the forwarded merchant, Payload (in memory), the mail transport, the plan lookup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Db, makeCms, newDb } from './customers-fake-cms'
import { OWNER } from './web-builder-fixtures'

const h = vi.hoisted(() => ({ db: null as unknown as Db, cms: null as unknown }))

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/commerce/products-server-client', () => ({
    getProductsServerClient: vi.fn(async () => {
        throw new Error('customer tools must not build the commerce client')
    }),
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({ getActivePlanSubscription: vi.fn(async () => ({ plan: 'professional' })), canUse: vi.fn(async () => true) }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => true) }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1, resetAt: 0 })) }))

import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { sendEmail } from '@/lib/email/send'

const call = (tool: string, body: unknown) => handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
const customerStep = { op: 'customer_update', customerId: '12', name: null, rank: 'vip', removeRank: false, notes: null }
const replyStep = { op: 'lead_reply', leadId: '1', subject: 'Terima kasih', body: 'Hai Ahmad' }
const until = () => new Date(Date.now() + 60_000).toISOString()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    h.db = newDb()
    h.cms = makeCms(h.db)
    h.db.sites.push({ id: 5, tenant: 1, name: 'Kedai Batik', contactInfo: { email: 'hello@kedaibatik.my' } })
    h.db.customers.push({ id: 12, tenant: 1, name: 'Aisyah', email: 'aisyah@x.my', rank: 'silver', notes: null, updatedAt: 'c12' })
    h.db['contact-submissions'].push({ id: 1, name: 'Ahmad', email: 'ahmad@x.my', message: 'Ship to Sabah?', site: 5, status: 'new', createdAt: '2026-10-10T00:00:00Z', updatedAt: 'l1', replies: [] })
})

describe('customer tools in the facade [TC-AICP-213]', () => {
    it('reads customers, leads and templates for the calling merchant without the commerce client', async () => {
        h.db.sqlRows = [{ id: 12, name: 'Aisyah', rank: 'silver', order_count: 0, lifetime: '0', completed_count: 0, cancelled_count: 0 }]

        const customers = await (await call('store.customers', { view: 'customers', limit: 5 })).json()
        const leads = await (await call('store.customers', { view: 'leads', limit: 5 })).json()
        const templates = await (await call('store.customers', { view: 'email_templates' })).json()

        expect(customers.customers).toMatchObject([{ id: '12', name: 'Aisyah' }])
        expect(leads.leads).toMatchObject([{ id: '1', name: 'Ahmad', status: 'new' }])
        expect(templates.templates).toHaveLength(12)
    })

    it('drafts a card, and answers a malformed or refused one as data the model can fix', async () => {
        const ok = await call('store.prepare_customers', { why: 'loyal', changes: [customerStep] })
        const bad = await call('store.prepare_customers', { why: 'loyal', changes: [{ op: 'customer_update', customerId: 'abc' }] })
        const unknown = await call('store.prepare_customers', { why: 'loyal', changes: [{ ...customerStep, customerId: '404' }] })
        const reply = await call('store.prepare_customers', { why: 'thank', changes: [replyStep] })

        expect(await ok.json()).toMatchObject({ kind: 'store.customers_patch', title: 'Customer: Aisyah' })
        expect(bad.status).toBe(200)
        expect(await bad.json()).toMatchObject({ error: { code: 'invalid_input' } })
        expect(await unknown.json()).toMatchObject({ error: { code: 'unknown_customer' } })
        expect(await reply.json()).toMatchObject({ kind: 'store.customers_patch', risk: 'high', confirmText: 'ahmad@x.my' })
        // drafting sends nothing and writes nothing
        expect(sendEmail).not.toHaveBeenCalled()
        expect(h.db.writes).toHaveLength(0)
    })

    it('answers 404 while the AI assistant is off', async () => {
        vi.mocked(isAiAgentEnabled).mockReturnValue(false)

        expect((await call('store.customers', {})).status).toBe(404)
        expect((await call('store.prepare_customers', {})).status).toBe(404)
    })
})

describe('customer change dispatch [TC-AICP-213]', () => {
    it('applies an approved store.customers_patch and hands back the undo', async () => {
        const draft = (await (await call('store.prepare_customers', { why: 'loyal', changes: [customerStep] })).json()) as { plan: unknown }

        const result = await applyChangeSet({ id: 'cs_1', action: { kind: 'store.customers_patch', payload: draft.plan } } as never, OWNER)

        expect(h.db.customers[0]).toMatchObject({ rank: 'vip' })
        expect(result.undo).toMatchObject({ kind: 'store.customers_restore', payload: { ops: [{ op: 'customer', id: 12, before: { rank: 'silver' } }] } })
    })

    it('runs store.customers_restore as an undo, and refuses an undo past its 7 days', async () => {
        const draft = (await (await call('store.prepare_customers', { why: 'loyal', changes: [customerStep] })).json()) as { plan: unknown }
        const { undo } = await applyChangeSet({ id: 'cs_1', action: { kind: 'store.customers_patch', payload: draft.plan } } as never, OWNER)

        await expect(applyUndo({ ...undo!, until: new Date(Date.now() - 1000).toISOString() }, OWNER, 'cs_1')).rejects.toMatchObject({ status: 409 })
        expect(h.db.customers[0]).toMatchObject({ rank: 'vip' })
        await applyUndo({ ...undo!, until: until() }, OWNER, 'cs_1')

        expect(h.db.customers[0]).toMatchObject({ rank: 'silver' })
    })

    it('sends the approved reply once, and its undo does not send or recall anything', async () => {
        const draft = (await (await call('store.prepare_customers', { why: 'thank', changes: [replyStep] })).json()) as { plan: unknown }

        const { undo } = await applyChangeSet({ id: 'cs_2', action: { kind: 'store.customers_patch', payload: draft.plan } } as never, OWNER)
        await applyUndo({ ...undo!, until: until() }, OWNER, 'cs_2')

        expect(sendEmail).toHaveBeenCalledTimes(1)
        expect(h.db['contact-submissions'][0]).toMatchObject({ status: 'new' })
        expect(h.db['contact-submissions'][0]!.replies).toHaveLength(1)
    })
})
