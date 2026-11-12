/**
 * TC-AICP-229 — one workspace's run: a notification per automation per recipient (owner / admin only, in the language
 * they read, with the page + ?todo= link and a per-day dedupe key); the stored switches and the Monday schedule are
 * respected; a second run the same day creates nothing; a recipient that loses a race is not an error.
 * TC-AICP-230 — no email: the digest is off (#2176), even for a workspace whose stored settings had it on.
 * TC-AICP-275 — a reminder pushes to the phone only for orders waiting (`metadata.push`), the others stay in the bell.
 * TC-AICP-347 — only a unique violation counts as "the reminder exists"; any other create failure asks for a retry.
 * TC-AICP-348 — the To do data is read once per workspace, only for the areas of the due automations (the website
 * check only when site_health is due), and worded per recipient language.
 * Real: runner, reminders, config, shop-todo wording (`localizeShopTodos`) and texts. Faked: Payload (in-memory
 * find/create with the unique (tenant, user, dedupe key) index, rejecting like Payload's adapter), the To do data read
 * (`readShopTodoDrafts`), `sendEmail` (to prove nothing is mailed).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readShopTodoDrafts: vi.fn(), sendEmail: vi.fn() }))
vi.mock('@/lib/insights/shop-todo', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/insights/shop-todo')>()),
    readShopTodoDrafts: mocks.readShopTodoDrafts,
}))
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }))

import { defaultAutomationSettings, parseAutomationSettings } from '@/lib/automations/automation-config'
import { pushWanted } from '@/lib/automations/automation-push'
import { isUniqueViolation, runTenantAutomations, type TenantRunContext } from '@/lib/automations/automation-runner'
import type { ShopTodoDraft } from '@/lib/insights/shop-todo'
import { todoText, type ShopTodoKind, type TodoLocale } from '@/lib/insights/shop-todo-text'

const TENANT = 4
const TUESDAY = new Date('2026-10-27T01:00:00Z') // 09:00 KL, 2026-10-27
const MONDAY = new Date('2026-10-26T01:00:00Z')

/** the same tasks as read from the data, before wording */
const draft = (kind: ShopTodoKind, href: string, count = 3): ShopTodoDraft => ({ kind, severity: 'high', count, href, vars: { count, codes: ['RAYA10'] } })
const DRAFTS = [draft('payment_proofs', '/orders'), draft('out_of_stock', '/products', 6), draft('discounts_expiring', '/discounts', 1), draft('site_broken_links', '/editor/7', 2)]
/** what Payload's drizzle adapter throws for a Postgres 23505 (handleUpsertError) */
const uniqueViolation = () => Object.assign(new Error('The following field is invalid: dedupeKey'), { name: 'ValidationError', data: { collection: 'notifications', errors: [{ message: 'Value must be unique', path: 'dedupeKey' }] } })

type Row = Record<string, unknown>
function fakePayload(users: Row[]) {
    const notifications: Row[] = []
    const create = vi.fn(async ({ collection, data }: { collection: string; data: Row }) => {
        if (collection !== 'notifications') throw new Error('unexpected collection')
        if (notifications.some((n) => n.user === data.user && n.tenant === data.tenant && n.dedupeKey === data.dedupeKey)) throw uniqueViolation()
        const row = { id: notifications.length + 1, ...data }
        notifications.push(row)
        return row
    })
    const find = vi.fn(async ({ collection, where }: { collection: string; where: Row }) => {
        if (collection === 'users') return { docs: users, totalDocs: users.length }
        const conditions = (where.and as Row[]) ?? []
        const keys = (conditions.find((c) => 'dedupeKey' in c)?.dedupeKey as { in: string[] }).in
        const ids = (conditions.find((c) => 'user' in c)?.user as { in: unknown[] }).in
        const docs = notifications.filter((n) => keys.includes(n.dedupeKey as string) && ids.includes(n.user))
        return { docs, totalDocs: docs.length }
    })
    return { payload: { find, create } as never, notifications, create, find }
}

