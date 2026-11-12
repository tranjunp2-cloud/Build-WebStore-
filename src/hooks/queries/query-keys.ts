/**
 * Query keys for the dashboard's shared React Query cache. Every key starts with the workspace scope
 * (`['ws', scope, …]`), so two workspaces never share an entry: switching workspace can only ever show
 * the new workspace's data (the provider also drops the old workspace's entries).
 *
 * Shape per domain: `all` ⊃ `lists` ⊃ `list(params)`, `all` ⊃ `details` ⊃ `detail(id)`. Invalidate the
 * narrowest prefix that covers what changed.
 */

/** `${tenantId}:${userId}` in the dashboard; `none` outside it (the editor's global template queries). */
export type QueryScope = string

export const NO_SCOPE: QueryScope = 'none'

export const scopeKey = (scope: QueryScope) => ['ws', scope] as const

function domain<const Name extends string>(name: Name) {
    const all = (scope: QueryScope) => [...scopeKey(scope), name] as const
    const lists = (scope: QueryScope) => [...all(scope), 'list'] as const
    const details = (scope: QueryScope) => [...all(scope), 'detail'] as const
    return {
        all,
        lists,
        list: <P extends object>(scope: QueryScope, params: P) => [...lists(scope), params] as const,
        details,
        detail: (scope: QueryScope, id: string | number) => [...details(scope), String(id)] as const,
    }
}

const products = domain('products')
const orders = domain('orders')
const customers = domain('customers')
const discounts = domain('discounts')
const blog = domain('blog')
const dashboard = domain('dashboard')

export const queryKeys = {
    products: {
        ...products,
        /** the store categories used by the filters (a product change does not touch them) */
        categories: (scope: QueryScope) => [...products.all(scope), 'categories'] as const,
    },
    orders: {
        ...orders,
        metrics: (scope: QueryScope) => [...orders.all(scope), 'metrics'] as const,
    },
    customers: {
        ...customers,
        /** every customer's orders tab (order rows: an order change refreshes them) */
        ordersAll: (scope: QueryScope) => [...orders.all(scope), 'by-customer'] as const,
        orders: (scope: QueryScope, customerId: string | number, page: number) =>
            [...orders.all(scope), 'by-customer', String(customerId), page] as const,
    },
    discounts: {
        ...discounts,
        /** the tab counts above the list */
        counts: (scope: QueryScope) => [...discounts.all(scope), 'counts'] as const,
    },
    dashboard: {
        ...dashboard,
        /** visits/views chart: per period and the viewer's time zone (day buckets) */
        traffic: (scope: QueryScope, period: string, timeZone: string) => [...dashboard.all(scope), 'traffic', period, timeZone] as const,
    },
    blog: {
        ...blog,
        categories: (scope: QueryScope) => [...blog.all(scope), 'categories'] as const,
    },
} as const

export type QueryDomain = keyof typeof queryKeys
