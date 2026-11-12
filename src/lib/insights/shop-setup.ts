/**
 * What keeps the shop from being ready to sell, for the copilot (`store_todos` → `setup`): cash on delivery
 * as the only payment, missing business details, no custom domain, and live products with no stock / no price or
 * with stock / AI pictures. NOT part of the To do list: the dashboard card, the mascot badge and the scheduled
 * automations keep reading `computeShopTodos` and never see these.
 *
 * Contract (like shop-todo.ts): always resolves, a read that fails is logged and its items left out; every read
 * is scoped by `tenantId`; `areas` hides the parts the viewer can not open (payments / business details / domain
 * are Settings, products are Products); items are most urgent first, one per kind.
 */
import type { Payload } from 'payload'
import { type ShopSetupKind, SHOP_SETUP_KINDS, type SetupTextVars, type TodoLocale, setupText } from './shop-todo-text'
import { firstUsableSite, type ShopTodoSeverity } from './shop-todo'
import type { ShopArea } from './area-access'
import type { ReportsDb } from '@/lib/reports/report-db'

export type { ShopSetupKind } from './shop-todo-text'

export interface ShopSetupItem {
    /** Stable per kind */
    id: ShopSetupKind
    kind: ShopSetupKind
    severity: ShopTodoSeverity
    title: string
    detail: string
    /** How many things are missing (products, details) */
    count: number
    /** Page that shows or fixes them */
    href: string
    /** A ready message for the copilot */
    prompt: string
}

export interface ReadShopSetupOptions {
    tenantId: string | number
    locale?: TodoLocale
    areas?: Partial<Record<ShopArea, boolean>>
    /** the website whose business details are checked (default: the first usable one) */
    siteId?: string | number | null
}

type Draft = { kind: ShopSetupKind; severity: ShopTodoSeverity; count: number; href: string; vars: SetupTextVars }
type Doc = Record<string, unknown>

/** Products read at most (a shop with more is judged on its first ones; counts are then a floor). */
const PRODUCT_LIMIT = 1000
/** Pictures of these origins are not the merchant's own photos (Media.sourceProvider; the site builder flags its imagery aiGenerated). */
const UNREAL_PROVIDERS = new Set(['pixabay', 'wikimedia', 'ai'])

async function safely<T>(what: string, run: () => Promise<T>): Promise<T | null> {
    try {
        return await run()
    } catch (error) {
        console.error(`[shop-setup] ${what} unavailable`, error instanceof Error ? error.message : error)
        return null
    }
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const group = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})
const rows = (value: unknown): Doc[] => (Array.isArray(value) ? value.filter((row): row is Doc => Boolean(row) && typeof row === 'object') : [])

/** Payments that are not cash on delivery: card / FPX (Stripe), the Xendit wallets and FPX, bank transfer / QR. */
const ONLINE_METHODS = ['payment_card', 'payment_fpx', 'payment_qr', 'xendit_tng', 'xendit_grabpay', 'xendit_duitnow', 'xendit_fpx', 'xendit_shopeepay', 'xendit_boost', 'xendit_mae'] as const

function paymentsDraft(tenant: Doc): Draft[] {
    const payments = group(tenant.payments)
    if (ONLINE_METHODS.some((method) => payments[method] === true)) return []
    const codOn = payments.payment_cod !== false
    return [{ kind: 'payments_cod_only', severity: codOn ? 'medium' : 'high', count: 1, href: '/settings/payments', vars: { count: 1, codOn, stripeConnected: tenant.stripeOnboardingComplete === true } }]
}

function domainDraft(tenant: Doc): Draft[] {
    if (rows(tenant.customDomains).some((row) => row.status === 'active')) return []
    return [{ kind: 'custom_domain_missing', severity: 'low', count: 1, href: '/settings/domains', vars: { count: 1 } }]
}

function businessDraft(tenant: Doc, site: Doc | null, siteId: string | null): Draft[] {
    const contact = group(site?.contactInfo)
    const local = group(site?.localBusiness)
    const missing: NonNullable<SetupTextVars['missing']> = []
    if (!text(contact.phone) && !text(tenant.whatsappNumber)) missing.push('phone')
    if (!text(contact.address) && !text(local.streetAddress) && !text(tenant.businessAddress)) missing.push('address')
    // opening hours live on the website: without one there is nothing to check them on
    if (site && !rows(local.openingHours).some((row) => row.isClosed === true || (text(row.opens) && text(row.closes)))) missing.push('hours')
    if (missing.length === 0) return []
    return [{ kind: 'business_info_missing', severity: 'medium', count: missing.length, href: siteId ? `/editor/${siteId}?settingsTab=global` : '/settings/profile', vars: { count: missing.length, missing } }]
}