const user = (id: number, over: Row = {}) => ({ id, email: `u${id}@shop.test`, firstName: `User${id}`, prefer_lang: 'en', tenants: [{ tenant: TENANT, role: 'owner', status: 'active' }], ...over })
const ctx = (over: Partial<TenantRunContext> = {}): TenantRunContext => ({ now: TUESDAY, ...over })
const tenant = { id: TENANT, name: 'Kedai Demo' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.readShopTodoDrafts.mockResolvedValue(DRAFTS)
    mocks.sendEmail.mockResolvedValue(true)
})

describe('runTenantAutomations notifications [TC-AICP-229]', () => {
    it('creates one notification per due automation for an owner, with the dedupe key, page and ?todo= kind', async () => {
        const { payload, notifications } = fakePayload([user(1)])

        const result = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        expect(result).toMatchObject({ status: 'done', notifications: 3, reminders: 3 })
        // Tuesday: discounts, stock, orders; the weekly website check waits for Monday
        expect(notifications.map((n) => n.dedupeKey)).toEqual(['automation:discounts:2026-10-27', 'automation:stock:2026-10-27', 'automation:orders_waiting:2026-10-27'])
        const stock = notifications.find((n) => n.dedupeKey === 'automation:stock:2026-10-27')!
        expect(stock).toMatchObject({ tenant: TENANT, user: 1, type: 'AUTOMATION_REMINDER', isRead: false, title: '6 live products are out of stock', metadata: { automation: 'stock', kind: 'out_of_stock', count: '6' } })
        const link = new URL(stock.actionUrl as string, 'https://shop.test')
        expect(link.pathname).toBe('/products')
        expect(link.searchParams.get('todo')).toBe('out_of_stock')
        expect(link.searchParams.has('ask')).toBe(false)
        expect(new Date(stock.expiresAt as string).getTime()).toBe(TUESDAY.getTime() + 30 * 86_400_000)
    })

    it('runs the weekly website health on Mondays only, and opens the dashboard for it', async () => {
        const monday = fakePayload([user(1)])
        await runTenantAutomations(monday.payload, tenant, defaultAutomationSettings(), ctx({ now: MONDAY }))

        const health = monday.notifications.find((n) => n.dedupeKey === 'automation:site_health:2026-10-26')
        expect(health).toBeTruthy()
        expect(health!.actionUrl).toMatch(/^\/dashboard\?todo=site_broken_links$/)
    })

    it('respects the merchant\'s switches: an automation that is off creates nothing', async () => {
        const { payload, notifications } = fakePayload([user(1)])
        const settings = parseAutomationSettings({ enabled: { discounts: false, stock: false, leads: false, site_health: false } })

        await runTenantAutomations(payload, tenant, settings, ctx())

        expect(notifications.map((n) => n.dedupeKey)).toEqual(['automation:orders_waiting:2026-10-27'])
    })

    it('does nothing when every automation is off (no query, no recipients lookup)', async () => {
        const { payload, find } = fakePayload([user(1)])
        const off = parseAutomationSettings({ enabled: { discounts: false, stock: false, orders_waiting: false, leads: false, site_health: false } })

        const result = await runTenantAutomations(payload, tenant, off, ctx())

        expect(result.status).toBe('nothing_due')
        expect(find).not.toHaveBeenCalled()
        expect(mocks.readShopTodoDrafts).not.toHaveBeenCalled()
    })

    it('tells owners and admins only, each in their language', async () => {
        const { payload, notifications } = fakePayload([
            user(1, { prefer_lang: 'ms' }),
            user(2, { tenants: [{ tenant: TENANT, role: 'admin', status: 'active' }] }),
            user(3, { tenants: [{ tenant: TENANT, role: 'editor', status: 'active' }] }),
            user(4, { tenants: [{ tenant: TENANT, role: 'custom', status: 'active', permissions: ['orders'] }] }),
            user(5, { tenants: [{ tenant: TENANT, role: 'owner', status: 'pending' }] }),
            user(6, { tenants: [{ tenant: 99, role: 'owner', status: 'active' }] }),
        ])

        await runTenantAutomations(payload, tenant, parseAutomationSettings({ enabled: { discounts: false, orders_waiting: false, leads: false, site_health: false } }), ctx())

        expect(notifications.map((n) => n.user).sort()).toEqual([1, 2])
        expect(notifications.find((n) => n.user === 1)!.title).toBe(todoText('out_of_stock', 'ms', { count: 6 }).title)
        expect(notifications.find((n) => n.user === 2)!.title).toBe(todoText('out_of_stock', 'en', { count: 6 }).title)
        // the data is read once for both languages, scoped to the workspace
        expect(mocks.readShopTodoDrafts).toHaveBeenCalledTimes(1)
        expect(mocks.readShopTodoDrafts.mock.calls[0]![1].tenantId).toBe(TENANT)
    })

    it('says no_recipients when nobody can be told', async () => {
        const { payload } = fakePayload([user(3, { tenants: [{ tenant: TENANT, role: 'viewer', status: 'active' }] })])

        expect((await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())).status).toBe('no_recipients')
    })

    it('creates nothing new when it runs again the same day, but does on the next day', async () => {
        const { payload, notifications } = fakePayload([user(1)])

        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())
        const again = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx({ now: new Date(TUESDAY.getTime() + 3_600_000) }))
        expect(again.notifications).toBe(0)
        expect(notifications).toHaveLength(3)

        const tomorrow = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx({ now: new Date(TUESDAY.getTime() + 86_400_000) }))
        expect(tomorrow.notifications).toBe(3)
        expect(notifications).toHaveLength(6)
    })

    it('does not fail when a concurrent run wins the unique index for one row', async () => {
        const { payload, create, notifications } = fakePayload([user(1)])
        create.mockRejectedValueOnce(uniqueViolation())

        const result = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        expect(result.status).toBe('done')
        expect(result.notifications).toBe(2)
        expect(notifications).toHaveLength(2)
    })

    it('creates no reminder for an automation without items', async () => {
        mocks.readShopTodoDrafts.mockResolvedValue([draft('low_stock', '/products', 2)])
        const { payload, notifications } = fakePayload([user(1)])

        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        expect(notifications.map((n) => n.dedupeKey)).toEqual(['automation:stock:2026-10-27'])
    })
})

