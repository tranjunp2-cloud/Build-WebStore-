/**
 * Shared fixtures of the order copilot tests (TC-AICP-163..171): the shop's orders in memory and a Payload
 * stand-in that understands the `where` operators the order tools use (and / or, equals, in, not_in,
 * contains, less_than, greater_than_equal, less_than_equal), tenant access on reads, and update.
 */
import type { AgentActor } from '@/lib/ai-platform/context'

export type Doc = Record<string, any>

const HOUR = 3_600_000
export const NOW = new Date('2026-10-22T04:00:00Z') // 12:00 in the shop
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString()

const base = (id: number, orderNumber: string, over: Doc = {}): Doc => ({
    id,
    tenant: 1,
    orderNumber,
    status: 'pending',
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    currency: 'MYR',
    customerName: 'Aisyah',
    customerEmail: 'aisyah@example.my',
    customerPhone: '0123456789',
    items: [{ productName: 'Batik shirt', variant: 'M', quantity: 2, unitPrice: 50 }],
    subtotal: 100,
    shippingFee: 20,
    tax: 0,
    total: 120,
    createdAt: ago(5),
    updatedAt: ago(5),
    ...over,
})

export const freshOrders = (): Doc[] => [
    base(1, 'ORD-K3F2'), // pending COD: to confirm
    base(2, 'ORD-PROOF', { paymentMethod: 'bank_transfer', paymentStatus: 'pending_verification', customerName: 'Wei Ling', paymentProofImage: 9 }),
    base(3, 'ORD-STUCK', { status: 'confirmed', paymentMethod: 'card', paymentStatus: 'paid', updatedAt: ago(40), createdAt: ago(60) }),
    base(4, 'ORD-LOST', { status: 'shipped', selfDeliveryCourier: 'J&T', trackingNumber: 'JT123', shippingTrackingStatus: 'failed_delivery', paymentMethod: 'cod', updatedAt: ago(3), createdAt: ago(80) }),
    base(5, 'ORD-DONE', { status: 'completed', paymentMethod: 'card', paymentStatus: 'paid', stripePaymentIntentId: 'pi_1', updatedAt: ago(30), createdAt: ago(200) }),
    base(6, 'ORD-OTHER', { tenant: 2 }),
    base(7, 'ORD-LABEL', { status: 'confirmed', paymentMethod: 'card', paymentStatus: 'paid', easyParcelOrderNo: 'EP1', updatedAt: ago(2) }),
    base(8, 'ORD-WAIT', { paymentMethod: 'bank_transfer', paymentStatus: 'awaiting_payment' }),
    base(9, 'ORD-FPX', { paymentMethod: 'fpx', paymentStatus: 'awaiting_payment', paymentProvider: 'xendit' }),
    base(10, 'ORD-BTPAID', { status: 'confirmed', paymentMethod: 'bank_transfer', paymentStatus: 'paid', updatedAt: ago(1) }),
    base(11, 'ORD-XENDIT', { status: 'completed', paymentMethod: 'fpx', paymentStatus: 'paid', paymentProvider: 'xendit', xenditPaymentRequestId: 'inv_1', updatedAt: ago(30) }),
    base(12, 'ORD-SELF', { status: 'shipped', selfDeliveryCourier: 'Pos', trackingNumber: 'PS1', paymentMethod: 'cod', updatedAt: ago(4) }),
]

export const state = { orders: freshOrders(), updates: [] as Array<{ id: number | string; data: Doc }>, clock: 0 }
export const reset = () => {
    state.orders = freshOrders()
    state.updates = []
}

const valueOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export function matches(doc: Doc, where: any): boolean {
    if (!where) return true
    if (where.and) return where.and.every((w: unknown) => matches(doc, w))
    if (where.or) return where.or.some((w: unknown) => matches(doc, w))
    return Object.entries(where).every(([field, cond]) => {
        const [op, arg] = Object.entries(cond as Doc)[0] as [string, any]
        const v = valueOf(doc[field])
        switch (op) {
            case 'equals':
                return String(v) === String(arg)
            case 'in':
                return (arg as unknown[]).map(String).includes(String(v))
            case 'not_in':
                return !(arg as unknown[]).map(String).includes(String(v))
            case 'contains':
                return String(v ?? '').toLowerCase().includes(String(arg).toLowerCase())
            case 'less_than':
                return new Date(String(v)) < new Date(arg)
            case 'greater_than_equal':
                return new Date(String(v)) >= new Date(arg)
            case 'less_than_equal':
                return new Date(String(v)) <= new Date(arg)
            default:
                throw new Error(`fake payload: operator ${op} is not supported`)
        }
    })
}

/** Orders are tenant-scoped on read (collection access): a tenant-2 order is invisible to a tenant-1 merchant. */
const visible = (doc: Doc) => doc.tenant === 1

export const cms = {
    find: async ({ where, limit }: { where?: unknown; limit?: number }) => {
        const docs = state.orders.filter((d) => visible(d) && matches(d, where))
        return { docs: docs.slice(0, limit ?? 10).map((d) => ({ ...d })), totalDocs: docs.length }
    },
    count: async ({ where }: { where?: unknown }) => ({ totalDocs: state.orders.filter((d) => visible(d) && matches(d, where)).length }),
    findByID: async ({ id }: { id: number | string }) => {
        const doc = state.orders.find((d) => String(d.id) === String(id) && visible(d))
        return doc ? { ...doc } : null
    },
    update: async ({ id, data }: { id: number | string; data: Doc }) => {
        const doc = state.orders.find((d) => String(d.id) === String(id))
        if (!doc) throw new Error('not found')
        Object.assign(doc, data, { updatedAt: `after-${++state.clock}` })
        state.updates.push({ id, data })
        return { ...doc }
    },
}

export const plan = { allowed: true }

const member = (permissions?: string[], role = 'owner') => ({ tenant: { id: 1 }, status: 'active', ...(permissions ? { role: 'custom', permissions } : { role }) })

const actorOf = (tenants: unknown[]): AgentActor => ({
    user: { id: 7, email: 'owner@shop.my', roles: ['tenant-owner'], tenants } as never,
    tenantId: '1',
    organizationId: 'org_1',
    role: 'owner',
})
export const OWNER = actorOf([member()])
export const STAFF_WITHOUT_ORDERS = actorOf([member(['products'])])
export const STAFF_WITH_ORDERS = actorOf([member(['orders'])])
export const VIEWER = actorOf([member(undefined, 'viewer')])
export const EDITOR = actorOf([member(undefined, 'editor')])
