import config from '@payload-config'
import { tenantIdForQuery } from '@/lib/auth'
import { getPayload, type User } from 'payload'
import type {
    PendingOrderCurrency,
    PendingOrderRow,
    PendingOrdersData,
} from './dashboard-types'

const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])
const ORDER_CURRENCIES = new Set<PendingOrderCurrency>(['MYR', 'USD', 'SGD'])

type TenantMembership = {
    tenant: string | number | { id: string | number }
    role?: string
    permissions?: unknown[]
    status?: string
}

type PendingOrdersUser = User & {
    roles?: unknown[]
    tenants: TenantMembership[]
}

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
    return typeof value === 'object' && value !== null
}

function hasScalarId(value: unknown): value is string | number {
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'number') return Number.isFinite(value)
    return false
}

function hasTenantId(value: unknown): boolean {
    return hasScalarId(value) || (isRecord(value) && hasScalarId(value.id))
}

function primaryMembership(user: RecordValue): TenantMembership | null {
    if (!Array.isArray(user.tenants) || !isRecord(user.tenants[0])) return null

    const membership = user.tenants[0]
    if (!hasTenantId(membership.tenant)) return null

    return membership as TenantMembership
}

/** Strict widget-local permission check; global route authorization is intentionally unchanged. */
export function canReadPendingOrders(user: unknown): user is PendingOrdersUser {
    if (!isRecord(user)) return false

    const membership = primaryMembership(user)
    if (!membership) return false

    const isSuperAdmin = Array.isArray(user.roles) && user.roles.includes('super-admin')
    if (isSuperAdmin) return true

    if (membership.status !== 'active' || typeof membership.role !== 'string') return false
    if (FULL_ACCESS_ROLES.has(membership.role)) return true

    return membership.role === 'custom'
        && Array.isArray(membership.permissions)
        && membership.permissions.includes('orders')
}

function validDocumentId(value: unknown): value is string | number {
    return hasScalarId(value)
}

function normalizeCurrency(value: unknown): PendingOrderCurrency {
    if (value == null) return 'MYR'
    if (typeof value === 'string' && ORDER_CURRENCIES.has(value as PendingOrderCurrency)) {
        return value as PendingOrderCurrency
    }
    throw new Error('Pending order has an unsupported currency')
}

function itemCount(value: unknown): number {
    if (!Array.isArray(value)) return 0

    return value.reduce((sum, item) => {
        if (!isRecord(item)) return sum
        const quantity = item.quantity
        if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) return sum
        if (quantity > Number.MAX_SAFE_INTEGER - sum) return sum

        return sum + quantity
    }, 0)
}

function mapPendingOrder(value: unknown): PendingOrderRow {
    if (!isRecord(value)) throw new Error('Pending order has an invalid shape')
    if (!validDocumentId(value.id)) throw new Error('Pending order has an invalid ID')
    if (typeof value.orderNumber !== 'string' || value.orderNumber.trim().length === 0) {
        throw new Error('Pending order has an invalid order number')
    }
    if (typeof value.total !== 'number' || !Number.isFinite(value.total) || value.total < 0) {
        throw new Error('Pending order has an invalid total')
    }
    if (value.status !== 'pending') throw new Error('Pending order has an invalid status')

    return {
        id: value.id,
        orderNumber: value.orderNumber,
        itemCount: itemCount(value.items),
        total: value.total,
        currency: normalizeCurrency(value.currency),
        status: 'pending',
    }
}

export async function getPendingOrdersData({ user }: { user: unknown }): Promise<PendingOrdersData> {
    if (!canReadPendingOrders(user)) throw new Error('Forbidden')

    const tenantId = tenantIdForQuery(user)
    if (tenantId == null) throw new Error('Forbidden')

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { status: { equals: 'pending' } },
            ],
        },
        sort: '-createdAt',
        limit: 5,
        depth: 0,
        user,
        overrideAccess: false,
        select: {
            id: true,
            orderNumber: true,
            items: { quantity: true },
            total: true,
            currency: true,
            status: true,
        },
    })

    if (!Number.isFinite(result.totalDocs) || result.totalDocs < 0) {
        throw new Error('Pending orders result has an invalid total count')
    }

    return {
        orders: result.docs.map(mapPendingOrder),
        totalCount: result.totalDocs,
    }
}
