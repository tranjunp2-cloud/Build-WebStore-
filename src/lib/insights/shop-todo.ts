/**
 * The shop's To do list: what needs the merchant's attention right now, computed from the shop's own
 * data. Used by the dashboard "To do" card, the copilot (`store_todos`) and, later, scheduled automations.
 *
 *   computeShopTodos(payload, { tenantId, siteId?, now, locale?, areas? }) -> ShopTodoItem[]
 *   = localizeShopTodos(await readShopTodoDrafts(payload, options), locale): read once, word it per language.
 *
 * STABLE CONTRACT (other code imports this):
 *  - Always resolves (a query that fails is logged and its tasks left out); never throws for data problems.
 *  - Every query is scoped by `tenantId`. `siteId` only picks which website is checked for links / SEO /
 *    unpublished changes (default: the tenant's first usable site).
 *  - Items are sorted most urgent first (severity, then a fixed order). `id` is stable per task (one item per
 *    `kind`), so a scheduler can remember what it already told the merchant. `count` is the number of things.
 *  - `title`, `detail` and `prompt` are in `locale` (default 'en'). `prompt` is a ready copilot message.
 *  - `areas` hides the tasks of parts the viewer can not open (see `area-access.ts`); omitted = everything
 *    (right for scheduled jobs that act for the owner).
 *  - `now` decides every "older than" / "ends within" test, so results are reproducible in tests.
 */
