/**
 * TC-AICP-163..167 — the shop's orders through the copilot (store.orders / store.prepare_orders,
 * `store.orders_patch`):
 *   163  the read: today's to-do summary, the filtered list (status group, payment, shop days, customer),
 *        one order in full with what can be done to it
 *   164  who may: the Orders permission of the workspace and an order-management plan, on reads and drafts;
 *        another workspace's order does not exist
 *   165  the status cards: confirm / ship (courier + tracking number the merchant gave) / complete, the Orders
 *        page's rules (payment first, no EasyParcel label, own delivery only), the undo flag
 *   166  the payment proof cards: approve / reject (reason enum, detail for "other"), confirm points to them
 *   167  cancel and refund: the order number typed, one per card, where the money goes per payment method,
 *        the label and status guards
 * Real: store-orders.ts, store-orders-prepare.ts, order-access.ts, status groups, date helpers.
 * Faked: Payload (in memory, tenant-scoped), the plan subscription.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdersToolError, readStoreOrders } from '@/lib/ai-platform/store/store-orders'
import { prepareStoreOrders } from '@/lib/ai-platform/store/store-orders-prepare'
import { EDITOR, NOW, OWNER, plan, reset, STAFF_WITH_ORDERS, STAFF_WITHOUT_ORDERS, VIEWER } from './store-orders-fixtures'

vi.mock('payload', async () => ({ getPayload: async () => (await import('./store-orders-fixtures')).cms }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', async () => ({
    getActivePlanSubscription: vi.fn(async () => ((await import('./store-orders-fixtures')).plan.allowed ? { plan: 'PRO' } : null)),
    canUse: vi.fn(async () => true),
}))

const read = (input: Record<string, unknown> = {}) => readStoreOrders(OWNER, input, NOW) as Promise<any>
const prepare = (changes: unknown[], actor = OWNER) => prepareStoreOrders(actor, { why: 'Because', changes }) as Promise<any>
const numbers = (list: Array<{ orderNumber: string }>) => list.map((o) => o.orderNumber)

beforeEach(() => {
    reset()
    plan.allowed = true
})

describe('reading orders [TC-AICP-163]', () => {
    it('summarises what needs action: pending to confirm, proofs to check, confirmed for over a day, delivery problems', async () => {
        const res = await read({ view: 'needs_action' })

        // the COD order is the merchant's to confirm; a transfer waiting for its proof / money and an unpaid FPX order are not
        expect(numbers(res.toConfirm.orders)).toEqual(['ORD-K3F2'])
        expect(numbers(res.paymentProofsToCheck.orders)).toEqual(['ORD-PROOF'])
        expect(res.paymentProofsToCheck.count).toBe(1)
        expect(numbers(res.confirmedNotShippedOver24h.orders)).toEqual(['ORD-STUCK'])
        expect(numbers(res.shippedWithDeliveryProblem.orders)).toEqual(['ORD-LOST'])
        expect(res.shop).toMatchObject({ timezone: 'Asia/Kuala_Lumpur', today: '2026-10-22' })
    })

    it('lists by status group with counts, and finds by customer words', async () => {
        const shipped = await read({ status: 'shipped' })
        const byName = await read({ query: 'wei ling' })

        expect(numbers(shipped.orders).sort()).toEqual(['ORD-LOST', 'ORD-SELF'])
        expect(shipped.counts).toMatchObject({ pending: 4, confirmed: 3, shipped: 2, completed: 2 })
        expect(numbers(byName.orders)).toEqual(['ORD-PROOF'])
        expect(shipped.orders[0]).toMatchObject({ total: 'RM 120.00', statusText: 'Shipped' })
    })

    it('filters by payment status, payment method and the shop\'s days', async () => {
        const proofs = await read({ paymentStatus: 'pending_verification' })
        const cod = await read({ paymentMethod: 'cod', status: 'pending' })
        // ORD-DONE was placed 200 hours before NOW (14 Oct 2026, shop time)
        const oldDay = await read({ from: '2026-10-14', to: '2026-10-14' })
        const none = await read({ from: '2026-10-23' })

        expect(numbers(proofs.orders)).toEqual(['ORD-PROOF'])
        expect(numbers(cod.orders)).toEqual(['ORD-K3F2'])
        expect(numbers(oldDay.orders)).toEqual(['ORD-DONE'])
        expect(none.orders).toEqual([])
    })

    it('reads one order in full by id or number, with what can be done to it', async () => {
        const byId = await read({ id: 3 })
        const byNumber = await read({ orderNumber: 'ord-k3f2' })

        expect(byId.order).toMatchObject({ orderNumber: 'ORD-STUCK', totals: { total: 'RM 120.00', shipping: 'RM 20.00' }, items: [{ name: 'Batik shirt', variant: 'M', quantity: 2, lineTotal: 'RM 100.00' }] })
        expect(byId.order.canDo).toMatchObject({ ship: true, cancel: true, refund: expect.stringContaining('Only shipped or completed') })
        expect(byNumber.order.canDo.confirm).toBe(true)
        expect((await read({ id: 12 })).order.canDo.complete).toBe(true)
        expect((await read({ id: 7 })).order.canDo).toMatchObject({ ship: expect.stringContaining('EasyParcel'), cancel: expect.stringContaining('EasyParcel') })
        expect((await read({ id: 2 })).order.canDo.confirm).toContain('payment proof')
    })
})

describe('who may use the order tools [TC-AICP-164]', () => {
    it('refuses a role without the Orders permission, on reads and drafts', async () => {
        await expect(readStoreOrders(STAFF_WITHOUT_ORDERS, {}, NOW)).rejects.toMatchObject({ code: 'orders_forbidden' })
        await expect(prepare([{ op: 'confirm', orderId: '1' }], STAFF_WITHOUT_ORDERS)).rejects.toBeInstanceOf(OrdersToolError)
        expect(await readStoreOrders(STAFF_WITH_ORDERS, { view: 'needs_action' }, NOW)).toHaveProperty('toConfirm')
    })

    it('refuses a workspace whose plan has no order management', async () => {
        plan.allowed = false

        await expect(read()).rejects.toMatchObject({ code: 'orders_plan' })
    })

    it('does not know another workspace\'s order', async () => {
        expect(await read({ id: 6 })).toMatchObject({ error: { code: 'unknown_order' } })
        expect(await prepare([{ op: 'confirm', orderId: '6' }])).toMatchObject({ error: { code: 'unknown_order' } })
    })
})

describe('status cards [TC-AICP-165]', () => {
    it('drafts a confirm with before → after, the buyer email noted and the order version kept', async () => {
        const card = await prepare([{ op: 'confirm', orderId: '1' }])

        expect(card).toMatchObject({ kind: 'store.orders_patch', title: 'Confirm order ORD-K3F2', risk: 'medium' })
        expect(card.diffs).toEqual([{ entity: { kind: 'store_order', id: '1', label: expect.stringContaining('ORD-K3F2 · RM 120.00') }, field: 'Status', before: 'Pending', after: 'Confirmed' }])
        expect(card.guardrails.some((g: any) => g.detail.includes('buyer gets an email'))).toBe(true)
        expect(card.plan.base).toEqual({ '1': expect.any(String) })
        expect(card.plan.undoable).toBe(false)
        expect(card.confirmText).toBeUndefined()
    })

    it('ships with the courier and tracking number the merchant gave, and can be undone', async () => {
        const card = await prepare([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }])

        expect(card.title).toBe('Ship order ORD-STUCK')
        expect(card.diffs.map((d: any) => [d.field, d.before, d.after])).toEqual([['Status', 'Confirmed', 'Shipped'], ['Courier', null, 'J&T'], ['Tracking number', null, 'JT00123']])
        expect(card.plan).toMatchObject({ undoable: true, steps: [{ op: 'ship', orderId: 3, orderNumber: 'ORD-STUCK', courier: 'J&T', trackingNumber: 'JT00123' }] })
        expect(card.guardrails.find((g: any) => g.rule === 'undo')).toBeTruthy()
    })

    it('never invents a tracking number: a missing or too short one is not a valid card', async () => {
        await expect(prepare([{ op: 'ship', orderId: '3', courier: 'J&T' }])).rejects.toThrow()
        await expect(prepare([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: '1' }])).rejects.toThrow()
        await expect(prepare([{ op: 'ship', orderId: '3', courier: '', trackingNumber: 'JT00123' }])).rejects.toThrow()
    })

    it('runs the steps in order on the state each one leaves: confirm then ship in one card, ship before confirm refused', async () => {
        const ok = await prepare([{ op: 'confirm', orderId: '1' }, { op: 'ship', orderId: '1', courier: 'Pos Laju', trackingNumber: 'PL0001' }])
        const bad = await prepare([{ op: 'ship', orderId: '1', courier: 'Pos Laju', trackingNumber: 'PL0001' }])

        expect(ok.title).toBe('Change 1 order')
        expect(ok.plan.undoable).toBe(false)
        expect(ok.diffs.filter((d: any) => d.field === 'Status').map((d: any) => [d.before, d.after])).toEqual([['Pending', 'Confirmed'], ['Confirmed', 'Shipped']])
        expect(bad).toMatchObject({ error: { code: 'order_step_refused', message: expect.stringContaining('only a confirmed order can be shipped') } })
    })

    it('refuses an order that has an EasyParcel label (the courier moves it), and a repeated step', async () => {
        expect(await prepare([{ op: 'ship', orderId: '7', courier: 'J&T', trackingNumber: 'JT00123' }])).toMatchObject({ error: { message: expect.stringContaining('EasyParcel label') } })
        expect(await prepare([{ op: 'confirm', orderId: '1' }, { op: 'confirm', orderId: '1' }])).toMatchObject({ error: { code: 'order_step_refused' } })
    })

    it('completes only an order the shop delivered itself', async () => {
        const ok = await prepare([{ op: 'complete', orderId: '12' }])
        const courier = await prepare([{ op: 'complete', orderId: '3' }])

        expect(ok.diffs[0]).toMatchObject({ field: 'Status', before: 'Shipped', after: 'Completed' })
        expect(courier).toMatchObject({ error: { message: expect.stringContaining('own delivery') } })
    })

    it('has no order note step: a note can reach the buyer\'s emails [TC-AICP-255]', async () => {
        await expect(prepare([{ op: 'note', orderId: '1', note: 'Gift wrap please' }])).rejects.toThrow()
    })
})

describe('payment proof cards [TC-AICP-166]', () => {
    it('approves a bank-transfer proof: payment becomes paid and the pending order confirmed', async () => {
        const card = await prepare([{ op: 'approve_payment', orderId: '2' }])

        expect(card.title).toBe('Approve payment of order ORD-PROOF')
        expect(card.diffs.map((d: any) => [d.field, d.before, d.after])).toEqual([['Payment proof', 'Payment proof to check', 'Paid'], ['Status', 'Pending', 'Confirmed']])
        expect(card.plan.undoable).toBe(false)
    })

    it('rejects with a reason from the list; "other" needs a detail for the buyer', async () => {
        const ok = await prepare([{ op: 'reject_payment', orderId: '2', reason: 'wrong_amount' }])
        const noDetail = await prepare([{ op: 'reject_payment', orderId: '2', reason: 'other' }])
        const withDetail = await prepare([{ op: 'reject_payment', orderId: '2', reason: 'other', detail: 'The transfer is from another bank account name' }])

        expect(ok.diffs[0].after).toBe('Rejected: the amount is wrong')
        expect(ok.diffs.length).toBe(2)
        expect(ok.diffs[1]).toMatchObject({ field: 'Buyer', after: expect.stringContaining('new upload link') })
        expect(noDetail).toMatchObject({ error: { message: expect.stringContaining('detail of at least 10 characters') } })
        // the buyer reads the detail word for word: the card shows all of it, on its own row
        expect(withDetail.diffs[1]).toMatchObject({ field: 'Message to the buyer (emailed as written)', after: 'The transfer is from another bank account name' })
        await expect(prepare([{ op: 'reject_payment', orderId: '2', reason: 'not-on-the-list' }])).rejects.toThrow()
    })

    it('refuses an order with no proof waiting, and points confirm to the payment first', async () => {
        expect(await prepare([{ op: 'approve_payment', orderId: '1' }])).toMatchObject({ error: { message: expect.stringContaining('no bank-transfer payment proof') } })
        expect(await prepare([{ op: 'confirm', orderId: '2' }])).toMatchObject({ error: { message: expect.stringContaining('approve the payment') } })
        expect(await prepare([{ op: 'confirm', orderId: '8' }])).toMatchObject({ error: { message: expect.stringContaining('has not paid yet') } })
        expect(await prepare([{ op: 'confirm', orderId: '9' }])).toMatchObject({ error: { message: expect.stringContaining('online payment') } })
    })
})

describe('cancel and refund cards [TC-AICP-167]', () => {
    it('cancels an unpaid COD order: the number typed, reason, stock back, no money moves', async () => {
        const card = await prepare([{ op: 'cancel', orderId: '1', reason: 'Customer changed their mind' }])

        expect(card).toMatchObject({ title: 'Cancel order ORD-K3F2', risk: 'high', confirmText: 'ORD-K3F2' })
        expect(card.diffs.map((d: any) => [d.field, d.after])).toEqual([['Status', 'Cancelled'], ['Reason (emailed to the buyer as written)', 'Customer changed their mind'], ['Money', 'Nothing was paid, so no money moves.'], ['Stock', '2 items go back into stock']])
        expect(card.plan.undoable).toBe(false)
        expect(card.guardrails.some((g: any) => g.detail.startsWith("This can't be undone"))).toBe(true)
    })

    it('says where the money goes: Stripe card refund on cancel, the merchant pays back a bank transfer', async () => {
        const stripe = await prepare([{ op: 'cancel', orderId: '3', reason: 'Out of stock' }])
        const transfer = await prepare([{ op: 'cancel', orderId: '10', reason: 'Out of stock' }])

        expect(stripe.diffs.find((d: any) => d.field === 'Money').after).toBe("RM 120.00 (the full amount) is refunded to the buyer's card through Stripe.")
        expect(transfer.diffs.find((d: any) => d.field === 'Money').after).toContain('you pay RM 120.00 back to the buyer yourself')
    })

    it('refunds a shipped or completed order in full and says how the money moves for its payment method', async () => {
        const card = await prepare([{ op: 'refund', orderId: '5' }])
        const xendit = await prepare([{ op: 'refund', orderId: '11' }])
        const cod = await prepare([{ op: 'refund', orderId: '12' }])

        expect(card).toMatchObject({ title: 'Refund order ORD-DONE', risk: 'high', confirmText: 'ORD-DONE' })
        expect(card.diffs.map((d: any) => d.field)).toEqual(['Status', 'Refund', 'Money', 'Stock'])
        expect(card.diffs[1].after).toBe('RM 120.00')
        expect(card.diffs[2].after).toContain('through Stripe')
        expect(xendit.diffs[2].after).toContain('through Xendit')
        expect(cod.diffs[2].after).toContain('pay RM 120.00 back to the buyer yourself')
    })

    it('needs a reason to cancel and refuses what the Orders page refuses', async () => {
        await expect(prepare([{ op: 'cancel', orderId: '1', reason: '' }])).rejects.toThrow()
        expect(await prepare([{ op: 'cancel', orderId: '4', reason: 'x' }])).toMatchObject({ error: { message: expect.stringContaining("can't be cancelled") } })
        expect(await prepare([{ op: 'cancel', orderId: '7', reason: 'x' }])).toMatchObject({ error: { message: expect.stringContaining('EasyParcel label') } })
        expect(await prepare([{ op: 'refund', orderId: '1' }])).toMatchObject({ error: { message: expect.stringContaining('only a shipped or completed order') } })
    })

    it('takes one cancel / refund / payment approval per card, and nothing after a cancel on the same order', async () => {
        expect(await prepare([{ op: 'cancel', orderId: '1', reason: 'x' }, { op: 'cancel', orderId: '8', reason: 'x' }])).toMatchObject({ error: { code: 'one_money_step' } })
        expect(await prepare([{ op: 'approve_payment', orderId: '2' }, { op: 'cancel', orderId: '8', reason: 'x' }])).toMatchObject({ error: { code: 'one_money_step' } })
        expect(await prepare([{ op: 'cancel', orderId: '1', reason: 'x' }, { op: 'confirm', orderId: '1' }])).toMatchObject({ error: { message: expect.stringContaining('nothing can follow') } })
        // a cancel next to a harmless step on another order is fine: the typed number is the cancelled order's
        const mixed = await prepare([{ op: 'complete', orderId: '12' }, { op: 'cancel', orderId: '1', reason: 'x' }])
        expect(mixed.confirmText).toBe('ORD-K3F2')
    })
})

describe('Auto-approve, typed numbers and full buyer text on order cards [TC-AICP-255]', () => {
    const cardOf = (changes: unknown[]) => prepare(changes)

    it('flags every step but ship as requiresClick, so Auto-approve never applies money, buyer-email or irreversible steps', async () => {
        const flagged = await Promise.all([
            cardOf([{ op: 'confirm', orderId: '1' }]),
            cardOf([{ op: 'complete', orderId: '12' }]),
            cardOf([{ op: 'approve_payment', orderId: '2' }]),
            cardOf([{ op: 'reject_payment', orderId: '2', reason: 'image_blurry' }]),
            cardOf([{ op: 'cancel', orderId: '1', reason: 'x' }]),
            cardOf([{ op: 'refund', orderId: '5' }]),
        ])
        const ship = await cardOf([{ op: 'ship', orderId: '3', courier: 'J&T', trackingNumber: 'JT00123' }])
        // one flagged step flags the whole card
        const mixed = await cardOf([{ op: 'confirm', orderId: '1' }, { op: 'ship', orderId: '1', courier: 'Pos Laju', trackingNumber: 'PL0001' }])

        for (const card of flagged) expect(card.requiresClick).toBe(true)
        expect(mixed.requiresClick).toBe(true)
        // ship is undoable and uses the merchant's own tracking number
        expect(ship.requiresClick).toBeUndefined()
    })

    it('makes the merchant type the order number to approve a payment proof (as for cancel and refund), but not to reject one', async () => {
        const approve = await cardOf([{ op: 'approve_payment', orderId: '2' }])
        const reject = await cardOf([{ op: 'reject_payment', orderId: '2', reason: 'wrong_amount' }])
        const confirm = await cardOf([{ op: 'confirm', orderId: '1' }])

        expect(approve).toMatchObject({ confirmText: 'ORD-PROOF', risk: 'high' })
        expect(reject.confirmText).toBeUndefined()
        expect(confirm.confirmText).toBeUndefined()
    })

    it('shows the whole text the buyer is emailed: the cancel reason and the rejection detail, never clipped', async () => {
        const reason = `Sorry, we sold the last piece earlier today. ${'We are very sorry about this. '.repeat(14)}`.trim()
        const detail = `The transfer slip shows another account name. ${'Please upload a clear slip again. '.repeat(10)}`.trim()
        expect(reason.length).toBeGreaterThan(300)
        expect(detail.length).toBeGreaterThan(300)

        const cancel = await cardOf([{ op: 'cancel', orderId: '1', reason }])
        const reject = await cardOf([{ op: 'reject_payment', orderId: '2', reason: 'other', detail }])

        expect(cancel.diffs.find((d: any) => d.field.startsWith('Reason')).after).toBe(reason)
        expect(reject.diffs.find((d: any) => d.field.startsWith('Message to the buyer')).after).toBe(detail)
        expect(reject.diffs.map((d: any) => d.after).join('\n')).not.toContain('…')
        expect(cancel.guardrails.some((g: any) => g.detail.includes('emailed as written'))).toBe(true)
    })
})

describe('who may cancel, refund and check payments [TC-AICP-256]', () => {
    it('refuses a viewer on cancel, refund, approve and reject (they can still draft confirm and ship, like the dashboard)', async () => {
        for (const changes of [[{ op: 'cancel', orderId: '1', reason: 'x' }], [{ op: 'refund', orderId: '5' }], [{ op: 'approve_payment', orderId: '2' }], [{ op: 'reject_payment', orderId: '2', reason: 'image_blurry' }]]) {
            expect(await prepare(changes, VIEWER)).toMatchObject({ error: { code: 'forbidden', message: expect.stringContaining("can't cancel, refund or check payments") } })
        }
        expect(await prepare([{ op: 'confirm', orderId: '1' }], VIEWER)).toMatchObject({ kind: 'store.orders_patch' })
    })

    it('allows owner, admin / editor and a custom role holding Orders', async () => {
        for (const who of [OWNER, EDITOR, STAFF_WITH_ORDERS]) {
            expect(await prepare([{ op: 'cancel', orderId: '1', reason: 'x' }], who)).toMatchObject({ confirmText: 'ORD-K3F2' })
        }
    })

    it('still refuses a role without the Orders area before anything else', async () => {
        await expect(prepare([{ op: 'cancel', orderId: '1', reason: 'x' }], STAFF_WITHOUT_ORDERS)).rejects.toBeInstanceOf(OrdersToolError)
    })
})