/** Is this picture the merchant's own? Not when the library flags it as AI-made / AI-sourced or from a stock provider. */
function isOwnPhoto(row: Doc): boolean {
    const media = row.image
    if (!media || typeof media !== 'object') return true // an id we could not read: do not accuse it
    const flags = media as Doc
    return flags.aiGenerated !== true && !UNREAL_PROVIDERS.has(String(flags.sourceProvider ?? ''))
}

function productDrafts(products: Doc[]): Draft[] {
    let noStock = 0
    let noPrice = 0
    let setup = 0
    let unreal = 0
    for (const product of products) {
        // a product with options keeps its prices and stock per option, set in the product form: the copilot can't set them here
        const options = product.hasVariants === true
        const noStockHere = !options && !(Number(product.inventory) > 0)
        const noPriceHere = !options && !(Number(product.price) > 0)
        if (noStockHere) noStock += 1
        if (noPriceHere) noPrice += 1
        if (noStockHere || noPriceHere) setup += 1
        const photos = rows(product.images)
        if (photos.length > 0 && photos.every((photo) => !isOwnPhoto(photo))) unreal += 1
    }
    return [
        { kind: 'products_setup', severity: 'high', count: setup, href: '/products', vars: { count: setup, noStock, noPrice } },
        { kind: 'products_stock_photos', severity: 'medium', count: unreal, href: '/products', vars: { count: unreal } },
    ]
}

/** The selling-setup gaps of the shop, most urgent first (empty = nothing missing in the parts the viewer can open). */
export async function readShopSetup(payload: Payload, options: ReadShopSetupOptions): Promise<ShopSetupItem[]> {
    const tenantId = Number(options.tenantId)
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new Error('The setup list needs a valid tenant id.')
    const allowed = (area: ShopArea) => options.areas?.[area] !== false

    const tasks: Array<Promise<Draft[] | null>> = []
    if (allowed('settings')) {
        tasks.push(
            safely('settings', async () => {
                const tenant = (await payload.findByID({
                    collection: 'tenants',
                    id: tenantId,
                    depth: 0,
                    overrideAccess: true,
                    select: { payments: true, customDomains: true, whatsappNumber: true, businessAddress: true, stripeOnboardingComplete: true },
                })) as unknown as Doc
                const siteId = options.siteId != null ? String(options.siteId) : await firstUsableSite(payload as unknown as ReportsDb, tenantId)
                const site = siteId
                    ? ((await payload.find({
                          collection: 'sites',
                          // the site must belong to this shop: an id of another shop's site reads as "no website"
                          where: { and: [{ id: { equals: Number(siteId) } }, { tenant: { equals: tenantId } }] },
                          limit: 1,
                          depth: 0,
                          pagination: false,
                          overrideAccess: true,
                          select: { contactInfo: true, localBusiness: true },
                      })).docs[0] as unknown as Doc | undefined) ?? null
                    : null
                return [...paymentsDraft(tenant), ...businessDraft(tenant, site, site ? siteId : null), ...domainDraft(tenant)]
            }),
        )
    }
    if (allowed('products')) {
        tasks.push(
            safely('products', async () => {
                const found = await payload.find({
                    collection: 'products',
                    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }, { deletedAt: { exists: false } }] },
                    limit: PRODUCT_LIMIT,
                    depth: 1,
                    pagination: false,
                    overrideAccess: true,
                    select: { inventory: true, price: true, hasVariants: true, images: true },
                    populate: { media: { aiGenerated: true, sourceProvider: true } },
                })
                return productDrafts(found.docs as unknown as Doc[])
            }),
        )
    }

    const drafts = (await Promise.all(tasks)).flatMap((list) => list ?? []).filter((draft) => draft.count > 0)
    const locale: TodoLocale = options.locale === 'ms' ? 'ms' : 'en'
    return drafts
        .sort((a, b) => SHOP_SETUP_KINDS.indexOf(a.kind) - SHOP_SETUP_KINDS.indexOf(b.kind))
        .map((draft) => ({ id: draft.kind, kind: draft.kind, severity: draft.severity, count: draft.count, href: draft.href, ...setupText(draft.kind, locale, draft.vars) }))
}
