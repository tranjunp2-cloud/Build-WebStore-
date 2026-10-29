/** searchBaseRecords follows page_token and caps the row count (digest must not drop rows silently). TC-IDs from docs/qa/F44-feedback-mvp.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { resetLarkTokenCache, searchBaseRecords } from '@/lib/lark/lark-base-client'

const ref = { appToken: 'bascn1', tableId: 'tblX', filter: {}, fieldNames: ['Status'] }
const json = (data: unknown) => new Response(JSON.stringify({ code: 0, data }), { status: 200 })
const items = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ record_id: `rec${from + i}`, fields: {} }))
const keys = ['LARK_APP_ID', 'LARK_APP_SECRET'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
    for (const k of keys) saved[k] = process.env[k]
    Object.assign(process.env, { LARK_APP_ID: 'cli_t', LARK_APP_SECRET: 's' })
    resetLarkTokenCache()
})
afterEach(() => {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('TC-F44-34: digest search pagination', () => {
    it('follows page_token until has_more is false', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: 't', expire: 7200 }), { status: 200 }))
            .mockResolvedValueOnce(json({ items: items(2), has_more: true, page_token: 'p2' }))
            .mockResolvedValueOnce(json({ items: items(1, 2), has_more: false }))
        vi.stubGlobal('fetch', fetchMock)
        const rows = await searchBaseRecords(ref)
        expect(rows.map((r) => r.recordId)).toEqual(['rec0', 'rec1', 'rec2'])
        expect(String(fetchMock.mock.calls[2][0])).toContain('page_token=p2')
    })
    it('stops at maxRows and logs that it was capped', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: 't', expire: 7200 }), { status: 200 }))
            .mockImplementation(async () => json({ items: items(3), has_more: true, page_token: 'more' })))
        const rows = await searchBaseRecords({ ...ref, maxRows: 5 })
        expect(rows).toHaveLength(5)
        expect(warn).toHaveBeenCalled()
    })
})
