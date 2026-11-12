/** Overdue digest (F44): selection, card, cron route. TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/lark/lark-base-client', () => {
    class LarkApiError extends Error {
        constructor(message: string, public code: number | null = null, public httpStatus: number | null = null) {
            super(message)
        }
    }
    return { LarkApiError, searchBaseRecords: vi.fn(), sendChatCard: vi.fn() }
})

import { PRODUCTION_TABLE_ID, STAGING_TABLE_ID } from '@/lib/feedback/feedback-card-config'
import { buildOverdueCard, humaniseHours, isMondayInMalaysia, selectOverdue, selectStale } from '@/lib/feedback/feedback-overdue-digest'
import { GET } from '@/app/api/cron/feedback-overdue-digest/route'
import { searchBaseRecords, sendChatCard } from '@/lib/lark/lark-base-client'

const HOUR = 3_600_000
const NOW = Date.parse('2026-11-02T01:00:00Z') // Monday 09:00 in Kuala Lumpur
const row = (id: string, ageH: number, over: Record<string, unknown> = {}) => ({
    recordId: `rec${id}`,
    fields: { 'Feedback ID': `FB-26-${id}`, Type: 'Report a problem', Priority: 'High', Store: 'Demo', Status: 'New', 'Submitted At': NOW - ageH * HOUR, ...over },
})

describe('TC-F44-30: overdue selection and card', () => {
    it('lists open, never-replied rows past 24h, oldest first', () => {
        const rows = [row('000001', 30), row('000002', 50), row('000003', 5), row('000004', 99, { 'First Response At': NOW - HOUR }), row('000005', 99, { Status: 'Resolved' })]
        expect(selectOverdue(rows, NOW).map((i) => i.feedbackId)).toEqual(['FB-26-000002', 'FB-26-000001'])
    })
    it('stale = In Progress / Waiting on Reporter for over 7 days', () => {
        const rows = [row('000001', 200, { Status: 'In Progress' }), row('000002', 100, { Status: 'In Progress' }), row('000003', 200, { Status: 'New' }), row('000004', 300, { Status: 'Waiting on Reporter' })]
        expect(selectStale(rows, NOW).map((i) => i.feedbackId)).toEqual(['FB-26-000004', 'FB-26-000001'])
    })
    it('detects Monday in Malaysia time, not UTC', () => {
        expect(isMondayInMalaysia(NOW)).toBe(true)
        expect(isMondayInMalaysia(Date.parse('2026-11-03T01:00:00Z'))).toBe(false)
        expect(isMondayInMalaysia(Date.parse('2026-11-01T17:00:00Z'))).toBe(true) // Sunday 17:00 UTC = Monday 01:00 MYT
    })
    it('draws one card with record links, both sections when present, and humanised ages', () => {
        const overdue = selectOverdue([row('000001', 30)], NOW)
        const stale = selectStale([row('000002', 200, { Status: 'In Progress' })], NOW)
        const json = JSON.stringify(buildOverdueCard('bascn1', PRODUCTION_TABLE_ID, overdue, stale))
        expect(json).toContain('[Production] 1 feedback item has had no reply in over 24h')
        expect(json).toContain('record=rec000001')
        expect(json).toContain('Open for over 7 days')
        expect(humaniseHours(30.4)).toBe('30h')
        expect(humaniseHours(54)).toBe('2 days 6h')
    })
})

describe('TC-F44-31: digest cron route', () => {
    const keys = ['CRON_SECRET', 'LARK_BASE_APP_TOKEN', 'LARK_NOTIFY_CHAT_ID', 'LARK_BASE_REPORT_TABLE_ID'] as const
    const saved: Record<string, string | undefined> = {}
    const call = (auth?: string) => GET(new Request('http://x/api/cron/feedback-overdue-digest', { headers: auth ? { authorization: auth } : {} }))

    beforeEach(() => {
        for (const k of keys) saved[k] = process.env[k]
        Object.assign(process.env, { CRON_SECRET: 's3cret', LARK_BASE_APP_TOKEN: 'bascn1', LARK_NOTIFY_CHAT_ID: 'oc_team', LARK_BASE_REPORT_TABLE_ID: PRODUCTION_TABLE_ID })
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        vi.mocked(searchBaseRecords).mockReset().mockResolvedValue([row('000001', 30)])
        vi.mocked(sendChatCard).mockReset().mockResolvedValue(undefined)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
        vi.useRealTimers()
        for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
        vi.restoreAllMocks()
    })

    it('fails closed without a valid CRON_SECRET', async () => {
        expect((await call()).status).toBe(401)
        expect((await call('Bearer wrong')).status).toBe(401)
        delete process.env.CRON_SECRET
        expect((await call('Bearer undefined')).status).toBe(401)
        expect(searchBaseRecords).not.toHaveBeenCalled()
    })
    it('posts one card to the group when something is overdue', async () => {
        const res = await call('Bearer s3cret')
        expect((await res.json()).data).toEqual({ overdue: 1, stale: 0, notified: true })
        expect(vi.mocked(sendChatCard).mock.calls[0][0]).toBe('oc_team')
        expect(vi.mocked(searchBaseRecords).mock.calls[0][0]).toMatchObject({ tableId: PRODUCTION_TABLE_ID })
    })
    it('stays silent when nothing is overdue', async () => {
        vi.mocked(searchBaseRecords).mockResolvedValue([row('000001', 2)])
        expect((await (await call('Bearer s3cret')).json()).data.notified).toBe(false)
        expect(sendChatCard).not.toHaveBeenCalled()
    })
    it('does nothing when the deployment points at the staging table or no chat is set', async () => {
        process.env.LARK_BASE_REPORT_TABLE_ID = STAGING_TABLE_ID
        expect((await (await call('Bearer s3cret')).json()).data.skipped).toBe(true)
        process.env.LARK_BASE_REPORT_TABLE_ID = PRODUCTION_TABLE_ID
        delete process.env.LARK_NOTIFY_CHAT_ID
        expect((await (await call('Bearer s3cret')).json()).data.skipped).toBe(true)
        expect(searchBaseRecords).not.toHaveBeenCalled()
    })
    it('adds the stale section on Mondays only', async () => {
        vi.mocked(searchBaseRecords).mockResolvedValue([row('000009', 200, { Status: 'In Progress', 'First Response At': NOW - HOUR })])
        expect((await (await call('Bearer s3cret')).json()).data).toMatchObject({ overdue: 0, stale: 1, notified: true })
        vi.setSystemTime(NOW + 24 * HOUR) // Tuesday
        vi.mocked(sendChatCard).mockClear()
        expect((await (await call('Bearer s3cret')).json()).data.notified).toBe(false)
        expect(sendChatCard).not.toHaveBeenCalled()
    })
    it('returns 502 when Lark fails', async () => {
        vi.mocked(searchBaseRecords).mockRejectedValue(new Error('down'))
        expect((await call('Bearer s3cret')).status).toBe(502)
    })
})
