/**
 * Feedback report (F44): availability window, type gating, zod schema, Lark field mapping,
 * idempotent submit. TC-IDs from docs/qa/F44-feedback-mvp.md.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/redis', () => ({ redis: null }))
vi.mock('@/lib/lark/lark-base-client', async () => {
    class LarkApiError extends Error {
        constructor(public code: number, public httpStatus = 200) {
            super('lark')
        }
    }
    return { LarkApiError, createBaseRecord: vi.fn() }
})

import { feedbackTypesFor, isFeedbackWindowOpen } from '@/lib/feedback/feedback-availability'
import {
    buildFeedbackId,
    extractReporter,
    feedbackSchema,
    submitFeedbackToLarkBase,
    toLarkFields,
    uuidV4Schema,
} from '@/lib/feedback/feedback-report'
import {
    SUBMIT_LIMIT,
    claimFeedbackKey,
    clearFeedbackBlocks,
    feedbackGuardKey,
    getFeedbackBlockSeconds,
    recordFeedbackSubmit,
} from '@/lib/feedback/feedback-spam-guard'
import { createBaseRecord } from '@/lib/lark/lark-base-client'

const KEY = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b'
const valid = { type: 'problem', areas: ['orders', 'payments'], details: 'The order total is wrong' } as const

describe('TC-F44-01 / TC-F44-02: availability window (closing bound only; no start bound by product decision)', () => {
    it('is open up to 15/11/2026 23:59:59 MYT', () => {
        expect(isFeedbackWindowOpen(Date.UTC(2026, 10, 15, 15, 59, 59))).toBe(true)
        expect(isFeedbackWindowOpen(Date.UTC(2026, 9, 29, 0, 0, 0))).toBe(true)
    })
    it('is closed from 16/11/2026 00:00 MYT', () => {
        expect(isFeedbackWindowOpen(Date.UTC(2026, 10, 15, 16, 0, 0))).toBe(false)
    })
})

describe('TC-F44-04: types per store', () => {
    it('migrated store sees 3 types, new store has no data mismatch', () => {
        expect(feedbackTypesFor(true)).toEqual(['problem', 'mismatch', 'suggestion'])
        expect(feedbackTypesFor(false)).toEqual(['problem', 'suggestion'])
    })
})

describe('TC-F44-06 / TC-F44-10: schema', () => {
    it('accepts several features and rejects none, duplicates or unknown ones', () => {
        expect(feedbackSchema.safeParse(valid).success).toBe(true)
        expect(feedbackSchema.safeParse({ ...valid, areas: [] }).success).toBe(false)
        expect(feedbackSchema.safeParse({ ...valid, areas: ['orders', 'orders'] }).success).toBe(false)
        expect(feedbackSchema.safeParse({ ...valid, areas: ['nope'] }).success).toBe(false)
    })
    it('enforces details 10..2000 chars', () => {
        expect(feedbackSchema.safeParse({ ...valid, details: 'x'.repeat(9) }).success).toBe(false)
        expect(feedbackSchema.safeParse({ ...valid, details: 'x'.repeat(2000) }).success).toBe(true)
        expect(feedbackSchema.safeParse({ ...valid, details: 'x'.repeat(2001) }).success).toBe(false)
    })
    it('caps screenshots at 9 and requires a UUID v4 idempotency key', () => {
        const tokens = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`)
        expect(feedbackSchema.safeParse({ ...valid, screenshotTokens: tokens(9) }).success).toBe(true)
        expect(feedbackSchema.safeParse({ ...valid, screenshotTokens: tokens(10) }).success).toBe(false)
        expect(uuidV4Schema.safeParse(KEY).success).toBe(true)
        expect(uuidV4Schema.safeParse('not-a-uuid').success).toBe(false)
    })
})

describe('TC-F44-19: Lark record fields', () => {
    const meta = { feedbackId: 'FB-26-000001', tenantId: '7', storeName: 'Kedai A', reporterId: '42', reporterName: 'Ana Lee', reporterRole: 'owner' }
    it('maps multi-select features, attachments and reporter data', () => {
        const fields = toLarkFields({ ...valid, areas: ['orders', 'design'], screenshotTokens: ['a', 'b'] }, meta)
        expect(fields).toMatchObject({
            'Feedback ID': 'FB-26-000001',
            Type: 'Report a problem',
            Feature: ['Orders', 'Design & pages'],
            Store: 'Kedai A',
            'Store ID': '7',
            'User ID': '42',
            Reporter: 'Ana Lee',
            Role: 'owner',
            Status: 'New',
            Screenshots: [{ file_token: 'a' }, { file_token: 'b' }],
        })
    })
    it('reads reporter from the session user and omits missing values', () => {
        expect(extractReporter({ id: 42, firstName: 'Ana', lastName: 'Lee', tenants: [{ role: 'owner' }] })).toEqual({
            reporterId: '42', reporterName: 'Ana Lee', reporterRole: 'owner',
        })
        const fields = toLarkFields(valid, { ...meta, tenantId: null, storeName: null, reporterId: null, reporterName: null, reporterRole: null })
        expect(Object.keys(fields)).not.toEqual(expect.arrayContaining(['Store', 'Store ID', 'User ID', 'Reporter', 'Role', 'Screenshots']))
    })
    it('builds a stable FB-YY-NNNNNN id from the idempotency key', () => {
        const id = buildFeedbackId(KEY, new Date('2026-10-30T00:00:00Z'))
        expect(id).toMatch(/^FB-26-\d{6}$/)
        expect(buildFeedbackId(KEY.toUpperCase(), new Date('2026-10-30T00:00:00Z'))).toBe(id)
    })
})

describe('TC-F44-12: idempotent submit', () => {
    const meta = { tenantId: '7', storeName: null, reporterId: '1', reporterName: null, reporterRole: null }
    const cfg = { appToken: 'a', tableId: 't' }
    beforeEach(() => {
        vi.mocked(createBaseRecord).mockReset()
        clearFeedbackBlocks()
    })

    it('sends the key as client_token and returns the same feedback id on a retry', async () => {
        vi.mocked(createBaseRecord).mockResolvedValue({ recordId: 'rec1' })
        const first = await submitFeedbackToLarkBase(valid, KEY, meta, cfg)
        const again = await submitFeedbackToLarkBase(valid, KEY, meta, cfg)
        expect(again).toEqual(first)
        expect(vi.mocked(createBaseRecord).mock.calls[1][0]).toMatchObject({ clientToken: KEY })
    })
    it('rethrows Lark errors', async () => {
        vi.mocked(createBaseRecord).mockRejectedValueOnce(new Error('lark'))
        await expect(submitFeedbackToLarkBase(valid, KEY, meta, cfg)).rejects.toThrow()
    })
    it('lets only the first claim of a key count against the rate limit', async () => {
        expect(await claimFeedbackKey(KEY)).toBe(true)
        expect(await claimFeedbackKey(KEY.toUpperCase())).toBe(false)
        expect(await claimFeedbackKey('0a1b2c3d-5d4a-4b6f-9a7e-1c2d3e4f5a6b')).toBe(true)
    })
})

describe('TC-F44-11: spam guard', () => {
    beforeEach(() => clearFeedbackBlocks())

    it('blocks a user after the 5th successful submit, others stay free', async () => {
        const user = feedbackGuardKey(1)
        for (let i = 1; i < SUBMIT_LIMIT; i++) {
            await recordFeedbackSubmit(user)
            expect(await getFeedbackBlockSeconds(user)).toBeNull()
        }
        await recordFeedbackSubmit(user)
        const secs = await getFeedbackBlockSeconds(user)
        expect(secs).toBeGreaterThan(0)
        expect(secs).toBeLessThanOrEqual(15 * 60)
        expect(await getFeedbackBlockSeconds(feedbackGuardKey(2))).toBeNull()
    })
})
