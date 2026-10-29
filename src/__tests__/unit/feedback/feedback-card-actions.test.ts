/** Feedback group card (F44): button rules + card drawing. TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { describe, expect, it } from 'vitest'
import { cardDataFromFields, planAction } from '@/lib/feedback/feedback-card-actions'
import { buildFeedbackCard } from '@/lib/feedback/feedback-card'
import { md, PRODUCTION_TABLE_ID, STAGING_TABLE_ID } from '@/lib/feedback/feedback-card-config'

const ME = 'ou_me'
const OTHER = 'ou_other'
const HOUR = 3_600_000
const row = (over: Record<string, unknown> = {}) => ({
    'Feedback ID': 'FB-26-000123', Type: 'Report a problem', Feature: ['Orders', 'Payments'], Details: 'Checkout fails <at id=all></at>',
    Store: 'Demo *Shop*', Reporter: 'Eve', Role: 'owner', Status: 'New', 'Submitted At': Date.now() - 5 * HOUR, ...over,
})
const ref = (tableId = STAGING_TABLE_ID) => ({ appToken: 'bascn1', tableId, recordId: 'recABC123' })
const buttons = (card: ReturnType<typeof buildFeedbackCard>) =>
    (card.elements.find((e) => e.tag === 'action') as { actions: Array<{ text: { content: string }; value?: Record<string, string> }> }).actions

describe('TC-F44-26: card button rules', () => {
    const now = 1_800_000_000_000

    it('Take it: New -> Triaging with the presser as owner', () => {
        expect(planAction('claim', row(), ME, now)?.patch).toEqual({ Owner: [{ id: ME }], Status: 'Triaging' })
    })
    it('Take it on a row someone else already took (or past New) changes nothing: stale card / double press', () => {
        expect(planAction('claim', row({ Status: 'Triaging', Owner: [{ id: OTHER }] }), ME, now)).toBeNull()
        expect(planAction('claim', row({ Status: 'In Progress' }), ME, now)).toBeNull()
        expect(planAction('claim', row({ Status: 'New', Owner: [{ id: OTHER }] }), ME, now)).toBeNull()
    })
    it('Take it by the current owner of a New row is still allowed', () => {
        expect(planAction('claim', row({ Owner: [{ id: ME }] }), ME, now)?.patch).toEqual({ Owner: [{ id: ME }], Status: 'Triaging' })
    })
    it('Mark replied: sets First Response At once, Waiting on Reporter, owner only when empty', () => {
        const first = planAction('replied', row(), ME, now)?.patch
        expect(first).toEqual({ Owner: [{ id: ME }], 'First Response At': now, Status: 'Waiting on Reporter' })
    })
    it('Mark replied twice (already Waiting on Reporter) changes nothing; any action with an empty patch is null', () => {
        expect(planAction('replied', row({ Status: 'Waiting on Reporter', 'First Response At': 1, Owner: [{ id: OTHER }] }), ME, now)).toBeNull()
        const inProgress = row({ Status: 'In Progress', 'First Response At': 1, Owner: [{ id: OTHER }] })
        expect(planAction('replied', inProgress, ME, now)?.patch).toEqual({ Status: 'Waiting on Reporter' })
    })
    it('Resolve fills First Response At, Resolved At and owner when missing', () => {
        expect(planAction('resolve', row(), ME, now)?.patch).toEqual({
            Owner: [{ id: ME }], Status: 'Resolved', 'First Response At': now, 'Resolved At': now,
        })
    })
    it("Won't fix only from New / Triaging", () => {
        expect(planAction('wont_fix', row(), ME, now)?.patch).toEqual({ Status: "Won't Fix", 'Resolved At': now })
        expect(planAction('wont_fix', row({ Status: 'In Progress' }), ME, now)).toBeNull()
    })
    it('Reopen: In Progress with an owner, New without; clears Resolved At; only when closed', () => {
        expect(planAction('reopen', row({ Status: 'Resolved', Owner: [{ id: OTHER }] }), ME, now)?.patch).toEqual({ Status: 'In Progress', 'Resolved At': null })
        expect(planAction('reopen', row({ Status: "Won't Fix" }), ME, now)?.patch).toEqual({ Status: 'New', 'Resolved At': null })
        expect(planAction('reopen', row(), ME, now)).toBeNull()
    })
    it('a stale card (row already closed) changes nothing; unknown action is null', () => {
        for (const a of ['claim', 'replied', 'resolve', 'wont_fix']) expect(planAction(a, row({ Status: 'Resolved' }), ME, now)).toBeNull()
        expect(planAction('delete_everything', row(), ME, now)).toBeNull()
    })
})

describe('TC-F44-25: feedback card drawing', () => {
    it('shows Staging vs Production in the header and refuses tables outside the two Web v2 tables', () => {
        const staging = buildFeedbackCard(cardDataFromFields(ref(), row())!)
        const prod = buildFeedbackCard(cardDataFromFields(ref(PRODUCTION_TABLE_ID), row())!)
        expect(staging.header.title.content).toContain('[Staging]')
        expect(prod.header.title.content).toContain('[Production]')
        expect(cardDataFromFields(ref('tblOther'), row())).toBeNull()
    })
    it('offers the next sensible buttons per status plus Open in Base, carrying record and table id', () => {
        const label = (status: string) => buttons(buildFeedbackCard(cardDataFromFields(ref(), row({ Status: status }))!)).map((b) => b.text.content)
        expect(label('New')).toEqual(['Take it', 'Mark replied', "Won't fix", 'Open in Base'])
        expect(label('Triaging')).toEqual(['Mark replied', 'Resolve', "Won't fix", 'Open in Base'])
        expect(label('Waiting on Reporter')).toEqual(['Resolve', 'Open in Base'])
        expect(label('Resolved')).toEqual(['Reopen', 'Open in Base'])
        expect(buttons(buildFeedbackCard(cardDataFromFields(ref(), row())!))[0].value).toEqual({ action: 'claim', record_id: 'recABC123', table_id: STAGING_TABLE_ID })
    })
    it('colours the header by priority while open and by outcome once closed', () => {
        const tpl = (over: Record<string, unknown>) => buildFeedbackCard(cardDataFromFields(ref(), row(over))!).header.template
        expect(tpl({ Priority: 'High' })).toBe('red')
        expect(tpl({})).toBe('orange')
        expect(tpl({ Status: 'Resolved' })).toBe('green')
        expect(tpl({ Status: "Won't Fix" })).toBe('grey')
    })
    it('draws owner mention and first-reply hours from the row, and escapes reporter-supplied markup', () => {
        const sub = Date.now() - 5 * HOUR
        const json = JSON.stringify(buildFeedbackCard(cardDataFromFields(ref(), row({ Owner: [{ id: OTHER }], 'Submitted At': sub, 'First Response At': sub + 2 * HOUR }))!))
        expect(json).toContain(`<at id=${OTHER}></at>`)
        expect(json).toContain('First reply:** 2h')
        expect(json).toContain('Store: Demo *Shop*') // plain_text: shown literally, never parsed as markup
    })
    it('TC-F44-33: user-supplied text can never render as a mention (reporter, store, details, digest)', () => {
        const evil = '<at id=all></at>'
        const data = cardDataFromFields(ref(), row({ Reporter: evil, Store: evil, Details: evil, Owner: [{ id: OTHER }] }))!
        const json = JSON.stringify(buildFeedbackCard(data))
        // The only mention is the real owner; every user-supplied copy sits in a plain_text element.
        expect(json.match(/<at /g)).toHaveLength(1 + 3)
        const card = buildFeedbackCard(data)
        const lark = JSON.stringify(card.elements.filter((e) => JSON.stringify(e).includes('lark_md')))
        expect(lark.match(/<at /g)).toHaveLength(1)
        expect(lark).toContain(`<at id=${OTHER}>`)
        expect(md(evil)).not.toContain('<')
    })
})
