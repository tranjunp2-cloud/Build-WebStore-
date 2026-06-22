/**
 * Unit tests for discountAutoInactiveJob (src/lib/jobs/discount-auto-inactive.ts).
 *
 * TC-F33-12-01..03: the auto-deactivate sweep flips EXPIRED discounts to inactive in one
 * atomic UPDATE, maps RETURNING ids, and is a no-op when nothing matches. (Used-up is NOT
 * flipped — handled by the live badge + form guard so capacity can reopen; GH-1282 decision B.)
 */
// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'
import { discountAutoInactiveJob } from '@/lib/jobs/discount-auto-inactive'

function createMockPayload(rows: Array<{ id: number }>) {
    const execute = vi.fn().mockResolvedValue({ rows })
    const payload = {
        db: { drizzle: { execute } },
        logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    } as unknown as Payload
    return { payload, execute }
}

// ── TC-F33-12-01: flips matching rows + maps ids ─────────────────────────────
describe('discountAutoInactiveJob — TC-F33-12-01: flips expired', () => {
    it('returns the count + ids of deactivated discounts and logs', async () => {
        const { payload, execute } = createMockPayload([{ id: 7 }, { id: 12 }])

        const result = await discountAutoInactiveJob(payload)

        expect(execute).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ flipped: 2, ids: [7, 12] })
        expect((payload.logger.info as any)).toHaveBeenCalledOnce()
    })

    it('coerces string ids from the driver to numbers', async () => {
        const { payload } = createMockPayload([{ id: '9' as unknown as number }])
        const result = await discountAutoInactiveJob(payload)
        expect(result).toEqual({ flipped: 1, ids: [9] })
    })
})

// ── TC-F33-12-02: no-op when nothing matches ─────────────────────────────────
describe('discountAutoInactiveJob — TC-F33-12-02: no-op', () => {
    it('returns flipped:0 and does not log when no rows match', async () => {
        const { payload } = createMockPayload([])

        const result = await discountAutoInactiveJob(payload)

        expect(result).toEqual({ flipped: 0, ids: [] })
        expect((payload.logger.info as any)).not.toHaveBeenCalled()
    })

    it('tolerates a missing rows array from the driver', async () => {
        const execute = vi.fn().mockResolvedValue({})
        const payload = {
            db: { drizzle: { execute } },
            logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
        } as unknown as Payload

        const result = await discountAutoInactiveJob(payload)
        expect(result).toEqual({ flipped: 0, ids: [] })
    })
})

// ── TC-F33-12-03: single atomic statement ────────────────────────────────────
describe('discountAutoInactiveJob — TC-F33-12-03: atomicity', () => {
    it('performs exactly one UPDATE ... RETURNING statement', async () => {
        const { payload, execute } = createMockPayload([{ id: 1 }])
        await discountAutoInactiveJob(payload)
        expect(execute).toHaveBeenCalledTimes(1)
    })
})
