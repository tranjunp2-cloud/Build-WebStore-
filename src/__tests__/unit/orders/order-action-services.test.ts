/**
 * TC-AICP-162 — the order actions the Orders routes and the copilot share (lib/orders/*): each answers
 * `{ status, body }` exactly as its route sends it, so the copilot reads the dashboard's own refusals
 * (`failureOf`) instead of re-deciding them. Real: the services. Faked: Payload (in memory), emails, payments.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ order: null as Record<string, any> | null, updates: [] as Array<Record<string, any>> }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async () => (db.order ? { ...db.order } : null)),
        update: vi.fn(async ({ data }: { data: Record<string, any> }) => {
            db.updates.push(data)
            return { ...db.order, ...data }
        }),
        sendEmail: vi.fn(async () => undefined),
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/orders/update-order-status-email', () => ({ sendStatusEmail: vi.fn(async () => undefined) }))

import { failureOf, respond, succeeded } from '@/lib/orders/action-result'
import { selfDeliverOrderAs } from '@/lib/orders/self-deliver-order'
import { updateOrderStatusAs } from '@/lib/orders/update-order-status'

const user = { id: 1 } as never

beforeEach(() => {
    db.order = { id: 5, orderNumber: 'ORD-1', status: 'confirmed', tenant: 1 }
    db.updates = []
})

describe('shared order actions [TC-AICP-162]', () => {
    it('moves a status along the transition table and answers the route\'s body', async () => {
        const ok = await updateOrderStatusAs(user, '5', { status: 'ready_to_ship' })
        const bad = await updateOrderStatusAs(user, '5', { status: 'completed' })

        expect(succeeded(ok)).toBe(true)
        expect(ok).toMatchObject({ status: 200, body: { success: true } })
        expect(db.updates).toEqual([{ status: 'ready_to_ship' }])
        expect(bad.status).toBe(422)
        expect(failureOf(bad)).toEqual({ code: 'INVALID_TRANSITION', message: expect.stringContaining('Cannot transition from "confirmed" to "completed"') })
    })

    it('needs a tracking number to ship by status, and refuses a shipped-by-label order for self-delivery', async () => {
        db.order = { ...db.order!, status: 'ready_to_ship' }
        const noTracking = await updateOrderStatusAs(user, '5', { status: 'shipped' })
        db.order = { ...db.order!, easyParcelOrderNo: 'EP1' }
        const label = await selfDeliverOrderAs(user, '5', 'J&T', 'JT123')

        expect(failureOf(noTracking)).toEqual({ code: 'VALIDATION_ERROR', message: 'Tracking number is required when shipping' })
        expect(label).toMatchObject({ status: 422, body: { error: { code: 'EP_LABEL_EXISTS' } } })
    })

    it('self-delivers a confirmed order with the courier and tracking number', async () => {
        const result = await selfDeliverOrderAs(user, '5', 'J&T', 'JT123')

        expect(result).toMatchObject({ status: 200, body: { success: true, data: { status: 'shipped', selfDeliveryCourier: 'J&T', trackingNumber: 'JT123' } } })
        expect(db.updates[0]).toMatchObject({ status: 'shipped', selfDeliveryCourier: 'J&T', trackingNumber: 'JT123' })
    })

    it('reads a missing order as 404 and any odd body as a generic failure', async () => {
        db.order = null

        expect(failureOf(await selfDeliverOrderAs(user, '9', 'J&T', 'JT123'))).toEqual({ code: 'NOT_FOUND', message: 'Order not found' })
        expect(failureOf(respond({ success: false }, { status: 500 }))).toEqual({ code: 'FAILED', message: 'The order could not be updated.' })
        expect(succeeded(respond({ success: false }))).toBe(false)
    })
})
