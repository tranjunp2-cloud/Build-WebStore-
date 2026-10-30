import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

import { getCurrentUser } from '@/lib/auth'
import { getPayload } from 'payload'
import { GET } from '@/app/api/admin/ai-usage/export/route'
import { buildCsv, CSV_HEADER, csvLine, csvNumber, csvText } from '@/lib/admin/ai-usage/csv'
import { mapLogRow } from '@/lib/admin/ai-usage/log-queries'
import { fakeDb } from './fake-db'

const row = (over: Record<string, unknown> = {}) => mapLogRow({
    id: 5, created_at: '2026-10-29T05:00:00.000Z', tenant_id: 412, shop: 'Kedai, "Runcit"', user_email: 'a@b.my', plan: 'FREEMIUM', area: 'products', feature: 'writing',
    task: 'write-description', task_label: 'Write product description', summary: 'Description for Rose bouquet', provider: 'openai', model: 'gpt-5-mini',
    tokens_in: '100', tokens_out: '20', cost_usd: null, duration_ms: '1200', outcome: 'ok', ...over,
})

const request = (qs = '', ip = '10.0.0.1') => new NextRequest(`http://localhost/api/admin/ai-usage/export${qs}`, { headers: { 'x-forwarded-for': ip } })

describe('TC-AIS-LOG-005 CSV escaping', () => {
    it('quotes commas, quotes and newlines', () => {
        expect(csvText('a,b')).toBe('"a,b"')
        expect(csvText('say "hi"')).toBe('"say ""hi"""')
        expect(csvText('line1\nline2')).toBe('"line1\nline2"')
        expect(csvText(null)).toBe('')
    })

    it('defuses spreadsheet formulas in text cells', () => {
        expect(csvText('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
        expect(csvText('+1')).toBe("'+1")
        expect(csvText('@cmd')).toBe("'@cmd")
    })

    it('leaves an unpriced cost empty and numbers unquoted', () => {
        expect(csvNumber(null)).toBe('')
        expect(csvNumber(0.0012)).toBe('0.0012')
        const cells = csvLine(row())
        expect(cells).toContain('"Kedai, ""Runcit"""')
        expect(cells.split(',').length).toBeGreaterThan(CSV_HEADER.split(',').length) // the quoted comma adds one split
        expect(buildCsv([row()]).startsWith(`${CSV_HEADER}\r\n5,`)).toBe(true)
    })
})

describe('TC-AIS-LOG-006 export route is super-admin only', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns 401 without a user and never touches the database', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)
        const res = await GET(request())
        expect(res.status).toBe(401)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('returns 403 for a signed-in user who is not a super-admin', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, roles: ['user'] } as never)
        const res = await GET(request('', '10.0.0.2'))
        expect(res.status).toBe(403)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('streams a CSV attachment for a super-admin and passes the filters through', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, roles: ['super-admin'] } as never)
        const { db, calls } = fakeDb([{ id: 5, created_at: '2026-10-29T05:00:00.000Z', model: 'm', task_label: '=cmd', outcome: 'ok' }])
        vi.mocked(getPayload).mockResolvedValue(db as never)

        const res = await GET(request('?period=30d&plan=free&unpriced=1', '10.0.0.3'))
        const body = await res.text()

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
        expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="ai-usage-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv"/)
        expect(body.split('\r\n')[0]).toBe(CSV_HEADER)
        expect(body).toContain("'=cmd")
        expect(calls[0].params).toContain('free')
        expect(calls[0].params).toContain(50_000)
    })

    it('answers 500 (not a stack trace) when the query fails', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, roles: ['super-admin'] } as never)
        vi.mocked(getPayload).mockRejectedValue(new Error('db down'))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const res = await GET(request('', '10.0.0.4'))
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ error: 'Export failed' })
    })

    it('rate limits repeated exports from one address', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, roles: ['super-admin'] } as never)
        const { db } = fakeDb()
        vi.mocked(getPayload).mockResolvedValue(db as never)
        const statuses: number[] = []
        for (let i = 0; i < 6; i++) statuses.push((await GET(request('', '10.9.9.9'))).status)
        expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
        expect(statuses[5]).toBe(429)
    })
})
