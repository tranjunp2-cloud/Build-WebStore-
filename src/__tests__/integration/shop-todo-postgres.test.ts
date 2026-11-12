// @vitest-environment node
/**
 * TC-AICP-189 — computeShopTodos against a real PostgreSQL connection: the exact rules for every task
 * (orders to confirm / payment proofs / unshipped, stock incl. variants, missing product info, AI drafts, expiring
 * and used-up discounts, unanswered leads, website problems), tenant scope, permission areas, ordering, locale and
 * isolation of a failing query. TEMP tables mirror production (helpers/ops-temp-schema.ts); skipped without DATABASE_URI.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createOpsTempSchema, richText } from '../helpers/ops-temp-schema'

const siteCheck = vi.hoisted(() => ({ readSiteCheckCounts: vi.fn() }))
vi.mock('@/lib/ai-platform/site/site-check', () => siteCheck)

import { computeShopTodos } from '@/lib/insights/shop-todo'

const connectionString = process.env.DATABASE_URI
const T = 7
const OTHER = 8
const NOW = new Date('2026-10-22T04:00:00Z')
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString()
const ahead = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString()
const emptyDoc = JSON.stringify({ root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } })

describe.skipIf(!connectionString)('[TC-AICP-189] computeShopTodos on PostgreSQL', () => {
    let pool: Pool
    let payload: { db: { drizzle: ReturnType<typeof drizzle> } }

    beforeAll(async () => {
        pool = new Pool({ connectionString, ssl: false, max: 1 })
        payload = { db: { drizzle: drizzle(pool) } }
        await createOpsTempSchema(pool)
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
    })

    const order = (tenant: number, status: string, payment: string, created: string, updated = created) =>
        pool.query(`INSERT INTO orders (tenant_id, status, currency, payment_status, total, created_at, updated_at) VALUES ($1, $2, 'MYR', $3, 10, $4, $5)`, [tenant, status, payment, created, updated])
    const product = async (tenant: number, v: { status?: string; inventory?: number | null; variants?: number[]; photo?: 'local' | null; description?: string | null; descriptionBM?: string | null; short?: string; seoTitle?: string | null; ai?: boolean; deleted?: boolean }) => {
        const { rows } = await pool.query(
            `INSERT INTO products (tenant_id, name, status, inventory, has_variants, description, description_b_m, short_description, seo_title, ai_review_pending, deleted_at)
             VALUES ($1, 'P', $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [tenant, v.status ?? 'active', v.inventory ?? 50, Boolean(v.variants), v.description === undefined ? richText('A nice product') : v.description, v.descriptionBM ?? null, v.short ?? '', v.seoTitle === undefined ? 'Buy it' : v.seoTitle, v.ai ?? false, v.deleted ? NOW.toISOString() : null],
        )
        const id = rows[0].id as number
        if (v.photo === undefined || v.photo === 'local') await pool.query('INSERT INTO products_images (_parent_id, image_id) VALUES ($1, 1)', [id])
        for (const stock of v.variants ?? []) await pool.query('INSERT INTO products_variants (_parent_id, stock) VALUES ($1, $2)', [id, stock])
    }
    const todos = (extra: Record<string, unknown> = {}) => computeShopTodos(payload as never, { tenantId: T, now: NOW, ...extra })

    beforeEach(async () => {
        vi.clearAllMocks()
        siteCheck.readSiteCheckCounts.mockResolvedValue({ siteId: '2', published: true, pages: 4, unpublished: 2, brokenLinks: 3, pagesMissingSeo: 1 })
        await pool.query('TRUNCATE orders, orders_items, discounts, products, products_images, products_variants, sites, contact_submissions RESTART IDENTITY')

        await order(T, 'pending', 'unpaid', ago(5)) // COD waiting for the shop
        await order(T, 'new', 'paid', ago(30)) // paid online, oldest waiting
        await order(T, 'pending', 'awaiting_payment', ago(40)) // buyer has not paid: nothing to confirm yet
        await order(T, 'pending', 'pending_verification', ago(3)) // payment proof to check
        await order(T, 'confirmed', 'paid', ago(60), ago(30)) // confirmed 30h ago, not shipped
        await order(T, 'confirmed', 'paid', ago(60), ago(2)) // confirmed 2h ago: fine
        await order(T, 'ready_to_ship', 'paid', ago(80), ago(50)) // label bought, still not picked up
        await order(T, 'shipped', 'paid', ago(90), ago(80))
        await order(OTHER, 'pending', 'unpaid', ago(100)) // another shop

        await product(T, { inventory: 0 }) // out of stock
        await product(T, { inventory: 5 }) // low
        await product(T, { inventory: 0, variants: [3, 4] }) // variants: 7 in total -> low
        await product(T, { photo: null, description: emptyDoc, seoTitle: null }) // missing photo, description and SEO
        await product(T, { photo: 'local', description: null, descriptionBM: richText('Penerangan'), seoTitle: 'Beli sekarang' }) // has everything it needs
        await product(T, { status: 'draft', inventory: 0, ai: true }) // AI draft to review (a draft is never out of stock)
        await product(T, { inventory: 0, deleted: true }) // deleted: ignored
        await product(OTHER, { inventory: 0 }) // another shop

        await pool.query(
            `INSERT INTO discounts (tenant_id, code, status, usage_limit, usage_count, expires_at) VALUES
              ($1, 'EXP1', 'active', NULL, 0, $2), ($1, 'LATER', 'active', NULL, 0, $3), ($1, 'GONE', 'active', NULL, 0, $4),
              ($1, 'FULL', 'active', 10, 10, NULL), ($1, 'OFFSOON', 'inactive', NULL, 0, $2), ($5, 'THEIRS', 'active', NULL, 0, $2)`,
            [T, ahead(2), ahead(5), ahead(-1), OTHER],
        )

        await pool.query(`INSERT INTO sites (tenant_id, generation_status) VALUES ($1, 'failed'), ($1, 'completed'), ($2, 'completed')`, [T, OTHER])
        await pool.query(
            `INSERT INTO contact_submissions (site_id, status, created_at) VALUES (2, 'new', $1), (2, 'new', $2), (2, 'read', $1), (3, 'new', $1)`,
            [ago(72), ago(10)],
        )
    })

    it('finds every task with the right count, most urgent first', async () => {
        const items = await todos()

        expect(items.map((i) => [i.kind, i.severity, i.count])).toEqual([
            ['payment_proofs', 'high', 1],
            ['orders_to_confirm', 'high', 2],
            ['orders_to_ship', 'high', 2],
            ['out_of_stock', 'high', 1],
            ['site_broken_links', 'high', 3],
            ['leads_waiting', 'medium', 1],
            ['low_stock', 'medium', 2],
            ['products_ai_review', 'medium', 1],
            ['site_unpublished', 'medium', 2],
            ['discounts_expiring', 'medium', 1],
            ['discounts_used_up', 'low', 1],
            ['products_missing_info', 'low', 1],
            ['site_missing_seo', 'low', 1],
        ])
        expect(items.every((i) => i.id === i.kind)).toBe(true)
    })

    it('words each task with its numbers, a page to open and a ready copilot message', async () => {
        const byKind = Object.fromEntries((await todos()).map((i) => [i.kind, i]))

        expect(byKind.orders_to_confirm).toMatchObject({ title: '2 orders waiting to be confirmed', href: '/orders' })
        expect(byKind.orders_to_confirm?.detail).toBe('The oldest was placed 30 h ago.')
        expect(byKind.orders_to_confirm?.prompt).toContain('2 orders waiting to be confirmed')
        expect(byKind.payment_proofs?.title).toBe('1 payment proof to check')
        expect(byKind.discounts_expiring).toMatchObject({ detail: 'Ending soon: EXP1.', href: '/discounts' })
        expect(byKind.discounts_used_up?.detail).toContain('FULL')
        expect(byKind.products_missing_info?.detail).toBe('1 without a photo, 1 without a description, 1 without a search title or description.')
        expect(byKind.leads_waiting).toMatchObject({ href: '/contact-leads' })
        expect(byKind.site_broken_links).toMatchObject({ href: '/editor/2', title: '3 broken links on your website' })
        expect(byKind.low_stock?.href).toBe('/products')
    })

    it('counts a variant product by the stock of its variants and ignores drafts, deleted products and other shops', async () => {
        const byKind = Object.fromEntries((await todos()).map((i) => [i.kind, i]))

        expect(byKind.out_of_stock?.count).toBe(1)
        expect(byKind.low_stock?.count).toBe(2)
    })

    it('does not count a purchase waiting for the buyer, a fresh confirmation, a shipped order or a lead answered / newer than 48 hours', async () => {
        const byKind = Object.fromEntries((await todos()).map((i) => [i.kind, i]))

        expect(byKind.orders_to_confirm?.count).toBe(2)
        expect(byKind.orders_to_ship?.count).toBe(2)
        expect(byKind.leads_waiting?.count).toBe(1)
    })

    it('speaks Bahasa Melayu when asked and keeps the same kinds and counts', async () => {
        const en = await todos()
        const ms = await todos({ locale: 'ms' })

        expect(ms.map((i) => [i.kind, i.count])).toEqual(en.map((i) => [i.kind, i.count]))
        expect(ms.find((i) => i.kind === 'orders_to_confirm')).toMatchObject({ title: '2 pesanan menunggu pengesahan' })
        expect(ms.find((i) => i.kind === 'payment_proofs')?.prompt).toContain('bukti pembayaran')
    })

    it('leaves out the tasks of areas the viewer can not open', async () => {
        const noOrders = await todos({ areas: { orders: false } })
        const onlyProducts = await todos({ areas: { orders: false, builder: false, leads: false } })
        const nothing = await todos({ areas: { orders: false, products: false, builder: false, leads: false } })

        expect(noOrders.map((i) => i.kind)).not.toEqual(expect.arrayContaining(['orders_to_confirm', 'payment_proofs', 'orders_to_ship', 'discounts_expiring', 'discounts_used_up']))
        expect(noOrders.map((i) => i.kind)).toEqual(expect.arrayContaining(['out_of_stock', 'site_broken_links', 'leads_waiting']))
        expect(onlyProducts.map((i) => i.kind).sort()).toEqual(['low_stock', 'out_of_stock', 'products_ai_review', 'products_missing_info'])
        expect(nothing).toEqual([])
    })

    it('checks the named website, or the first usable one, and never another shop\'s', async () => {
        await todos({ siteId: 5 })
        await todos()

        expect(siteCheck.readSiteCheckCounts).toHaveBeenNthCalledWith(1, payload, '5', T)
        // site 1 failed generation: the first usable site of the tenant is 2
        expect(siteCheck.readSiteCheckCounts).toHaveBeenNthCalledWith(2, payload, '2', T)
    })

    it('says the website is not published yet instead of counting changes when it never went live', async () => {
        siteCheck.readSiteCheckCounts.mockResolvedValue({ siteId: '2', published: false, pages: 3, unpublished: 0, brokenLinks: 0, pagesMissingSeo: 0 })

        const item = (await todos()).find((i) => i.kind === 'site_unpublished')

        expect(item).toMatchObject({ count: 1, title: 'Your website is not published yet' })
    })

    it('returns an empty list for a shop with nothing to do, and for a tenant with no data', async () => {
        siteCheck.readSiteCheckCounts.mockResolvedValue({ siteId: '2', published: true, pages: 1, unpublished: 0, brokenLinks: 0, pagesMissingSeo: 0 })

        expect(await computeShopTodos(payload as never, { tenantId: 99, now: NOW })).toEqual([])
    })

    it('keeps the other tasks when one query fails, and logs it', async () => {
        const failing = {
            db: {
                drizzle: {
                    execute: (query: { queryChunks?: unknown[] }) => {
                        if (JSON.stringify(query.queryChunks ?? []).includes('products_variants')) return Promise.reject(new Error('boom'))
                        return payload.db.drizzle.execute(query as never)
                    },
                },
            },
        }
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const items = await computeShopTodos(failing as never, { tenantId: T, now: NOW })

        expect(items.map((i) => i.kind)).toEqual(expect.arrayContaining(['orders_to_confirm', 'discounts_expiring', 'leads_waiting']))
        expect(items.map((i) => i.kind)).not.toContain('out_of_stock')
        expect(error).toHaveBeenCalledWith(expect.stringContaining('products unavailable'), 'boom')
        error.mockRestore()
    })
})
