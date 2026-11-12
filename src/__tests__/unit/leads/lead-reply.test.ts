/**
 * TC-AICP-212 — replying to a contact lead (lib/leads/lead-reply): the email is built from the shared email parts
 * with the approved text escaped and nothing added, goes out with the shop's contact as reply-to, is limited to 20
 * replies an hour per workspace, and is recorded on the lead (and the lead marked replied) only after the mail
 * server took it. Faked: Payload (in memory), the mail transport (`sendEmail`), the rate limiter.
 * TC-AISEC-115 — the recipient must be one plain `local@domain` address (no comment / quote / bracket characters).
 * TC-AISEC-117 — the reply is appended as one row under a lock on the lead (the concurrency itself:
 * integration/lead-reply-append-postgres.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Db, makeCms, newDb } from '../ai-platform/customers-fake-cms'

const h = vi.hoisted(() => ({ db: null as unknown as Db, cms: null as unknown, ok: true, allowed: true, dayAllowed: true }))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => h.ok) }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async (key: string) => ({ allowed: key.startsWith('lead-reply-day:') ? h.dayAllowed : h.allowed, remaining: 0, resetAt: 0 })) }))

import { sendEmail } from '@/lib/email/send'
import { buildLeadReplyHtml, cleanSubject, EMAIL_RE, leadReplyContext, MAX_REPLIES_PER_DAY, MAX_REPLIES_PER_HOUR, replyToLeadAs } from '@/lib/leads/lead-reply'
import { LeadServiceError } from '@/lib/leads/lead-service'
import { checkRateLimit } from '@/lib/rateLimit'

const who = { tenantId: '1', user: { email: 'owner@kedai.my' } }

beforeEach(() => {
    vi.clearAllMocks()
    h.ok = true
    h.allowed = true
    h.dayAllowed = true
    h.db = newDb()
    h.cms = makeCms(h.db)
    h.db.sites.push({ id: 5, tenant: 1, name: 'Kedai & Batik', contactInfo: { email: 'hello@kedaibatik.my' } }, { id: 6, tenant: 2, name: 'Other' })
    h.db['contact-submissions'].push(
        { id: 1, name: 'Ahmad', email: 'ahmad@x.my', message: 'a', site: 5, status: 'new', createdAt: '2026-10-10T00:00:00Z', updatedAt: 'l1', replies: [{ id: 'r0', subject: 'Earlier', body: 'Hi', sentAt: '2026-10-11T00:00:00Z', sentBy: 'a@b.my' }] },
        { id: 4, name: 'Intruder', email: 'i@x.my', message: 'd', site: 6, status: 'new', createdAt: '2026-10-13T00:00:00Z', updatedAt: 'l4' },
    )
})

describe('lead reply email [TC-AICP-212]', () => {
    it('builds the email from the shared parts: shop name on top, the approved text as paragraphs, escaped, no extra wording', () => {
        const html = buildLeadReplyHtml('Kedai & Batik', 'Hai <b>Ahmad</b>,\nbaris dua\n\n\nPerenggan "dua" & akhir', 2026)

        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('Kedai &amp; Batik')
        expect(html).toContain('Hai &lt;b&gt;Ahmad&lt;/b&gt;,<br>baris dua')
        expect(html).toContain('Perenggan &quot;dua&quot; &amp; akhir')
        expect(html.match(/<div style="margin:0 0 14px;">/g)).toHaveLength(2)
        expect(html).toContain('&copy; 2026 Kedai &amp; Batik')
        expect(html).not.toMatch(/<script|<b>Ahmad/)
    })

    it('keeps the subject on one line', () => {
        expect(cleanSubject('  Re:\r\nyour   question\tplease ')).toBe('Re: your question please')
    })

    it('knows the shop and where replies come back to', async () => {
        const ctx = await leadReplyContext(who, 1)

        expect(ctx).toMatchObject({ shopName: 'Kedai & Batik', replyTo: 'hello@kedaibatik.my', replyToIs: 'shop' })
        delete (h.db.sites[0] as Record<string, unknown>).contactInfo
        expect(await leadReplyContext(who, 1)).toMatchObject({ replyTo: 'owner@kedai.my', replyToIs: 'you' })
        await expect(leadReplyContext(who, 4)).rejects.toThrow('Unauthorized')
    })

    it('sends it with the reply-to, appends it to the lead\'s replies (keeping the earlier one) and marks the lead replied', async () => {
        const out = await replyToLeadAs(who, 1, { subject: 'Terima kasih', body: 'Hai Ahmad' })

        expect(sendEmail).toHaveBeenCalledWith({ to: 'ahmad@x.my', subject: 'Terima kasih', html: expect.stringContaining('Hai Ahmad'), replyTo: 'hello@kedaibatik.my' })
        expect(checkRateLimit).toHaveBeenCalledWith('lead-reply:1', MAX_REPLIES_PER_HOUR, 3_600_000)
        expect(checkRateLimit).toHaveBeenCalledWith('lead-reply-day:1', MAX_REPLIES_PER_DAY, 86_400_000)
        const lead = h.db['contact-submissions'][0]!
        expect((lead.replies as Array<Record<string, unknown>>).map((r) => r.subject)).toEqual(['Earlier', 'Terima kasih'])
        expect((lead.replies as Array<Record<string, unknown>>)[1]).toMatchObject({ body: 'Hai Ahmad', sentBy: 'owner@kedai.my' })
        expect((lead.replies as Array<Record<string, unknown>>)[0]).toMatchObject({ id: 'r0', sentBy: 'a@b.my' })
        expect(lead.status).toBe('replied')
        expect(out).toMatchObject({ to: 'ahmad@x.my', replyTo: 'hello@kedaibatik.my', recorded: true, statusWrites: [{ id: 1, before: 'new' }] })
    })

    it('refuses an empty reply, a lead with no usable address and another workspace\'s lead before any mail', async () => {
        h.db['contact-submissions'].push({ id: 8, name: 'X', email: 'broken', message: 'x', site: 5, status: 'new', createdAt: '2026-10-14T00:00:00Z', updatedAt: 'l8' })

        await expect(replyToLeadAs(who, 1, { subject: '  ', body: 'x' })).rejects.toMatchObject({ code: 'INVALID' })
        await expect(replyToLeadAs(who, 8, { subject: 's', body: 'x' })).rejects.toMatchObject({ code: 'INVALID' })
        await expect(replyToLeadAs(who, 4, { subject: 's', body: 'x' })).rejects.toThrow('Unauthorized')
        expect(sendEmail).not.toHaveBeenCalled()
    })

    it('stops at 20 replies an hour, and reports a refused mail without recording anything', async () => {
        h.allowed = false
        await expect(replyToLeadAs(who, 1, { subject: 's', body: 'x' })).rejects.toMatchObject({ code: 'RATE_LIMITED', message: expect.stringContaining('20 replies in the last hour') })
        expect(sendEmail).not.toHaveBeenCalled()

        h.allowed = true
        h.ok = false
        const failure = await replyToLeadAs(who, 1, { subject: 's', body: 'x' }).catch((e) => e)
        expect(failure).toBeInstanceOf(LeadServiceError)
        expect(failure.code).toBe('SEND_FAILED')
        expect(h.db.writes).toHaveLength(0)
        expect(h.db['contact-submissions'][0]!.status).toBe('new')
    })

    it('stops at 50 replies a day per workspace on top of the hourly limit, before any mail [TC-AICP-257]', async () => {
        h.dayAllowed = false

        await expect(replyToLeadAs(who, 1, { subject: 's', body: 'x' })).rejects.toMatchObject({ code: 'RATE_LIMITED', message: expect.stringContaining('50 replies in the last 24 hours') })

        expect(MAX_REPLIES_PER_DAY).toBe(50)
        expect(sendEmail).not.toHaveBeenCalled()
        expect(h.db.writes).toHaveLength(0)
    })

    it('does not throw when the mail went out but could not be written down', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        h.db.failUpdate = () => new Error('db down')

        const out = await replyToLeadAs(who, 1, { subject: 's', body: 'x' })

        expect(out.recorded).toBe(false)
        expect(sendEmail).toHaveBeenCalledTimes(1)
        log.mockRestore()
    })
})

describe('lead reply recipient is one plain address [TC-AISEC-115]', () => {
    it('accepts ordinary addresses', () => {
        for (const ok of ['ahmad@x.my', 'siti.binti+shop@mail.example.com.my', "o'neil@kedai.my", 'a_b-c@sub-domain.co']) expect(EMAIL_RE.test(ok)).toBe(true)
    })

    it('refuses comments, quotes, brackets, backslashes, spaces, a second @ and a bare host', () => {
        const bad = ['ahmad(x)@x.my', 'ahmad@x.my(evil.com)', '"a b"@x.my', 'a\\b@x.my', 'a@[127.0.0.1]', 'a@x.my]', 'a b@x.my', 'a@b@x.my', 'a@localhost', 'a..b@x.my', '.a@x.my', 'a@-x.my', 'a@x.my\n']
        for (const value of bad) expect(EMAIL_RE.test(value), value).toBe(false)
    })

    it('a lead whose address carries a comment gets no email', async () => {
        h.db['contact-submissions'].push({ id: 9, name: 'X', email: 'ahmad@x.my(attacker@evil.com)', message: 'x', site: 5, status: 'new', createdAt: '2026-10-14T00:00:00Z', updatedAt: 'l9' })

        await expect(replyToLeadAs(who, 9, { subject: 's', body: 'x' })).rejects.toMatchObject({ code: 'INVALID' })
        expect(sendEmail).not.toHaveBeenCalled()
    })
})

describe('the reply is appended in one locked statement pair [TC-AISEC-117]', () => {
    it('locks and moves the lead, then inserts one replies row after the last one (no rewrite of the array)', async () => {
        await replyToLeadAs(who, 1, { subject: 'Terima kasih', body: 'Hai Ahmad' })

        const [lock, insert] = h.db.sqlLog
        expect(lock).toMatchObject({ sql: expect.stringMatching(/^UPDATE contact_submissions SET updated_at = now\(\) WHERE id = \$1 RETURNING id$/), params: [1] })
        expect(insert!.sql).toMatch(/^INSERT INTO contact_submissions_replies \(id, _order, _parent_id, subject, body, sent_at, sent_by\) SELECT gen_random_uuid\(\)::text, COALESCE\(MAX\(_order\), 0\) \+ 1/)
        expect(insert!.params).toEqual([1, 'Terima kasih', 'Hai Ahmad', expect.any(String), 'owner@kedai.my', 1])
        expect(h.db.writes.some((w) => w.collection === 'contact-submissions' && w.data && 'replies' in w.data)).toBe(false)
    })
})
