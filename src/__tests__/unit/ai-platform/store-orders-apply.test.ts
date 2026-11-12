/**
 * TC-AICP-168..171 — applying a drafted order change (`store.orders_patch`), its undo (`store.orders_restore`)
 * and the agent-tool facade:
 *   168  the apply: every step runs the order service the dashboard route calls (confirm / complete = status
 *        update, ship = self-deliver, payment proof, cancel, refund), as the approver in the drafted workspace
 *        with the Orders permission; 409 when an order changed after the draft
 *   169  a step that fails: before anything ran the card stays approvable with the dashboard's message; after
 *        others ran it closes (final) and says what was done
 *   170  undo: only ship steps can be put back, and only while nobody touched the order since
 *   171  the facade: store.orders / store.prepare_orders, a refused role answered as data, the dispatch of
 *        the approved change and of its undo
 * Real: appliers/store-orders.ts, store-orders*.ts, the facade, appliers/index.ts, record-edits.ts.
 * Faked: Payload (in memory), the order services (their routes are tested by their own suites), the user's tenant.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { tenantIdForQuery } from '@/lib/auth'
import { prepareStoreOrders } from '@/lib/ai-platform/store/store-orders-prepare'
import { OWNER, plan, reset, state, STAFF_WITHOUT_ORDERS, VIEWER } from './store-orders-fixtures'

const svc = vi.hoisted(() => ({ status: vi.fn(), ship: vi.fn(), approve: vi.fn(), reject: vi.fn(), cancel: vi.fn(), refund: vi.fn() }))

vi.mock('payload', async () => ({ getPayload: async () => (await import('./store-orders-fixtures')).cms }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ tenantIdForQuery: vi.fn(() => 1) }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/subscriptions/plan-subscription', async () => ({
    getActivePlanSubscription: vi.fn(async () => ((await import('./store-orders-fixtures')).plan.allowed ? { plan: 'PRO' } : null)),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/orders/update-order-status', () => ({ updateOrderStatusAs: svc.status }))
vi.mock('@/lib/orders/self-deliver-order', () => ({ selfDeliverOrderAs: svc.ship }))
vi.mock('@/lib/orders/approve-payment', () => ({ approvePaymentAs: svc.approve }))
vi.mock('@/lib/orders/reject-payment', () => ({ rejectPaymentAs: svc.reject }))
vi.mock('@/lib/orders/cancel-order', () => ({ cancelOrderAs: svc.cancel }))
vi.mock('@/lib/orders/refund-order', () => ({ refundOrderAs: svc.refund }))

const ok = { status: 200, body: { success: true } }
const card = async (changes: unknown[]) => ((await prepareStoreOrders(OWNER, { why: 'x', changes })) as any)
// the drafted card: its plan, and the order number to type for money steps (checked again by the applier)
const apply = (drafted: { plan: unknown; confirmText?: string }, actor = OWNER) =>
    applyChangeSet({ id: 'cs_1', ...(drafted.confirmText ? { confirmText: drafted.confirmText } : {}), action: { kind: 'store.orders_patch', payload: drafted.plan } } as never, actor)
const order = (id: number) => state.orders.find((o) => o.id === id)!
const soon = () => new Date(Date.now() + 60_000).toISOString()

beforeEach(() => {
    reset()
    plan.allowed = true
    vi.clearAllMocks()
    vi.mocked(tenantIdForQuery).mockReturnValue(1)
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue(ok)
    svc.ship.mockImplementation(async (_user: unknown, id: string, courier: string, trackingNumber: string) => {
        Object.assign(order(Number(id)), { status: 'shipped', selfDeliveryCourier: courier, trackingNumber, shippingTrackingStatus: 'pending_pickup', updatedAt: `shipped-${id}` })
        return ok
    })
})

describe('applying an order change [TC-AICP-168]', () => {
    it('runs the dashboard\'s own order service for each step, as the approver', async () => {
        const good = await card([{ op: 'confirm', orderId: '1' }, { op: 'complete', orderId: '12' }, { op: 'approve_payment', orderId: '2' }])
        const applied = await apply(good)

        expect(svc.status).toHaveBeenCalledWith(OWNER.user, '1', { status: 'confirmed' })
        expect(svc.status).toHaveBeenCalledWith(OWNER.user, '12', { status: 'completed' })
        expect(svc.approve).toHaveBeenCalledWith(OWNER.user, '2')
        expect(applied.entities).toEqual([{ kind: 'store_order', id: '1' }, { kind: 'store_order', id: '12' }, { kind: 'store_order', id: '2' }])
        expect(applied.undo).toBeUndefined()
        // several orders open the list [TC-AICP-246]
        expect(applied.links).toEqual([{ label: 'Open orders', href: '/orders' }])
    })

    it('rejects a proof, ships, cancels and refunds through their services with the drafted values', async () => {
        await apply((await card([{ op: 'reject_payment', orderId: '2', reason: 'wrong_amount' }, { op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }])))
        await apply((await card([{ op: 'cancel', orderId: '1', reason: 'Customer changed their mind' }])))
        await apply((await card([{ op: 'refund', orderId: '5' }])))

        expect(svc.reject).toHaveBeenCalledWith(OWNER.user, '2', { reason: 'wrong_amount' })
        expect(svc.ship).toHaveBeenCalledWith(OWNER.user, '3', 'J&T', 'JT00123')
        expect(svc.cancel).toHaveBeenCalledWith(OWNER.user, '1', 'Customer changed their mind')
        expect(svc.refund).toHaveBeenCalledWith(OWNER.user, '5', 'REQUESTED_BY_CUSTOMER')
    })

    it('opens the order\'s own page for a one-order change [TC-AICP-246]', async () => {
        const applied = await apply((await card([{ op: 'confirm', orderId: '1' }])))

        expect(applied.links).toEqual([{ label: 'Open order', href: '/orders/1' }])
    })

    it('refuses a viewer approving a cancel, refund or payment step, also at apply time [TC-AICP-256]', async () => {
        const cancel = await card([{ op: 'cancel', orderId: '1', reason: 'x' }])
        const approve = await card([{ op: 'approve_payment', orderId: '2' }])
        const confirm = await card([{ op: 'confirm', orderId: '1' }])

        await expect(apply(cancel, VIEWER)).rejects.toMatchObject({ status: 403, message: expect.stringContaining("can't cancel, refund or check payments") })
        await expect(apply(approve, VIEWER)).rejects.toMatchObject({ status: 403 })
        expect(svc.cancel).not.toHaveBeenCalled()
        expect(svc.approve).not.toHaveBeenCalled()
        // like the dashboard, a viewer's confirm goes through
        await apply(confirm, VIEWER)
        expect(svc.status).toHaveBeenCalledTimes(1)
    })

    it('touches nothing when an order changed after the draft (409)', async () => {
        const drafted = await card([{ op: 'confirm', orderId: '1' }, { op: 'cancel', orderId: '8', reason: 'x' }])
        order(8).updatedAt = 'edited-meanwhile'

        await expect(apply(drafted)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('changed after') })
        expect(svc.status).not.toHaveBeenCalled()
        expect(svc.cancel).not.toHaveBeenCalled()
    })

    it('needs the workspace it was drafted in and the Orders permission of the approver', async () => {
        const drafted = await card([{ op: 'confirm', orderId: '1' }])
        vi.mocked(tenantIdForQuery).mockReturnValue(2)
        await expect(apply(drafted)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Switch to the workspace') })
        vi.mocked(tenantIdForQuery).mockReturnValue(1)
        await expect(apply(drafted, STAFF_WITHOUT_ORDERS)).rejects.toMatchObject({ status: 403 })
        plan.allowed = false
        await expect(apply(drafted)).rejects.toMatchObject({ status: 403 })

        expect(svc.status).not.toHaveBeenCalled()
    })
})

describe('a step that fails [TC-AICP-169]', () => {
    const refused = (message: string, status = 422) => ({ status, body: { success: false, error: { code: 'X', message } } })

    it('before anything ran: the dashboard\'s message, and the card can be approved again', async () => {
        svc.status.mockResolvedValue(refused('Cannot transition from "confirmed" to "confirmed".'))

        const error = await apply((await card([{ op: 'confirm', orderId: '1' }, { op: 'ship', orderId: '1', courier: 'J&T', trackingNumber: 'JT00123' }]))).catch((e) => e)

        expect(error).toBeInstanceOf(ChangeSetApplyError)
        expect(error).toMatchObject({ status: 422, final: false, message: 'ORD-K3F2: Cannot transition from "confirmed" to "confirmed".' })
        expect(svc.ship).not.toHaveBeenCalled()
    })

    it('after others ran: closes the card and lists what was done', async () => {
        svc.cancel.mockResolvedValue(refused('Refund could not be processed — cancellation aborted.', 502))

        const error = await apply((await card([{ op: 'confirm', orderId: '1' }, { op: 'cancel', orderId: '3', reason: 'x' }]))).catch((e) => e)

        expect(error).toMatchObject({ final: true, message: expect.stringContaining('Refund could not be processed') })
        expect(error.message).toContain('Done before it: ORD-K3F2 confirmed')
        expect(error.message).toContain('ask again')
    })

    it('closes the card when Xendit did not answer a refund: the order stays refunded and the card says so [TC-AICP-262]', async () => {
        svc.refund.mockResolvedValue({ status: 502, body: { success: false, error: { code: 'XENDIT_REFUND_UNKNOWN', message: 'The refund was sent to Xendit but Xendit did not answer. Check the Xendit dashboard.' } } })

        const error = await apply((await card([{ op: 'refund', orderId: '11' }]))).catch((e) => e)

        expect(error).toBeInstanceOf(ChangeSetApplyError)
        expect(error).toMatchObject({ final: true, message: 'ORD-XENDIT: The refund was sent to Xendit but Xendit did not answer. Check the Xendit dashboard.' })
    })

    it('answers a vanished order as "changed after the draft"', async () => {
        svc.status.mockResolvedValue(refused('Order not found', 404))

        await expect(apply((await card([{ op: 'confirm', orderId: '1' }])))).rejects.toMatchObject({ status: 409 })
    })
})

describe('undo of an order change [TC-AICP-170]', () => {
    const shipPlan = () => card([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }, { op: 'ship', orderId: '10', courier: 'Pos', trackingNumber: 'PS0002' }])

    it('offers an undo only when every step can be put back (ship)', async () => {
        // drafted first: applying a ship moves the order on
        const drafts = [await shipPlan(), await card([{ op: 'cancel', orderId: '1', reason: 'x' }]), await card([{ op: 'confirm', orderId: '1' }, { op: 'ship', orderId: '1', courier: 'J&T', trackingNumber: 'JT00123' }])]
        const [undoable, money, mixed] = [await apply(drafts[0]), await apply(drafts[1]), await apply(drafts[2])]

        expect(undoable.undo).toMatchObject({ kind: 'store.orders_restore', payload: { ops: [{ op: 'ship', id: 3, before: { status: 'confirmed', trackingNumber: null } }, { op: 'ship', id: 10, before: { status: 'confirmed', trackingNumber: null } }] } })
        expect(money.undo).toBeUndefined()
        expect(mixed.undo).toBeUndefined()
    })

    it('puts the status, courier and tracking number back', async () => {
        const result = await apply((await shipPlan()))

        await applyUndo({ ...result.undo!, until: soon() } as never, OWNER, 'cs_1')

        expect(order(3)).toMatchObject({ status: 'confirmed', selfDeliveryCourier: null, trackingNumber: null })
        expect(order(10)).toMatchObject({ status: 'confirmed', selfDeliveryCourier: null, trackingNumber: null })
    })

    it('refuses once the order was touched since (a courier update, an edit) and when it is no longer shipped', async () => {
        // drafted first: applying a ship moves the order on
        const first = await card([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }])
        const other = await card([{ op: 'ship', orderId: '10', courier: 'Pos', trackingNumber: 'PS0002' }])
        const result = await apply(first)
        const undo = { ...result.undo!, until: soon() } as never
        order(3).updatedAt = 'courier-webhook'

        await expect(applyUndo(undo, OWNER, 'cs_1')).rejects.toMatchObject({ status: 409, message: expect.stringContaining("can't be undone safely") })

        const second = await apply(other)
        order(10).status = 'completed'
        order(10).updatedAt = (second.undo!.payload as any).ops[0].updatedAt
        await expect(applyUndo({ ...second.undo!, until: soon() } as never, OWNER, 'cs_1')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('not shipped any more') })
    })
})

describe('order tools in the facade [TC-AICP-171]', () => {
    const call = (tool: string, body: unknown) => handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)

    it('reads the to-do summary and one order for the calling merchant', async () => {
        const todo = await (await call('store.orders', { view: 'needs_action' })).json()
        const one = await (await call('store.orders', { id: '3' })).json()

        expect(todo.toConfirm.orders.map((o: any) => o.orderNumber)).toEqual(['ORD-K3F2'])
        expect(one.order).toMatchObject({ orderNumber: 'ORD-STUCK' })
    })

    it('drafts a card, and answers a malformed or refused one as data the model can act on', async () => {
        const okCard = await (await call('store.prepare_orders', { why: 'Confirm it', changes: [{ op: 'confirm', orderId: '1' }] })).json()
        const bad = await call('store.prepare_orders', { why: 'x', changes: [{ op: 'ship', orderId: '3', courier: 'J&T' }] })
        const refused = await (await call('store.prepare_orders', { why: 'x', changes: [{ op: 'refund', orderId: '1' }] })).json()

        expect(okCard).toMatchObject({ kind: 'store.orders_patch', title: 'Confirm order ORD-K3F2' })
        expect(bad.status).toBe(200)
        expect(await bad.json()).toMatchObject({ error: { code: 'invalid_input' } })
        expect(refused).toMatchObject({ error: { code: 'order_step_refused' } })
    })

    it('answers a role without the Orders permission as data (not a crash)', async () => {
        vi.mocked(resolveToolActor).mockResolvedValue(STAFF_WITHOUT_ORDERS)

        const res = await call('store.orders', {})

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ error: { code: 'orders_forbidden' } })
    })

    it('dispatches the approved change and its undo to the order applier', async () => {
        const drafted = await card([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }])
        const result = await applyChangeSet({ id: 'cs_1', action: { kind: 'store.orders_patch', payload: drafted.plan } } as never, OWNER)

        expect(result.undo).toMatchObject({ kind: 'store.orders_restore' })
        await applyUndo({ ...result.undo!, until: soon() } as never, OWNER, 'cs_1')
        expect(order(3).status).toBe('confirmed')
    })
})

describe('order card hardening [TC-AISEC-104, TC-AISEC-105, TC-AISEC-107, TC-AISEC-116]', () => {
    const refused = (message: string, status = 422) => ({ status, body: { success: false, error: { code: 'X', message } } })

    it('refuses a cancel / refund / payment approval that carries no text to type, before any order service runs [TC-AISEC-116]', async () => {
        const drafted = await card([{ op: 'refund', orderId: '5' }])

        const error = await apply({ plan: drafted.plan }).catch((e) => e)

        expect(error).toBeInstanceOf(ChangeSetApplyError)
        expect(error).toMatchObject({ status: 422, message: expect.stringContaining('confirmation text') })
        expect(svc.refund).not.toHaveBeenCalled()
        // a confirm or ship needs no typed text
        await apply({ plan: (await card([{ op: 'confirm', orderId: '1' }])).plan })
        expect(svc.status).toHaveBeenCalledTimes(1)
    })

    it('closes (final, stale) a card whose order changed after the draft instead of leaving it pending [TC-AISEC-107]', async () => {
        const drafted = await card([{ op: 'confirm', orderId: '1' }])
        order(1).updatedAt = 'edited-meanwhile'

        const error = await apply(drafted).catch((e) => e)

        expect(error).toMatchObject({ status: 409, final: true, stale: true, message: expect.stringContaining('changed after') })
        expect(svc.status).not.toHaveBeenCalled()
    })

    it('keeps a transient refusal approvable (wrong workspace is not final) [TC-AISEC-107]', async () => {
        const drafted = await card([{ op: 'confirm', orderId: '1' }])
        vi.mocked(tenantIdForQuery).mockReturnValue(2)

        const error = await apply(drafted).catch((e) => e)

        expect(error).toMatchObject({ status: 409, final: false })
    })

    it('a later step fails after a ship ran: the error carries the ship\'s undo, so the card keeps it [TC-AISEC-105]', async () => {
        svc.refund.mockResolvedValue(refused('Refund could not be processed.', 502))
        const drafted = await card([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }, { op: 'refund', orderId: '5' }])

        const error = await apply(drafted).catch((e) => e)

        expect(error).toMatchObject({ final: true, message: expect.stringContaining('Done before it: ORD') })
        expect(error.partial).toMatchObject({ entities: [{ kind: 'store_order', id: '3' }], undo: { kind: 'store.orders_restore', payload: { ops: [{ op: 'ship', id: 3, before: { status: 'confirmed' } }] } } })
        // the kept undo still works
        await applyUndo({ ...error.partial.undo, until: soon() } as never, OWNER, 'cs_1')
        expect(order(3)).toMatchObject({ status: 'confirmed', trackingNumber: null })
    })

    it('an undo that already ran (record lost, second tab) succeeds again without writing [TC-AISEC-104]', async () => {
        const result = await apply(await shipPlanFor('3'))
        const undo = { ...result.undo!, until: soon() } as never
        await applyUndo(undo, OWNER, 'cs_1')
        const after = { ...order(3) }

        await expect(applyUndo(undo, OWNER, 'cs_1')).resolves.toMatchObject({ links: [{ href: '/orders' }] })

        expect(order(3)).toEqual(after)
    })

    const shipPlanFor = (id: string) => card([{ op: 'ship', orderId: id, courier: 'J&T', trackingNumber: 'JT00123' }])
})
