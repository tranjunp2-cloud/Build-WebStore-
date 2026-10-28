/**
 * TC-AICP-207..210 — applying an approved customer card (`store.customers_patch`) and undoing it
 * (`store.customers_restore`), on drafts made by the real prepare step:
 *   207  customer + lead-status steps: the pages' write cores as the approver, the version check (409), the
 *        approver's role, a plan the platform did not draft refused
 *   208  the reply: sent LAST with the shop's reply-to, recorded on the lead, rate limit, a refused mail puts
 *        everything back and sends nothing, a changed lead is not emailed, a failed record never re-sends
 *   209  email templates: saved through the template service (plan gate), reset deletes the row, edited since → 409
 *   210  undo: customer / lead status / template pre-images, chained steps, refused once edited since, and a
 *        sent email stays sent (undo only puts the lead's status back)
 * Real: appliers/store-customers.ts, store-customers-prepare.ts, customer-service, lead-service, lead-reply,
 * template-settings-service. Faked: Payload (in memory), the mail transport (`sendEmail`), the rate limiter, the plan lookup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Db, makeCms, newDb } from './customers-fake-cms'

const h = vi.hoisted(() => ({
    db: null as unknown as Db,
    cms: null as unknown,
    plan: { allowed: true },
    mail: { ok: true, calls: [] as Array<{ to: string; subject: string; html: string; replyTo?: string; writesBefore: number }> },
    limit: { allowed: true },
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'professional' })),
    canUse: vi.fn(async () => h.plan.allowed),
}))
vi.mock('@/lib/email/send', () => ({
    sendEmail: vi.fn(async (m: { to: string; subject: string; html: string; replyTo?: string }) => {
        h.mail.calls.push({ ...m, writesBefore: h.db.writes.length })
        return h.mail.ok
    }),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: h.limit.allowed, remaining: 0, resetAt: 0 })) }))

import { applyStoreCustomersPatch, applyStoreCustomersRestore } from '@/lib/ai-platform/appliers/store-customers'
import { prepareStoreCustomers } from '@/lib/ai-platform/store/store-customers-prepare'
import { checkRateLimit } from '@/lib/rateLimit'

const owner = (role = 'owner', permissions: string[] = []) => ({ user: { id: 7, email: 'owner@kedai.my', tenants: [{ tenant: { id: 1 }, status: 'active', role, permissions }] }, tenantId: '1', organizationId: 'org_1', role }) as never
const actor = owner()
const draft = async (changes: unknown[]) => {
    const p = (await prepareStoreCustomers(actor, { why: 'asked', changes })) as any
    if (p.error) throw new Error(`draft refused: ${p.error.message}`)
    return p.plan as Record<string, unknown>
}
const apply = (plan: unknown, who = actor) => applyStoreCustomersPatch(plan, who)
const undoOf = (result: { undo?: { kind: string; payload: Record<string, unknown>; until: string } }) => result.undo!
const customer = (id: number) => h.db.customers.find((c) => c.id === id)!
const lead = (id: number) => h.db['contact-submissions'].find((c) => c.id === id)!

const customerStep = (over: Record<string, unknown> = {}) => ({ op: 'customer_update', customerId: '12', name: null, rank: null, removeRank: false, notes: null, ...over })
const statusStep = (over: Record<string, unknown> = {}) => ({ op: 'lead_status', leadId: '1', status: 'contacted', ...over })
const replyStep = (over: Record<string, unknown> = {}) => ({ op: 'lead_reply', leadId: '2', subject: 'Terima kasih', body: 'Hai Ahmad,\n\nKami akan hubungi anda dalam 24 jam.\n\nKedai Batik', ...over })
const tplStep = (over: Record<string, unknown> = {}) => ({ op: 'template_edit', templateType: 'order-confirmation', locale: 'en', subject: null, greeting: null, ctaLabel: null, closing: null, enabled: null, ...over })

beforeEach(() => {
    vi.clearAllMocks()
    h.plan.allowed = true
    h.mail.ok = true
    h.mail.calls = []
    h.limit.allowed = true
    h.db = newDb()
    h.cms = makeCms(h.db)
    h.db.sites.push({ id: 5, tenant: 1, name: 'Kedai Batik', contactInfo: { email: 'hello@kedaibatik.my' } }, { id: 6, tenant: 2, name: 'Other shop' })
    h.db.customers.push(
        { id: 12, tenant: 1, name: 'Aisyah', email: 'aisyah@x.my', rank: 'silver', notes: 'Likes batik', updatedAt: 'c12' },
        { id: 99, tenant: 2, name: 'Foreign', rank: 'vip', updatedAt: 'c99' },
    )
    h.db['contact-submissions'].push(
        { id: 1, name: 'Ahmad', email: 'ahmad@x.my', message: 'Ship to Sabah?', site: 5, status: 'new', createdAt: '2026-10-10T00:00:00Z', updatedAt: 'l1', replies: [] },
        { id: 2, name: 'Ahmad', email: 'ahmad@x.my', message: 'Hello?', site: 5, status: 'read', createdAt: '2026-10-20T00:00:00Z', updatedAt: 'l2', replies: [] },
        { id: 3, name: 'Siti', email: 'siti@x.my', message: 'Price?', site: 5, status: 'new', createdAt: '2026-10-21T00:00:00Z', updatedAt: 'l3', replies: [] },
        { id: 4, name: 'Intruder', email: 'i@x.my', message: 'other shop', site: 6, status: 'new', createdAt: '2026-10-21T00:00:00Z', updatedAt: 'l4', replies: [] },
    )
})

describe('apply customers and lead status [TC-AICP-207]', () => {
    it('writes the customer with the customers page\'s core as the approver, and keeps the pre-image for undo', async () => {
        const result = await apply(await draft([customerStep({ rank: 'vip', notes: 'Wants invoices' })]))

        expect(customer(12)).toMatchObject({ rank: 'vip', notes: 'Wants invoices', name: 'Aisyah' })
        expect(h.db.writes).toEqual([{ op: 'update', collection: 'customers', id: 12, data: { rank: 'vip', notes: 'Wants invoices' } }])
        expect(result.entities).toEqual([{ kind: 'store_customer', id: '12' }])
        expect(result.links).toEqual([{ label: 'Open customer', href: '/customers/12' }])
        expect(undoOf(result)).toMatchObject({ kind: 'store.customers_restore', payload: { ops: [{ op: 'customer', id: 12, updatedAt: customer(12).updatedAt, before: { name: 'Aisyah', rank: 'silver', notes: 'Likes batik' } }] } })
        expect(new Date(undoOf(result).until).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)
    })

    it('sets the status of every message of that person on that site — and of nobody else', async () => {
        const result = await apply(await draft([statusStep()]))

        expect([1, 2, 3, 4].map((id) => lead(id).status)).toEqual(['replied', 'replied', 'new', 'new'])
        expect(undoOf(result).payload.ops).toEqual([{ op: 'lead_status', items: [{ id: 1, before: 'new', updatedAt: lead(1).updatedAt }, { id: 2, before: 'read', updatedAt: lead(2).updatedAt }] }])
    })

    it('refuses when the customer was edited after the draft, and writes nothing', async () => {
        const plan = await draft([customerStep({ rank: 'vip' })])
        customer(12).updatedAt = 'someone-else'

        await expect(apply(plan)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('changed after the assistant drafted this') })
        expect(h.db.writes).toHaveLength(0)
    })

    it('refuses when a lead was touched after the draft (also by opening it in the dashboard)', async () => {
        const plan = await draft([statusStep({ leadId: '3', status: 'ignored' })])
        lead(3).updatedAt = 'opened-in-panel'

        await expect(apply(plan)).rejects.toMatchObject({ status: 409 })
        expect(lead(3).status).toBe('new')
    })

    it('does not touch another workspace\'s customer or lead even from a doctored plan', async () => {
        const doctored = (base: Record<string, string>, steps: unknown[]) => ({ steps, base })

        await expect(apply(doctored({ 'customer:99': 'c99' }, [{ op: 'customer', customerId: 99, data: { rank: 'bronze' } }]))).rejects.toMatchObject({ status: 409 })
        await expect(apply(doctored({ 'lead:4': 'l4' }, [{ op: 'lead_status', leadId: 4, status: 'archived' }]))).rejects.toMatchObject({ status: 409 })
        expect(h.db.writes).toHaveLength(0)
        expect(customer(99).rank).toBe('vip')
    })

    it('needs the approver\'s role to have the area, and refuses a plan the platform did not draft', async () => {
        const plan = await draft([customerStep({ rank: 'vip' })])

        await expect(apply(plan, owner('custom', ['products']))).rejects.toMatchObject({ status: 403 })
        await expect(apply({ steps: [{ op: 'customer', customerId: 12, data: { rank: 'platinum' } }], base: {} })).rejects.toThrow()
        await expect(apply({ steps: [], base: {} })).rejects.toThrow()
        expect(h.db.writes).toHaveLength(0)
    })

    it('refuses a viewer approving an email reply or template wording, also at apply time [TC-AICP-257]', async () => {
        const reply = await draft([replyStep()])
        const wording = await draft([tplStep({ greeting: 'Hello {customerName}, thank you!' })])
        const viewer = owner('viewer')

        await expect(apply(reply, viewer)).rejects.toMatchObject({ status: 403, message: expect.stringContaining("can't reply to contact leads") })
        await expect(apply(wording, viewer)).rejects.toMatchObject({ status: 403, message: expect.stringContaining("can't edit email templates") })
        expect(h.mail.calls).toEqual([])
        expect(h.db.writes).toHaveLength(0)
        // an editor may
        await apply(reply, owner('editor'))
        expect(h.mail.calls).toHaveLength(1)
    })

    it('puts back what already ran when a later step is refused', async () => {
        const plan = await draft([customerStep({ rank: 'vip' }), statusStep({ leadId: '3', status: 'ignored' })])
        h.db.failUpdate = (collection) => (collection === 'contact-submissions' ? new Error('db down') : undefined)

        await expect(apply(plan)).rejects.toMatchObject({ status: 422 })
        expect(customer(12).rank).toBe('silver')
        expect(lead(3).status).toBe('new')
    })
})

describe('apply the reply [TC-AICP-208]', () => {
    it('sends the email last, from the shop\'s name, with the shop\'s contact as reply-to, then records it and marks the lead contacted', async () => {
        const result = await apply(await draft([replyStep(), customerStep({ rank: 'gold' })]))

        expect(h.mail.calls).toHaveLength(1)
        const mail = h.mail.calls[0]!
        // the customer write (1 write) was done before the email went out
        expect(mail.writesBefore).toBe(1)
        expect(mail).toMatchObject({ to: 'ahmad@x.my', subject: 'Terima kasih', replyTo: 'hello@kedaibatik.my' })
        expect(mail.html).toContain('Kedai Batik')
        expect(mail.html).toContain('Kami akan hubungi anda dalam 24 jam.')
        const stored = lead(2).replies as Array<Record<string, unknown>>
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ subject: 'Terima kasih', body: expect.stringContaining('Kami akan hubungi'), sentBy: 'owner@kedai.my' })
        expect(new Date(String(stored[0]!.sentAt)).getTime()).toBeGreaterThan(Date.now() - 10_000)
        expect([lead(1).status, lead(2).status]).toEqual(['replied', 'replied'])
        expect(result.entities).toContainEqual({ kind: 'lead_reply', id: '2' })
        expect(result.links).toContainEqual({ label: 'Open contact leads', href: '/contact-leads' })
        expect(checkRateLimit).toHaveBeenCalledWith('lead-reply:1', 20, 3_600_000)
    })

    it('escapes what the merchant approved, keeps paragraphs and line breaks, and cannot carry a second header', async () => {
        await apply(await draft([replyStep({ subject: 'Hi\r\nBcc: spam@x.my', body: 'Line one\nLine two <script>alert(1)</script>\n\nSecond & last' })]))

        const mail = h.mail.calls[0]!
        expect(mail.subject).toBe('Hi Bcc: spam@x.my')
        expect(mail.html).not.toContain('<script>')
        expect(mail.html).toContain('Line one<br>Line two &lt;script&gt;alert(1)&lt;/script&gt;')
        expect(mail.html).toContain('Second &amp; last')
    })

    it('uses the approver\'s own address as reply-to when the shop has no contact email', async () => {
        delete (h.db.sites[0] as Record<string, unknown>).contactInfo

        await apply(await draft([replyStep()]))

        expect(h.mail.calls[0]!.replyTo).toBe('owner@kedai.my')
    })

    it('sends nothing and changes nothing once 20 replies went out this hour (the other steps are put back)', async () => {
        const plan = await draft([customerStep({ rank: 'gold' }), replyStep()])
        h.limit.allowed = false

        await expect(apply(plan)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('20 replies in the last hour') })
        expect(h.mail.calls).toHaveLength(0)
        expect(customer(12).rank).toBe('silver')
        expect(lead(2).replies).toEqual([])
        expect(lead(2).status).toBe('read')
    })

    it('puts everything back when the mail server refuses, and records no reply', async () => {
        const plan = await draft([customerStep({ rank: 'gold' }), replyStep()])
        h.mail.ok = false

        await expect(apply(plan)).rejects.toMatchObject({ status: 422, message: expect.stringContaining('could not be sent') })
        expect(customer(12).rank).toBe('silver')
        expect(lead(2).replies).toEqual([])
        expect([lead(1).status, lead(2).status]).toEqual(['new', 'read'])
    })

    it('does not email a lead whose address changed since the draft', async () => {
        const plan = await draft([replyStep()])
        lead(2).email = 'someone-else@x.my'
        lead(2).updatedAt = 'l2'

        await expect(apply(plan)).rejects.toMatchObject({ status: 409 })
        expect(h.mail.calls).toHaveLength(0)
    })

    it('never sends twice: when the mail is out but cannot be written down, the approval still succeeds (and logs it)', async () => {
        const plan = await draft([replyStep()])
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        h.db.failUpdate = (collection) => (collection === 'contact-submissions' ? new Error('db down') : undefined)

        const result = await apply(plan)

        expect(h.mail.calls).toHaveLength(1)
        expect(result.undo).toBeUndefined()
        expect(log).toHaveBeenCalledWith('[lead-reply] email sent but not recorded on the lead:', 'db down')
        log.mockRestore()
    })
})

describe('apply email templates [TC-AICP-209]', () => {
    const row = () => h.db['email-template-settings'].find((r) => r.templateType === 'order-confirmation')

    it('creates the shop\'s row the first time, through the template service', async () => {
        const result = await apply(await draft([tplStep({ greeting: 'Hello {customerName}', subject: '{brandName}: order {orderNumber}' })]))

        expect(row()).toMatchObject({ tenant: 1, recipient: 'buyer', enabled: true, contentEn: { greeting: 'Hello {customerName}', subject: '{brandName}: order {orderNumber}' }, contentMs: {} })
        expect(result.entities).toEqual([{ kind: 'email_template', id: 'order-confirmation' }])
        expect(result.links).toEqual([{ label: 'Open email templates', href: '/settings/email-templates' }])
        expect(undoOf(result).payload.ops).toEqual([{ op: 'template', templateType: 'order-confirmation', before: null, updatedAt: row()!.updatedAt }])
    })

    it('updates an existing row and keeps the other language and the on/off switch', async () => {
        h.db['email-template-settings'].push({ id: 50, tenant: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled: true, contentEn: { greeting: 'Hi there' }, contentMs: { greeting: 'Salam' }, updatedAt: 't50' })

        const result = await apply(await draft([tplStep({ closing: 'See you soon', enabled: false })]))

        expect(row()).toMatchObject({ enabled: false, contentEn: { greeting: 'Hi there', closing: 'See you soon' }, contentMs: { greeting: 'Salam' } })
        expect((undoOf(result).payload.ops as any[])[0].before).toEqual({ enabled: true, contentEn: { greeting: 'Hi there' }, contentMs: { greeting: 'Salam' } })
    })

    it('is refused when the plan does not include email templates, and when the row was edited since', async () => {
        const plan = await draft([tplStep({ greeting: 'Hello {customerName}' })])
        h.plan.allowed = false
        await expect(apply(plan)).rejects.toMatchObject({ status: 422, message: expect.stringContaining('not available on your current plan') })
        expect(row()).toBeUndefined()

        h.plan.allowed = true
        h.db['email-template-settings'].push({ id: 51, tenant: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled: true, contentEn: {}, contentMs: {}, updatedAt: 'added-meanwhile' })
        await expect(apply(plan)).rejects.toMatchObject({ status: 409 })
    })

    it('needs Settings for a custom role', async () => {
        const plan = await draft([tplStep({ greeting: 'Hello {customerName}' })])

        await expect(apply(plan, owner('custom', ['orders']))).rejects.toMatchObject({ status: 403 })
        await expect(apply(plan, owner('custom', ['settings']))).resolves.toBeTruthy()
    })

    it('reset deletes the row, so the built-in text applies again', async () => {
        h.db['email-template-settings'].push({ id: 50, tenant: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled: false, contentEn: { greeting: 'Hi there' }, contentMs: {}, updatedAt: 't50' })

        const result = await apply(await draft([{ op: 'template_reset', templateType: 'order-confirmation' }]))

        expect(row()).toBeUndefined()
        expect(h.db.writes).toEqual([{ op: 'delete', collection: 'email-template-settings', id: 50 }])
        expect(undoOf(result).payload.ops).toEqual([{ op: 'template', templateType: 'order-confirmation', before: { enabled: false, contentEn: { greeting: 'Hi there' }, contentMs: {} }, updatedAt: null }])
    })
})

describe('undo [TC-AICP-210]', () => {
    const undo = (result: { undo?: { kind: string; payload: Record<string, unknown>; until: string } }, who = actor) => applyStoreCustomersRestore(undoOf(result).payload, who)

    it('puts a customer back as it was — also after two steps on the same customer in one card', async () => {
        const result = await apply(await draft([customerStep({ rank: 'gold' }), customerStep({ name: 'Aisyah R', notes: '' })]))
        expect(customer(12)).toMatchObject({ name: 'Aisyah R', rank: 'gold', notes: null })

        await undo(result)

        expect(customer(12)).toMatchObject({ name: 'Aisyah', rank: 'silver', notes: 'Likes batik' })
    })

    it('is refused, changing nothing, once the customer was edited after the change', async () => {
        const result = await apply(await draft([customerStep({ rank: 'gold' })]))
        customer(12).updatedAt = 'edited-later'
        const writes = h.db.writes.length

        await expect(undo(result)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('edited after this change') })
        expect(h.db.writes).toHaveLength(writes)
        expect(customer(12).rank).toBe('gold')
    })

    it('puts every message of the person back to its own earlier status; refused once one was touched', async () => {
        const result = await apply(await draft([statusStep()]))
        await undo(result)
        expect([lead(1).status, lead(2).status]).toEqual(['new', 'read'])

        const again = await apply(await draft([statusStep()]))
        lead(2).updatedAt = 'opened-later'
        await expect(undo(again)).rejects.toMatchObject({ status: 409 })
        expect([lead(1).status, lead(2).status]).toEqual(['replied', 'replied'])
    })

    it('undoes template edits: the created row is removed, an edited row restored, a reset row brought back', async () => {
        const created = await apply(await draft([tplStep({ greeting: 'Hello {customerName}' })]))
        await undo(created)
        expect(h.db['email-template-settings']).toHaveLength(0)

        h.db['email-template-settings'].push({ id: 50, tenant: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled: true, contentEn: { greeting: 'Hi there' }, contentMs: {}, updatedAt: 't50' })
        const edited = await apply(await draft([tplStep({ greeting: 'Hello {customerName}' })]))
        await undo(edited)
        expect(h.db['email-template-settings'][0]).toMatchObject({ enabled: true, contentEn: { greeting: 'Hi there' } })

        const reset = await apply(await draft([{ op: 'template_reset', templateType: 'order-confirmation' }]))
        expect(h.db['email-template-settings']).toHaveLength(0)
        await undo(reset)
        expect(h.db['email-template-settings'][0]).toMatchObject({ tenant: 1, templateType: 'order-confirmation', contentEn: { greeting: 'Hi there' } })
    })

    it('is refused when the template row was edited after the change', async () => {
        const result = await apply(await draft([tplStep({ greeting: 'Hello {customerName}' })]))
        h.db['email-template-settings'][0]!.updatedAt = 'edited-later'

        await expect(undo(result)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('order-confirmation') })
        expect(h.db['email-template-settings']).toHaveLength(1)
    })

    it('a sent email stays sent: undo only puts the lead\'s status back and sends nothing', async () => {
        const result = await apply(await draft([replyStep()]))
        expect(undoOf(result).payload.ops).toEqual([{ op: 'lead_status', items: expect.arrayContaining([{ id: 2, before: 'read', updatedAt: expect.any(String) }]) }])

        await undo(result)

        expect([lead(1).status, lead(2).status]).toEqual(['new', 'read'])
        expect(lead(2).replies).toHaveLength(1)
        expect(h.mail.calls).toHaveLength(1)
    })

    it('needs the area\'s role for undo too', async () => {
        const result = await apply(await draft([customerStep({ rank: 'gold' })]))

        await expect(undo(result, owner('custom', ['products']))).rejects.toMatchObject({ status: 403 })
        expect(customer(12).rank).toBe('gold')
    })
})

describe('customer card hardening [TC-AISEC-104, TC-AISEC-105, TC-AISEC-107]', () => {
    it('closes (final, stale) a card whose customer changed after the draft [TC-AISEC-107]', async () => {
        const plan = await draft([customerStep({ rank: 'vip' })])
        customer(12).updatedAt = 'someone-else'

        const error = await apply(plan).catch((e) => e)

        expect(error).toMatchObject({ status: 409, final: true, stale: true })
    })

    it('when putting back a half-run change fails too, the card closes saying what is still in place [TC-AISEC-105]', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const plan = await draft([customerStep({ rank: 'vip' }), replyStep()])
        h.mail.ok = false
        // the put-back of the customer fails as well
        let writes = 0
        h.db.failUpdate = (collection) => (collection === 'customers' && ++writes > 1 ? new Error('connection reset') : undefined)

        const error = await apply(plan).catch((e) => e)

        expect(error).toMatchObject({ status: 422, final: true })
        expect(error.message).toContain('Done: changed customer #12, could not put back: customer #12')
        expect(customer(12).rank).toBe('vip')
        expect(h.mail.calls).toHaveLength(1)
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Customers: a failed change could not be put back'), expect.any(String))
        log.mockRestore()
    })

    it('an undo that already ran (record lost, second tab) succeeds again without writing [TC-AISEC-104]', async () => {
        const result = await apply(await draft([customerStep({ rank: 'vip' }), statusStep({ leadId: '3', status: 'ignored' })]))
        await applyStoreCustomersRestore(undoOf(result).payload, actor)
        expect(customer(12).rank).toBe('silver')
        const writes = h.db.writes.length

        await expect(applyStoreCustomersRestore(undoOf(result).payload, actor)).resolves.toEqual({ entities: [], links: [] })

        expect(h.db.writes).toHaveLength(writes)
        expect(lead(3).status).toBe('new')
    })

    it('still refuses an undo when the record moved on to something else [TC-AISEC-104]', async () => {
        const result = await apply(await draft([customerStep({ rank: 'vip' })]))
        customer(12).rank = 'gold'
        customer(12).updatedAt = 'edited-later'

        await expect(applyStoreCustomersRestore(undoOf(result).payload, actor)).rejects.toMatchObject({ status: 409 })
        expect(customer(12).rank).toBe('gold')
    })
})
