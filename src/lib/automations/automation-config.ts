/**
 * Scheduled automations of the shop copilot: which periodic checks exist, what each one watches, and the
 * per-workspace settings that switch them on or off. Pure data + functions, no I/O.
 *
 * Every automation is a group of To do tasks (`computeShopTodos`): the notification and the dashboard To do card
 * therefore always show the same items with the same copilot prompt.
 *
 * Storage: `tenants.settings.automations` (json, column `settings_automations`) holds
 *   { enabled: {<automation>: boolean}, lastRunDay }. `lastRunDay` is written by the cron only (shop day,
 * YYYY-MM-DD, Kuala Lumpur time). The switches have no settings screen (#2176): stored ones are still honoured,
 * everything else uses the defaults. Keys older versions stored (`digest`, `lastDigestDay`) are ignored: the digest
 * email is off until a settings screen exists again.
 * "Quiet": at most one notification per automation per day (dedupe key).
 */
import { klDateKey } from '@/lib/discounts/date-boundaries'
import type { ShopArea } from '@/lib/insights/area-access'
import type { ShopTodoKind } from '@/lib/insights/shop-todo-text'

export const AUTOMATION_IDS = ['discounts', 'stock', 'orders_waiting', 'leads', 'site_health'] as const
export type AutomationId = (typeof AUTOMATION_IDS)[number]

export interface AutomationDef {
    id: AutomationId
    /** To do tasks this automation reports on (order = urgency inside the automation comes from the To do list) */
    kinds: ShopTodoKind[]
    /** `weekly` automations run on Mondays (shop time) only */
    schedule: 'daily' | 'weekly'
    /** The To do area (`computeShopTodos` `areas`) whose data its kinds come from */
    area: ShopArea
}

export const AUTOMATIONS: Record<AutomationId, AutomationDef> = {
    discounts: { id: 'discounts', kinds: ['discounts_expiring', 'discounts_used_up'], schedule: 'daily', area: 'orders' },
    stock: { id: 'stock', kinds: ['out_of_stock', 'low_stock'], schedule: 'daily', area: 'products' },
    orders_waiting: { id: 'orders_waiting', kinds: ['payment_proofs', 'orders_to_confirm', 'orders_to_ship'], schedule: 'daily', area: 'orders' },
    leads: { id: 'leads', kinds: ['leads_waiting'], schedule: 'daily', area: 'leads' },
    site_health: { id: 'site_health', kinds: ['site_broken_links', 'site_unpublished', 'site_missing_seo'], schedule: 'weekly', area: 'builder' },
}

/**
 * The To do areas the given automations read, every other area explicitly off: a run with only `stock` due does
 * not query orders, and the (heavy) website check runs only when `site_health` is due.
 */
export function automationAreas(ids: readonly AutomationId[]): Record<ShopArea, boolean> {
    const needed = new Set(ids.map((id) => AUTOMATIONS[id].area))
    return { orders: needed.has('orders'), products: needed.has('products'), builder: needed.has('builder'), settings: false, leads: needed.has('leads') }
}

const BY_KIND = new Map<ShopTodoKind, AutomationId>(
    AUTOMATION_IDS.flatMap((id) => AUTOMATIONS[id].kinds.map((kind) => [kind, id] as const)),
)

/** The automation that reports a To do task, or null when no automation covers it (it stays on the card only). */
export const automationOfKind = (kind: ShopTodoKind): AutomationId | null => BY_KIND.get(kind) ?? null

export interface AutomationSettings {
    enabled: Record<AutomationId, boolean>
    /** Shop day the cron last finished this workspace (written by the cron) */
    lastRunDay: string | null
}

/** Every in-app reminder on. */
export function defaultAutomationSettings(): AutomationSettings {
    return {
        enabled: { discounts: true, stock: true, orders_waiting: true, leads: true, site_health: true },
        lastRunDay: null,
    }
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
const dayOrNull = (value: unknown): string | null => (typeof value === 'string' && DAY_KEY.test(value) ? value : null)

/** Reads the stored json tolerantly: anything missing or malformed falls back to the default. */
export function parseAutomationSettings(raw: unknown): AutomationSettings {
    const defaults = defaultAutomationSettings()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults
    const stored = raw as Record<string, unknown>
    const enabled = stored.enabled && typeof stored.enabled === 'object' ? (stored.enabled as Record<string, unknown>) : {}
    return {
        enabled: Object.fromEntries(
            AUTOMATION_IDS.map((id) => [id, typeof enabled[id] === 'boolean' ? enabled[id] : defaults.enabled[id]]),
        ) as Record<AutomationId, boolean>,
        lastRunDay: dayOrNull(stored.lastRunDay),
    }
}

// ── Schedule (shop time = Asia/Kuala_Lumpur) ────────────────────────────────────────────────────────────────────

export const shopDay = (now: Date): string => klDateKey(now)

/** Monday in shop time. */
export function isShopMonday(now: Date): boolean {
    const [y, m, d] = shopDay(now).split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1
}

export function runsToday(id: AutomationId, now: Date): boolean {
    return AUTOMATIONS[id].schedule === 'daily' || isShopMonday(now)
}

/** Automations that are switched on and scheduled for this shop day. */
export function automationsDue(settings: AutomationSettings, now: Date): AutomationId[] {
    return AUTOMATION_IDS.filter((id) => settings.enabled[id] && runsToday(id, now))
}