import { type SQL, sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { type ReportsDb, num, rowsOf, tenantParam } from '@/lib/reports/report-db'
import type { ShopArea } from './area-access'
import {
    EXPIRING_WITHIN_DAYS,
    LEAD_WAIT_HOURS,
    LOW_STOCK_BELOW,
    SHIP_AFTER_HOURS,
    type ShopTodoKind,
    type TodoLocale,
    type TodoTextVars,
    todoText,
} from './shop-todo-text'

export type { ShopTodoKind, TodoLocale } from './shop-todo-text'

export type ShopTodoSeverity = 'high' | 'medium' | 'low'

export interface ShopTodoItem {
    /** Stable per task (one per kind) */
    id: string
    kind: ShopTodoKind
    severity: ShopTodoSeverity
    title: string
    detail: string
    /** How many things need attention (orders, products, pages, ...) */
    count: number
    /** Dashboard page that shows them */
    href: string
    /** A ready message for the copilot that starts fixing it */
    prompt: string
    /** hours the oldest of them has waited, when known (orders to confirm) — the work queue's "waiting 2 h" */
    ageHours?: number
    /** the website was never published (site_unpublished) — visitors can't see the shop at all */
    neverPublished?: boolean
}

export interface ComputeShopTodosOptions {
    tenantId: string | number
    siteId?: string | number | null
    now: Date
    locale?: TodoLocale
    areas?: Partial<Record<ShopArea, boolean>>
}

/** Order of the list inside one severity */
const ORDER: ShopTodoKind[] = [
    'payment_proofs', 'orders_to_confirm', 'orders_to_ship', 'out_of_stock', 'site_broken_links', 'leads_waiting',
    'low_stock', 'products_ai_review', 'site_unpublished', 'discounts_expiring', 'discounts_used_up', 'products_missing_info', 'site_missing_seo',
]
const RANK: Record<ShopTodoSeverity, number> = { high: 0, medium: 1, low: 2 }
const HOUR = 3_600_000

/** A task as read from the data, before it is worded in a language (see `localizeShopTodos`). */
export type ShopTodoDraft = { kind: ShopTodoKind; severity: ShopTodoSeverity; count: number; href: string; vars: TodoTextVars }
type Draft = ShopTodoDraft
type Row = Record<string, unknown>

/** A failed query must not take the whole list down. */
async function safely<T>(what: string, run: () => Promise<T>): Promise<T | null> {
    try {
        return await run()
    } catch (error) {
        console.error(`[shop-todo] ${what} unavailable`, error instanceof Error ? error.message : error)
        return null
    }
}

async function orderDrafts(db: ReportsDb, tenantId: number, now: Date): Promise<Draft[]> {
    const shipCutoff = new Date(now.getTime() - SHIP_AFTER_HOURS * HOUR).toISOString()
    const [row] = await rowsOf<Row>(
        db,
        sql`SELECT
              COUNT(*) FILTER (WHERE status IN ('pending', 'new') AND COALESCE(payment_status::text, 'unpaid') IN ('unpaid', 'paid')) AS to_confirm,
              MIN(created_at) FILTER (WHERE status IN ('pending', 'new') AND COALESCE(payment_status::text, 'unpaid') IN ('unpaid', 'paid')) AS oldest,
              COUNT(*) FILTER (WHERE payment_status::text = 'pending_verification' AND status IN ('pending', 'new')) AS proofs,
              COUNT(*) FILTER (WHERE status IN ('confirmed', 'paid', 'processing', 'ready_to_ship') AND updated_at < ${shipCutoff}) AS to_ship
            FROM orders WHERE tenant_id = ${tenantId}`,
    )
    const toConfirm = num(row?.to_confirm)
    const oldest = row?.oldest ? new Date(String(row.oldest)).getTime() : NaN
    return [
        { kind: 'orders_to_confirm', severity: 'high', count: toConfirm, href: '/orders', vars: { count: toConfirm, oldestHours: Number.isFinite(oldest) ? Math.max(0, (now.getTime() - oldest) / HOUR) : undefined } },
        { kind: 'payment_proofs', severity: 'high', count: num(row?.proofs), href: '/orders', vars: { count: num(row?.proofs) } },
        { kind: 'orders_to_ship', severity: 'high', count: num(row?.to_ship), href: '/orders', vars: { count: num(row?.to_ship) } },
    ]
}

// Stock of a product = its own inventory, or the sum of its variants' stock when it has variants.
const STOCK: SQL = sql`CASE WHEN p.has_variants THEN COALESCE((SELECT SUM(v.stock) FROM products_variants v WHERE v._parent_id = p.id), 0) ELSE COALESCE(p.inventory, 0) END`
const NO_PHOTO: SQL = sql`(NOT EXISTS (SELECT 1 FROM products_images i WHERE i._parent_id = p.id) AND NOT EXISTS (SELECT 1 FROM products_remote_images r WHERE r._parent_id = p.id))`
const HAS_TEXT = (column: string): SQL => sql`COALESCE(${sql.raw(`p.${column}`)}::text, '') ~ '"text": ?"[^"]'`
const NO_DESCRIPTION: SQL = sql`(NOT ${HAS_TEXT('description')} AND NOT ${HAS_TEXT('description_b_m')} AND COALESCE(BTRIM(p.short_description), '') = '')`
const NO_SEO: SQL = sql`(COALESCE(BTRIM(p.seo_title), '') = '' AND COALESCE(BTRIM(p.seo_description), '') = '')`

async function productDrafts(db: ReportsDb, tenantId: number): Promise<Draft[]> {
    // each product's flags are worked out once (CTE), then counted
    const [row] = await rowsOf<Row>(
        db,
        sql`WITH item AS (
              SELECT p.status::text AS status, p.ai_review_pending IS TRUE AS ai_review, ${STOCK} AS stock,
                     ${NO_PHOTO} AS no_photo, ${NO_DESCRIPTION} AS no_description, ${NO_SEO} AS no_seo
              FROM products p WHERE p.tenant_id = ${tenantId} AND p.deleted_at IS NULL
            )
            SELECT
              COUNT(*) FILTER (WHERE status = 'active' AND stock <= 0) AS out_of_stock,
              COUNT(*) FILTER (WHERE status = 'active' AND stock > 0 AND stock < ${LOW_STOCK_BELOW}) AS low_stock,
              COUNT(*) FILTER (WHERE status = 'active' AND (no_photo OR no_description OR no_seo)) AS missing_any,
              COUNT(*) FILTER (WHERE status = 'active' AND no_photo) AS no_photo,
              COUNT(*) FILTER (WHERE status = 'active' AND no_description) AS no_description,
              COUNT(*) FILTER (WHERE status = 'active' AND no_seo) AS no_seo,
              COUNT(*) FILTER (WHERE status = 'draft' AND ai_review) AS ai_review
            FROM item`,
    )
    const missing = num(row?.missing_any)
    return [
        { kind: 'out_of_stock', severity: 'high', count: num(row?.out_of_stock), href: '/products', vars: { count: num(row?.out_of_stock) } },
        { kind: 'low_stock', severity: 'medium', count: num(row?.low_stock), href: '/products', vars: { count: num(row?.low_stock) } },
        { kind: 'products_ai_review', severity: 'medium', count: num(row?.ai_review), href: '/products', vars: { count: num(row?.ai_review) } },
        { kind: 'products_missing_info', severity: 'low', count: missing, href: '/products', vars: { count: missing, noPhoto: num(row?.no_photo), noDescription: num(row?.no_description), noSeo: num(row?.no_seo) } },
    ]
}

async function discountDrafts(db: ReportsDb, tenantId: number, now: Date): Promise<Draft[]> {
    const until = new Date(now.getTime() + EXPIRING_WITHIN_DAYS * 24 * HOUR).toISOString()
    const live = sql`status::text = 'active' AND (expires_at IS NULL OR expires_at >= ${now.toISOString()})`
    const [expiring, usedUp] = await Promise.all([
        rowsOf<Row>(db, sql`SELECT code FROM discounts WHERE tenant_id = ${tenantId} AND ${live} AND expires_at IS NOT NULL AND expires_at < ${until} ORDER BY expires_at LIMIT 50`),
        rowsOf<Row>(db, sql`SELECT code FROM discounts WHERE tenant_id = ${tenantId} AND ${live} AND usage_limit IS NOT NULL AND usage_count >= usage_limit ORDER BY updated_at DESC LIMIT 50`),
    ])
    const codes = (rows: Row[]) => rows.map((r) => String(r.code))
    return [
        { kind: 'discounts_expiring', severity: 'medium', count: expiring.length, href: '/discounts', vars: { count: expiring.length, codes: codes(expiring) } },
        { kind: 'discounts_used_up', severity: 'low', count: usedUp.length, href: '/discounts', vars: { count: usedUp.length, codes: codes(usedUp) } },
    ]
}

async function leadDrafts(db: ReportsDb, tenantId: number, now: Date): Promise<Draft[]> {
    const cutoff = new Date(now.getTime() - LEAD_WAIT_HOURS * HOUR).toISOString()
    const [row] = await rowsOf<Row>(
        db,
        sql`SELECT COUNT(*) AS waiting FROM contact_submissions c JOIN sites s ON s.id = c.site_id
            WHERE s.tenant_id = ${tenantId} AND c.status::text = 'new' AND c.created_at < ${cutoff}`,
    )
    return [{ kind: 'leads_waiting', severity: 'medium', count: num(row?.waiting), href: '/contact-leads', vars: { count: num(row?.waiting) } }]
}

export async function firstUsableSite(db: ReportsDb, tenantId: number): Promise<string | null> {
    const [row] = await rowsOf<Row>(
        db,
        sql`SELECT id FROM sites WHERE tenant_id = ${tenantId} AND (generation_status IS NULL OR generation_status::text IN ('completed', 'none')) ORDER BY id LIMIT 1`,
    )
    return row?.id != null ? String(row.id) : null
}

async function siteDrafts(payload: Payload, tenantId: number, siteId: string): Promise<Draft[]> {
    const { readSiteCheckCounts } = await import('@/lib/ai-platform/site/site-check')
    const check = await readSiteCheckCounts(payload, siteId, tenantId)
    if (!check) return []
    const href = `/editor/${check.siteId}`
    return [
        { kind: 'site_broken_links', severity: 'high', count: check.brokenLinks, href, vars: { count: check.brokenLinks } },
        { kind: 'site_unpublished', severity: 'medium', count: check.published ? check.unpublished : Math.max(1, check.unpublished), href, vars: { count: check.unpublished, neverPublished: !check.published } },
        { kind: 'site_missing_seo', severity: 'low', count: check.pagesMissingSeo, href, vars: { count: check.pagesMissingSeo } },
    ]
}

/** The data step: every query of the allowed areas, the tasks with something to do, most urgent first. */
export async function readShopTodoDrafts(payload: Payload, options: Omit<ComputeShopTodosOptions, 'locale'>): Promise<ShopTodoDraft[]> {
    const tenantId = tenantParam(options.tenantId)
    const allowed = (area: ShopArea) => options.areas?.[area] !== false
    const db = payload as unknown as ReportsDb

    const tasks: Array<Promise<Draft[] | null>> = []
    if (allowed('orders')) {
        tasks.push(safely('orders', () => orderDrafts(db, tenantId, options.now)), safely('discounts', () => discountDrafts(db, tenantId, options.now)))
    }
    if (allowed('products')) tasks.push(safely('products', () => productDrafts(db, tenantId)))
    if (allowed('leads')) tasks.push(safely('leads', () => leadDrafts(db, tenantId, options.now)))
    if (allowed('builder')) {
        tasks.push(
            safely('website', async () => {
                const siteId = options.siteId != null ? String(options.siteId) : await firstUsableSite(db, tenantId)
                return siteId ? await siteDrafts(payload, tenantId, siteId) : []
            }),
        )
    }

    const drafts = (await Promise.all(tasks)).flatMap((list) => list ?? []).filter((draft) => draft.count > 0)
    return drafts.sort((a, b) => RANK[a.severity] - RANK[b.severity] || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

/** The wording step (pure): the drafts as To do items in `locale` (default 'en'), order kept. */
export function localizeShopTodos(drafts: readonly ShopTodoDraft[], locale?: TodoLocale): ShopTodoItem[] {
    const lang: TodoLocale = locale === 'ms' ? 'ms' : 'en'
    return drafts.map((draft) => ({
        id: draft.kind,
        kind: draft.kind,
        severity: draft.severity,
        count: draft.count,
        href: draft.href,
        ...todoText(draft.kind, lang, draft.vars),
        ...(draft.vars.oldestHours != null ? { ageHours: draft.vars.oldestHours } : {}),
        ...(draft.vars.neverPublished ? { neverPublished: true } : {}),
    }))
}

export async function computeShopTodos(payload: Payload, options: ComputeShopTodosOptions): Promise<ShopTodoItem[]> {
    return localizeShopTodos(await readShopTodoDrafts(payload, options), options.locale)
}
