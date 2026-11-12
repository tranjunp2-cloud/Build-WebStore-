/**
 * TC-PERF-147 — The Xendit callback token is checked against the shop of the order the event updates: one shop's
 * token can no longer mark another shop's order paid (invoice `external_id` + `data.reference_id` mix, payment
 * request id lookups).
 * TC-PERF-148 — A paid event reconciles only when the paid amount and currency are present and equal the order's.
 * TC-PERF-149 — Events that name no order of ours are accepted with the platform token only and change nothing;
 * a repeated paid event reaches the single idempotent reconcile.
 * Real: the webhook route + payment handlers. Faked: Payload (orders / tenants rows), reconcileOrderPaid.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const orders: Record<number, Record<string, unknown>> = {}
const tenants: Record<number, Record<string, unknown>> = {}
const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
    const row = collection === 'orders' ? orders[Number(id)] : tenants[Number(id)]
    if (!row) throw new Error('Not Found')
    return { ...row }
})
const find = vi.fn(async ({ where }: { where: { xenditPaymentRequestId?: { equals: string } } }) => ({
    docs: Object.values(orders).filter((o) => o.xenditPaymentRequestId === where.xenditPaymentRequestId?.equals),
}))
const execute = vi.fn(async () => ({ rows: [] }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID, find, db: { drizzle: { execute } } })) }))
vi.mock('@payload-config', () => ({ default: {} }))
const reconcileOrderPaid = vi.fn(async () => ({ status: 'reconciled' }))
vi.mock('@/lib/payment/reconcile-order-paid', () => ({ reconcileOrderPaid: (...a: unknown[]) => reconcileOrderPaid(...a) }))

import { POST } from '@/app/api/webhooks/xendit/route'
import { paidAmountMatches } from '@/app/api/webhooks/xendit/handlers/payment-updated'

const SHOP_A_TOKEN = 'token-of-shop-a-000000000000'
const SHOP_B_TOKEN = 'token-of-shop-b-111111111111'
const PLATFORM_TOKEN = 'platform-master-token-22222'

const webhook = (body: Record<string, unknown>, token: string) =>
    POST(new Request('http://app.test/api/webhooks/xendit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-callback-token': token },
        body: JSON.stringify(body),
    }))

beforeEach(() => {
    vi.stubEnv('XENDIT_WEBHOOK_TOKEN', PLATFORM_TOKEN)
    for (const k of Object.keys(orders)) delete orders[Number(k)]
    tenants[1] = { id: 1, xenditCallbackToken: SHOP_A_TOKEN }
    tenants[2] = { id: 2, xenditCallbackToken: SHOP_B_TOKEN }
    orders[100] = { id: 100, tenant: 1, total: 59.9, currency: 'MYR', status: 'pending', xenditPaymentRequestId: 'inv-a' } // victim (shop A)
    orders[200] = { id: 200, tenant: 2, total: 1, currency: 'MYR', status: 'pending', xenditPaymentRequestId: 'inv-b' } // attacker (shop B)
    reconcileOrderPaid.mockClear()
    execute.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('cross-shop forgery [TC-PERF-147]', () => {
    it('refuses an invoice for shop A\'s order signed with shop B\'s token (B\'s order named in data.reference_id)', async () => {
        // Arrange — the old check verified the token against data.reference_id (B), then paid external_id (A)
        const body = { external_id: '100', id: 'inv-a', status: 'PAID', amount: 59.9, currency: 'MYR', data: { reference_id: '200' } }

        // Act
        const res = await webhook(body, SHOP_B_TOKEN)

        // Assert
        expect(res.status).toBe(401)
        expect(reconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('refuses a payment event that reaches shop A\'s order through its payment request id with shop B\'s token', async () => {
        const body = { event: 'payment_request.succeeded', data: { reference_id: 'not-an-order', payment_request_id: 'inv-a', amount: 59.9, currency: 'MYR' } }

        const res = await webhook(body, SHOP_B_TOKEN)

        expect(res.status).toBe(401)
        expect(reconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('refuses the platform token on a shop order (per-shop token only)', async () => {
        const res = await webhook({ external_id: '100', id: 'inv-a', status: 'PAID', amount: 59.9, currency: 'MYR' }, PLATFORM_TOKEN)

        expect(res.status).toBe(401)
    })

    it('reconciles shop A\'s order with shop A\'s token and the exact amount', async () => {
        const res = await webhook({ external_id: '100', id: 'inv-a', status: 'PAID', amount: 59.9, currency: 'MYR' }, SHOP_A_TOKEN)

        expect(res.status).toBe(200)
        expect(reconcileOrderPaid).toHaveBeenCalledTimes(1)
        expect(reconcileOrderPaid).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 100, source: 'webhook' }))
    })
})

describe('paid amount and currency are required [TC-PERF-148]', () => {
    it.each([
        ['no amount', { currency: 'MYR' }],
        ['another amount', { amount: 1, currency: 'MYR' }],
        ['no currency', { amount: 59.9 }],
        ['another currency', { amount: 59.9, currency: 'IDR' }],
    ])('does not mark the order paid with %s (invoice)', async (_label, extra) => {
        const res = await webhook({ external_id: '100', id: 'inv-a', status: 'PAID', ...extra }, SHOP_A_TOKEN)

        expect(res.status).toBe(200) // acknowledged, so Xendit does not retry
        expect(reconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('does not mark the order paid when a payment event leaves out amount', async () => {
        const body = { event: 'payment_request.succeeded', data: { reference_id: '100', payment_request_id: 'inv-a', currency: 'MYR' } }

        await webhook(body, SHOP_A_TOKEN)

        expect(reconcileOrderPaid).not.toHaveBeenCalled()
    })

    it('accepts a v3 capture that names the amount request_amount', async () => {
        const body = { event: 'payment.capture', data: { reference_id: '100', payment_request_id: 'inv-a', request_amount: '59.90', currency: 'myr' } }

        await webhook(body, SHOP_A_TOKEN)

        expect(reconcileOrderPaid).toHaveBeenCalledTimes(1)
    })

    it('compares in cents', () => {
        const order = { id: 1, total: 59.9, status: 'pending', currency: 'MYR', tenantId: 1 }
        expect(paidAmountMatches(order, 59.9, 'MYR')).toBe(true)
        expect(paidAmountMatches(order, 59.89, 'MYR')).toBe(false)
        expect(paidAmountMatches(order, undefined, 'MYR')).toBe(false)
        expect(paidAmountMatches(order, 'abc', 'MYR')).toBe(false)
    })
})

describe('events without an order of ours, repeats [TC-PERF-149]', () => {
    it('accepts a Dashboard test ping with the platform token and changes nothing', async () => {
        const res = await webhook({ external_id: 'invoice_123_test', id: 'x', status: 'PAID', amount: 1, currency: 'MYR' }, PLATFORM_TOKEN)

        expect(res.status).toBe(200)
        expect(reconcileOrderPaid).not.toHaveBeenCalled()
        expect(execute).not.toHaveBeenCalled()
    })

    it('refuses a shop token on an event that names no order of ours', async () => {
        const res = await webhook({ external_id: 'invoice_123_test', id: 'x', status: 'PAID' }, SHOP_A_TOKEN)

        expect(res.status).toBe(401)
    })

    it('hands a repeated paid event to the same single-winner reconcile (idempotent there)', async () => {
        const body = { external_id: '100', id: 'inv-a', status: 'PAID', amount: 59.9, currency: 'MYR' }

        await webhook(body, SHOP_A_TOKEN)
        await webhook(body, SHOP_A_TOKEN)

        expect(reconcileOrderPaid).toHaveBeenCalledTimes(2)
        for (const call of reconcileOrderPaid.mock.calls) expect((call as unknown[])[1]).toMatchObject({ orderId: 100 })
    })

    it('expires only the verified order', async () => {
        await webhook({ external_id: '100', id: 'inv-a', status: 'EXPIRED' }, SHOP_A_TOKEN)

        expect(execute).toHaveBeenCalledTimes(1)
        const query = (execute.mock.calls[0] as unknown[])[0] as { queryChunks: unknown[] }
        expect(query.queryChunks).toContain(100)
    })
})
