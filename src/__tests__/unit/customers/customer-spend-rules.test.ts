import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { countsTowardSpending, isFailedOrder, LIFETIME_SQL, FAILED_COUNT_SQL } from '@/lib/customers/customer-spend-rules'

const render = (q: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(q).sql

describe('customer-spend-rules [TC-F25-28]', () => {
    it.each([
        [{ status: 'completed', paymentStatus: 'pending' }, true],
        [{ status: 'processing', paymentStatus: 'paid' }, true],
        [{ status: 'cancelled', paymentStatus: 'paid' }, false],
        [{ status: 'refunded', paymentStatus: 'paid' }, false],
        [{ status: 'payment_failed', paymentStatus: 'payment_failed' }, false],
        [{ status: 'pending', paymentStatus: 'pending' }, false],
    ])('countsTowardSpending(%j) = %s', (order, expected) => {
        expect(countsTowardSpending(order)).toBe(expected)
    })

    it('failed = cancelled + payment_failed only', () => {
        expect(isFailedOrder({ status: 'cancelled' })).toBe(true)
        expect(isFailedOrder({ status: 'payment_failed' })).toBe(true)
        expect(isFailedOrder({ status: 'refunded' })).toBe(false)
        expect(isFailedOrder({ status: 'pending' })).toBe(false)
    })

    it('SQL fragments mirror the JS rule so list sort, detail, CSV and agent agree', () => {
        const lifetime = render(LIFETIME_SQL)
        expect(lifetime).toContain("o.status NOT IN ('cancelled', 'refunded')")
        expect(lifetime).toContain("o.payment_status = 'paid' OR o.status = 'completed'")
        expect(render(FAILED_COUNT_SQL)).toContain("o.status IN ('cancelled', 'payment_failed')")
    })
})
