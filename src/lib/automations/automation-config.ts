/**
 * Scheduled automations of the shop copilot: which periodic checks exist, what each one watches, and the
 * per-workspace settings that switch them on or off. Pure data + functions, no I/O.
 *
 * Every automation is a group of To do tasks (`computeShopTodos`): the notification, the digest email and the
 * dashboard To do card therefore always show the same items with the same copilot prompt.
 *
 * Storage: `tenants.settings.automations` (json, column `settings_automations`) holds
 *   { enabled: {<automation>: boolean}, digest: { enabled, frequency }, lastRunDay, lastDigestDay }.
 * `lastRunDay` / `lastDigestDay` are written by the cron only (shop day, YYYY-MM-DD, Kuala Lumpur time).
 * "Quiet": at most one notification per automation per day (dedupe key), one digest per day / week.
 */
import { z } from 'zod'
import { klDateKey } from '@/lib/discounts/date-boundaries'
import type { ShopTodoKind } from '@/lib/insights/shop-todo-text'

export const AUTOMATION_IDS = ['discounts', 'stock', 'orders_waiting', 'leads', 'site_health'] as const
export type AutomationId = (typeof AUTOMATION_IDS)[number]

export interface AutomationDef {
    id: AutomationId
    /** To do tasks this automation reports on (order = urgency inside the automation comes from the To do list) */
    kinds: ShopTodoKind[]
    /** `weekly` automations run on Mondays (shop time) only */
    schedule: 'daily' | 'weekly'
}

export const AUTOMATIONS: Record<AutomationId, AutomationDef> = {
    discounts: { id: 'discounts', kinds: ['discounts_expiring', 'discounts_used_up'], schedule: 'daily' },
    stock: { id: 'stock', kinds: ['out_of_stock', 'low_stock'], schedule: 'daily' },
    orders_waiting: { id: 'orders_waiting', kinds: ['payment_proofs', 'orders_to_confirm', 'orders_to_ship'], schedule: 'daily' },
    leads: { id: 'leads', kinds: ['leads_waiting'], schedule: 'daily' },
    site_health: { id: 'site_health', kinds: ['site_broken_links', 'site_unpublished', 'site_missing_seo'], schedule: 'weekly' },
}

const BY_KIND = new Map<ShopTodoKind, AutomationId>(
    AUTOMATION_IDS.flatMap((id) => AUTOMATIONS[id].kinds.map((kind) => [kind, id] as const)),
)

/** The automation that reports a To do task, or null when no automation covers it (it stays on the card only). */
export const automationOfKind = (kind: ShopTodoKind): AutomationId | null => BY_KIND.get(kind) ?? null

export const DIGEST_FREQUENCIES = ['daily', 'weekly'] as const
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number]

export interface AutomationSettings {
    enabled: Record<AutomationId, boolean>
    digest: { enabled: boolean; frequency: DigestFrequency }
    /** Shop day the cron last finished this workspace (written by the cron) */
    lastRunDay: string | null
    /** Shop day the last digest email went out (written by the cron) */
    lastDigestDay: string | null
}

/** In-app reminders on, email digest off. */
export function defaultAutomationSettings(): AutomationSettings {
    return {
        enabled: { discounts: true, stock: true, orders_waiting: true, leads: true, site_health: true },
        digest: { enabled: false, frequency: 'daily' },
        lastRunDay: null,
        lastDigestDay: null,
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
    const digest = stored.digest && typeof stored.digest === 'object' ? (stored.digest as Record<string, unknown>) : {}
    return {
        enabled: Object.fromEntries(
            AUTOMATION_IDS.map((id) => [id, typeof enabled[id] === 'boolean' ? enabled[id] : defaults.enabled[id]]),
        ) as Record<AutomationId, boolean>,
        digest: {
            enabled: typeof digest.enabled === 'boolean' ? digest.enabled : defaults.digest.enabled,
            frequency: digest.frequency === 'weekly' ? 'weekly' : 'daily',
        },
        lastRunDay: dayOrNull(stored.lastRunDay),
        lastDigestDay: dayOrNull(stored.lastDigestDay),
    }
}

/** What the settings form sends: every switch explicitly, nothing else (the cron's markers are not editable). */
export const AutomationSettingsInputSchema = z
    .object({
        enabled: z.object({
            discounts: z.boolean(),
            stock: z.boolean(),
            orders_waiting: z.boolean(),
            leads: z.boolean(),
            site_health: z.boolean(),
        }).strict(),
        digest: z.object({ enabled: z.boolean(), frequency: z.enum(DIGEST_FREQUENCIES) }).strict(),
    })
    .strict()
export type AutomationSettingsInput = z.infer<typeof AutomationSettingsInputSchema>

/** New settings from a form submit; the cron's markers are kept. */
export function applySettingsInput(current: AutomationSettings, input: AutomationSettingsInput): AutomationSettings {
    return { ...current, enabled: { ...input.enabled }, digest: { ...input.digest } }
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

/** A digest goes out once per shop day (daily) or on Mondays (weekly), and never twice for the same day. */
export function digestDue(settings: AutomationSettings, now: Date): boolean {
    if (!settings.digest.enabled) return false
    if (settings.lastDigestDay === shopDay(now)) return false
    return settings.digest.frequency === 'daily' || isShopMonday(now)
}
