/**
 * TC-AICP-188 — the report and To do tools through the agent-tool facade: store.reports answers with the
 * shop's numbers for the calling merchant (tenant-scoped SQL, shop days), refuses money numbers without the
 * `orders` permission, hands a bad period / malformed input back as data; store.todos limits the list to the
 * areas the member can open and speaks their language. Real: handle-agent-tool.ts, store-reports.ts,
 * store-todos.ts, lib/reports/*, area-access.ts. Faked: the agent flag, the forwarded merchant, Payload's SQL
 * connection (queries are rendered and recorded), computeShopTodos' own SQL (covered against PostgreSQL in TC-AICP-189).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { readShopSetup } from '@/lib/insights/shop-setup'
import { computeShopTodos } from '@/lib/insights/shop-todo'

const sqlLog = vi.hoisted(() => ({ queries: [] as Array<{ sql: string; params: unknown[] }>, rows: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))
vi.mock('@/lib/insights/shop-todo', () => ({ computeShopTodos: vi.fn() }))
vi.mock('@/lib/insights/shop-setup', () => ({ readShopSetup: vi.fn() }))
vi.mock('payload', async () => {
    const { PgDialect: Dialect } = await import('drizzle-orm/pg-core')
    const dialect = new Dialect()
    return {
        getPayload: vi.fn(async () => ({
            db: {
                drizzle: {
                    execute: async (query: Parameters<InstanceType<typeof Dialect>['sqlToQuery']>[0]) => {
                        sqlLog.queries.push(dialect.sqlToQuery(query))
                        return { rows: sqlLog.rows }
                    },
                },
            },
        })),
    }
})

const actorOf = (membership: Record<string, unknown>, extra: Partial<AgentActor> = {}): AgentActor => ({
    user: { id: 7, email: 'staff@shop.my', roles: [], tenants: [{ tenant: { id: 4 }, status: 'active', ...membership }] } as never,
    tenantId: '4',
    organizationId: 'org_4',
    role: 'x',
    ...extra,
})
const OWNER = actorOf({ role: 'owner' })
const NO_ORDERS = actorOf({ role: 'custom', permissions: ['products'] })
const call = (tool: string, body: unknown) => handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)

beforeEach(() => {
    vi.clearAllMocks()
    sqlLog.queries = []
    sqlLog.rows = []
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    vi.mocked(computeShopTodos).mockReset().mockResolvedValue([])
    vi.mocked(readShopSetup).mockReset().mockResolvedValue([])
})

describe('store.reports in the facade [TC-AICP-188]', () => {
    it('answers a sales question with the period in shop days, the currency and the previous period, scoped to the merchant\'s tenant', async () => {
        sqlLog.rows = [{ day: '2026-10-20', orders: '2', revenue: '120.50', completed_orders: '1', completed_revenue: '50', discount_sen: '0', other_currency: '0' }]

        const res = await call('store.reports', { metric: 'sales', period: 'last_7_days', compare: true })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toMatchObject({
            metric: 'sales',
            shop: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' },
            period: { key: 'last_7_days', days: 7 },
            comparedWith: { days: 7 },
            current: { revenue: 120.5, orders: 2, averageOrderValue: 60.25 },
            previous: { revenue: 120.5, orders: 2 },
            change: { revenuePercent: 0 },
        })
        expect(body.definition).toContain('Sales = orders the shop accepted')
        // current + previous period, both for tenant 4 and bounded by the KL day windows
        expect(sqlLog.queries).toHaveLength(2)
        for (const q of sqlLog.queries) {
            expect(q.sql).toContain('tenant_id = $')
            expect(q.params).toContain(4)
        }
    })

    it('skips the previous period when asked not to compare', async () => {
        const body = await (await call('store.reports', { metric: 'sales', period: 'today', compare: false })).json()

        expect(sqlLog.queries).toHaveLength(1)
        expect(body).not.toHaveProperty('comparedWith')
        expect(body).not.toHaveProperty('previous')
    })

    it.each(['sales', 'top_products', 'discounts', 'orders_by_status'])('refuses %s without the orders permission and reads nothing', async (metric) => {
        vi.mocked(resolveToolActor).mockResolvedValue(NO_ORDERS)

        const body = await (await call('store.reports', { metric })).json()

        expect(body).toEqual({ error: { code: 'no_orders_permission', message: expect.stringContaining("can't see sales") } })
        expect(sqlLog.queries).toEqual([])
    })

    it('keeps traffic open to a member without the orders permission (no money in it)', async () => {
        vi.mocked(resolveToolActor).mockResolvedValue(NO_ORDERS)

        const res = await call('store.reports', { metric: 'traffic', period: 'yesterday' })

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ metric: 'traffic', period: { key: 'yesterday', days: 1 } })
        expect(sqlLog.queries.length).toBeGreaterThan(0)
    })

    it('lets a custom role that holds the orders permission see sales', async () => {
        vi.mocked(resolveToolActor).mockResolvedValue(actorOf({ role: 'custom', permissions: ['orders'] }))

        expect(await (await call('store.reports', { metric: 'orders_by_status', period: 'this_month' })).json()).toMatchObject({ metric: 'orders_by_status', statuses: [] })
    })

    it('hands a bad period or malformed input back as data the model can fix', async () => {
        const backwards = await (await call('store.reports', { metric: 'sales', period: 'custom', from: '2026-10-15', to: '2026-10-01' })).json()
        const missing = await (await call('store.reports', { metric: 'sales', period: 'custom', from: '2026-10-15' })).json()
        const unknown = await call('store.reports', { metric: 'profit' })
        const tooMany = await call('store.reports', { metric: 'traffic', limit: 99 })

        expect(backwards).toMatchObject({ error: { code: 'invalid_period', message: expect.stringContaining('before the start') } })
        expect(missing).toMatchObject({ error: { code: 'invalid_period' } })
        expect(await unknown.json()).toMatchObject({ error: { code: 'invalid_input', message: expect.stringContaining('metric') } })
        expect(await tooMany.json()).toMatchObject({ error: { code: 'invalid_input', message: expect.stringContaining('limit') } })
        expect(sqlLog.queries).toEqual([])
    })

    it('answers 404 while the AI assistant is off', async () => {
        vi.mocked(isAiAgentEnabled).mockReturnValue(false)

        expect((await call('store.reports', { metric: 'sales' })).status).toBe(404)
        expect((await call('store.todos', {})).status).toBe(404)
    })
})

describe('store.todos in the facade [TC-AICP-188]', () => {
    const item = (kind: string, count: number) => ({ id: kind, kind, severity: 'high', title: `${count} ${kind}`, detail: 'd', count, href: '/orders', prompt: `fix ${kind}` })

    it('lists the tasks of this tenant for what the member can open, in their language', async () => {
        vi.mocked(resolveToolActor).mockResolvedValue(actorOf({ role: 'custom', permissions: ['products'] }, { locale: 'ms' }))
        vi.mocked(computeShopTodos).mockResolvedValue([item('out_of_stock', 3), item('low_stock', 2)] as never)

        const body = await (await call('store.todos', { limit: 1 })).json()

        expect(computeShopTodos).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            tenantId: '4',
            locale: 'ms',
            siteId: null,
            areas: { orders: false, products: true, builder: false, settings: false, leads: false },
        }))
        expect(body).toMatchObject({ total: 2, more: 1, items: [{ kind: 'out_of_stock', count: 3, page: '/orders', prompt: 'fix out_of_stock' }] })
        expect(body.items[0]).not.toHaveProperty('href')
    })

    it('says plainly when nothing needs attention', async () => {
        const body = await (await call('store.todos', {})).json()

        expect(body).toMatchObject({ total: 0, allClear: true, items: [], setup: [] })
        expect(computeShopTodos).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ locale: 'en', areas: expect.objectContaining({ orders: true, leads: true }) }))
    })

    it('adds the selling-setup gaps as a separate list, for the same workspace, areas and language [TC-AIAUD-138]', async () => {
        vi.mocked(resolveToolActor).mockResolvedValue(actorOf({ role: 'custom', permissions: ['products'] }, { locale: 'ms' }))
        vi.mocked(computeShopTodos).mockResolvedValue([item('low_stock', 2)] as never)
        vi.mocked(readShopSetup).mockResolvedValue([
            { id: 'products_setup', kind: 'products_setup', severity: 'high', title: '3 produk', detail: 'd', count: 3, href: '/products', prompt: 'siapkan' },
        ] as never)

        const body = await (await call('store.todos', { siteId: '9' })).json()

        expect(readShopSetup).toHaveBeenCalledWith(expect.anything(), { tenantId: '4', siteId: '9', locale: 'ms', areas: { orders: false, products: true, builder: false, settings: false, leads: false } })
        expect(body.setup).toEqual([{ kind: 'products_setup', severity: 'high', title: '3 produk', detail: 'd', count: 3, page: '/products', prompt: 'siapkan' }])
        // the To do list itself is untouched: no setup kind in its items, and the card's loader never saw the setup read
        expect(body.items.map((i: { kind: string }) => i.kind)).toEqual(['low_stock'])
        expect(body).not.toHaveProperty('allClear')
    })

    it('is not "all clear" while the shop still has setup gaps, even with an empty To do list [TC-AIAUD-138]', async () => {
        vi.mocked(readShopSetup).mockResolvedValue([{ id: 'custom_domain_missing', kind: 'custom_domain_missing', severity: 'low', title: 't', detail: 'd', count: 1, href: '/settings/domains', prompt: 'p' }] as never)

        const body = await (await call('store.todos', {})).json()

        expect(body).toMatchObject({ total: 0, items: [], setup: [{ kind: 'custom_domain_missing' }] })
        expect(body).not.toHaveProperty('allClear')
    })

    it('answers the To do list even when the setup read fails [TC-AIAUD-138]', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(readShopSetup).mockRejectedValue(new Error('setup down'))
        vi.mocked(computeShopTodos).mockResolvedValue([item('low_stock', 2)] as never)

        const body = await (await call('store.todos', {})).json()

        expect(body).toMatchObject({ total: 1, setup: [], items: [{ kind: 'low_stock' }] })
    })

    it('rejects a malformed site id', async () => {
        const res = await call('store.todos', { siteId: 'abc' })

        expect(await res.json()).toMatchObject({ error: { code: 'invalid_input' } })
    })
})