describe('no digest email [TC-AICP-230]', () => {
    it('[TC-AICP-230] mails nobody, even when the stored settings of an older version had the digest on', async () => {
        const { payload, notifications } = fakePayload([user(1), user(2, { prefer_lang: 'ms' })])
        const stored = parseAutomationSettings({ digest: { enabled: true, frequency: 'daily' }, lastDigestDay: '2026-10-26' })

        const result = await runTenantAutomations(payload, tenant, stored, ctx())

        expect(mocks.sendEmail).not.toHaveBeenCalled()
        expect(result).toEqual({ tenantId: TENANT, status: 'done', reminders: 3, notifications: notifications.length })
        expect(notifications.length).toBe(6)
    })
})

describe('push policy [TC-AICP-275]', () => {
    it('marks only the orders-waiting reminder for web push', async () => {
        const { payload, notifications } = fakePayload([user(1)])

        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        const pushByAutomation = Object.fromEntries(notifications.map((n) => [(n.metadata as { automation: string }).automation, (n.metadata as { push: string }).push]))
        expect(pushByAutomation).toEqual({ discounts: 'no', stock: 'no', orders_waiting: 'yes' })
    })
})

describe('notification failures [TC-AICP-347]', () => {
    it('[TC-AICP-347] retries the workspace when a notification failed for another reason than "already exists"', async () => {
        // Arrange
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const { payload, create, notifications } = fakePayload([user(1)])
        create.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))

        // Act
        const result = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        // Assert
        expect(result).toMatchObject({ status: 'retry_later', notifications: 2 })
        expect(notifications).toHaveLength(2)
        log.mockRestore()
    })

    it('[TC-AICP-347] a rerun after the failure creates only the missing reminder and finishes the day', async () => {
        // Arrange
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const { payload, create, notifications } = fakePayload([user(1)])
        create.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        // Act
        const again = await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        // Assert
        expect(again).toMatchObject({ status: 'done', notifications: 1 })
        expect(notifications).toHaveLength(3)
        log.mockRestore()
    })

    it.each([
        ['Payload ValidationError "Value must be unique"', uniqueViolation(), true],
        ['raw pg 23505', Object.assign(new Error('duplicate key'), { code: '23505' }), true],
        ['pg 23505 as the cause', Object.assign(new Error('insert failed'), { cause: { code: '23505' } }), true],
        ['another ValidationError (required field)', Object.assign(new Error('invalid'), { name: 'ValidationError', data: { errors: [{ message: 'This field is required.', path: 'title' }] } }), false],
        ['a connection error', new Error('Connection terminated unexpectedly'), false],
        ['a message that only mentions "unique"', new Error('duplicate key value violates unique constraint'), false],
        ['nothing', null, false],
    ])('[TC-AICP-347] isUniqueViolation: %s -> %s', (_label, error, expected) => {
        expect(isUniqueViolation(error)).toBe(expected)
    })
})

