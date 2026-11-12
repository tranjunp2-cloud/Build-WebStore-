import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { recordSiteStatusEvent } from '@/lib/sites/site-status-events'

const input = {
    siteId: '3456',
    tenantId: '3051',
    user: { id: 3185, email: 'owner@example.com' },
    action: 'unpublish' as const,
    source: 'editor' as const,
    previousStatus: 'published',
}

const payloadWith = (execute: (q: unknown) => Promise<unknown>) => ({ db: { drizzle: { execute } } }) as unknown as Payload

describe('recordSiteStatusEvent', () => {
    afterEach(() => vi.restoreAllMocks())

    it('[TC-F01-audit-01] inserts one row into site_status_events with numeric ids', async () => {
        const execute = vi.fn().mockResolvedValue(undefined)
        await recordSiteStatusEvent(payloadWith(execute), input)
        expect(execute).toHaveBeenCalledTimes(1)
        const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL)
        expect(q.sql).toContain('INSERT INTO site_status_events')
        expect(q.params).toEqual([3456, 3051, 3185, 'owner@example.com', 'unpublish', 'editor', 'published'])
    })

    it('[TC-F01-audit-02] a failing insert is logged and never thrown', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {})
        const execute = vi.fn().mockRejectedValue(new Error('relation "site_status_events" does not exist'))
        await expect(recordSiteStatusEvent(payloadWith(execute), input)).resolves.toBeUndefined()
        expect(err).toHaveBeenCalledWith('[site-status-events] failed to record event', expect.objectContaining({ siteId: '3456' }))
    })

    it('[TC-F01-audit-03] no drizzle handle → warns and skips', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        await recordSiteStatusEvent({ db: {} } as unknown as Payload, input)
        expect(warn).toHaveBeenCalled()
    })

    it('[TC-F01-audit-04] non-numeric user/tenant ids are stored as null instead of failing', async () => {
        const execute = vi.fn().mockResolvedValue(undefined)
        await recordSiteStatusEvent(payloadWith(execute), { ...input, tenantId: null, user: { id: 'sso-abc' } })
        const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL)
        expect(q.params.slice(1, 4)).toEqual([null, null, null])
    })
})