describe('one read per workspace, scoped to the due automations [TC-AICP-348]', () => {
    it('[TC-AICP-348] on a weekday reads orders, products and leads but never runs the website check', async () => {
        // Arrange
        const { payload } = fakePayload([user(1), user(2, { prefer_lang: 'ms' })])

        // Act
        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        // Assert
        expect(mocks.readShopTodoDrafts).toHaveBeenCalledTimes(1)
        expect(mocks.readShopTodoDrafts).toHaveBeenCalledWith(payload, { tenantId: TENANT, now: TUESDAY, areas: { orders: true, products: true, builder: false, settings: false, leads: true } })
    })

    it('[TC-AICP-348] on Monday includes the website, and with only stock on reads products alone', async () => {
        // Arrange
        const monday = fakePayload([user(1)])
        const stockOnly = parseAutomationSettings({ enabled: { discounts: false, orders_waiting: false, leads: false, site_health: false } })

        // Act
        await runTenantAutomations(monday.payload, tenant, defaultAutomationSettings(), ctx({ now: MONDAY }))
        await runTenantAutomations(fakePayload([user(1)]).payload, tenant, stockOnly, ctx())

        // Assert
        const [first, second] = mocks.readShopTodoDrafts.mock.calls.map(([, o]) => o.areas)
        expect(first).toEqual({ orders: true, products: true, builder: true, settings: false, leads: true })
        expect(second).toEqual({ orders: false, products: true, builder: false, settings: false, leads: false })
    })

    it('[TC-AICP-348] the reminders are the same as wording the To do list per language', async () => {
        // Arrange
        const { payload, notifications } = fakePayload([user(1), user(2, { prefer_lang: 'ms' })])

        // Act
        await runTenantAutomations(payload, tenant, defaultAutomationSettings(), ctx())

        // Assert
        const byUser = (id: number) => notifications.filter((n) => n.user === id).map((n) => [n.dedupeKey, n.title, n.message, n.actionUrl])
        const expected = (locale: TodoLocale) =>
            [['discounts', 'discounts_expiring', 1], ['stock', 'out_of_stock', 6], ['orders_waiting', 'payment_proofs', 3]].map(([automation, kind, count]) => {
                const text = todoText(kind as ShopTodoKind, locale, { count: count as number, codes: ['RAYA10'] })
                const href = DRAFTS.find((d) => d.kind === kind)!.href
                return [`automation:${automation}:2026-10-27`, text.title, text.detail, `${href}?todo=${kind}`]
            })
        expect(byUser(1)).toEqual(expected('en'))
        expect(byUser(2)).toEqual(expected('ms'))
    })
})

describe('pushWanted (the Notifications hook) [TC-AICP-275]', () => {
    it.each([
        [{ type: 'ORDER_NEW' }, true],
        [{ type: 'SYSTEM_ALERT', metadata: null }, true],
        [{ type: 'AUTOMATION_REMINDER', metadata: { automation: 'orders_waiting', push: 'yes' } }, true],
        [{ type: 'AUTOMATION_REMINDER', metadata: { automation: 'stock', push: 'no' } }, false],
        [{ type: 'AUTOMATION_REMINDER', metadata: { automation: 'stock' } }, false],
        [{ type: 'AUTOMATION_REMINDER' }, false],
    ])('%j -> %s', (doc, expected) => {
        expect(pushWanted(doc)).toBe(expected)
    })
})
