/**
 * From To do items to reminders: one reminder per automation, built from the same items (title, detail, copilot
 * prompt) the dashboard To do card shows. Pure, no I/O.
 *
 * A reminder opens the page that shows the problem with `?todo=<kind>` (see `use-ask-param.ts`): the dock puts the
 * task's fixed message in the copilot box and the merchant presses Send. The link carries a kind, never free text.
 */
import type { ShopTodoItem } from '@/lib/insights/shop-todo'
import type { ShopTodoKind } from '@/lib/insights/shop-todo-text'
import { AUTOMATION_IDS, type AutomationId, automationOfKind } from './automation-config'

export interface AutomationReminder {
    automation: AutomationId
    /** One per automation per shop day: `automation:<id>:<YYYY-MM-DD>` */
    dedupeKey: string
    title: string
    message: string
    /** Page + `?todo=<kind>` of the most urgent item */
    actionUrl: string
    /** The most urgent item's To do kind */
    kind: ShopTodoItem['kind']
    /** Number of things the lead item counts */
    count: number
    items: ShopTodoItem[]
}

/**
 * The site editor has its own chat and no dashboard dock, so website tasks open the dashboard (where the
 * copilot checks the site from) instead of `/editor/<id>`.
 */
export function askPageOf(href: string): string {
    return href.startsWith('/editor') ? '/dashboard' : href
}

/** Link that opens `href` with the copilot dock open on the fixed message of the task `kind`. */
export function todoUrl(href: string, kind: ShopTodoKind): string {
    const page = askPageOf(href)
    return `${page}${page.includes('?') ? '&' : '?'}todo=${kind}`
}

export const automationDayKey = (automation: AutomationId, day: string): string => `automation:${automation}:${day}`

/**
 * `items` must be sorted most urgent first (as `computeShopTodos` returns them). Only automations in `due` that
 * have at least one item get a reminder; the order follows `AUTOMATION_IDS`.
 */
export function buildReminders(items: ShopTodoItem[], due: readonly AutomationId[], day: string): AutomationReminder[] {
    const reminders: AutomationReminder[] = []
    for (const automation of AUTOMATION_IDS) {
        if (!due.includes(automation)) continue
        const mine = items.filter((item) => automationOfKind(item.kind) === automation)
        const [lead] = mine
        if (!lead) continue
        reminders.push({
            automation,
            dedupeKey: automationDayKey(automation, day),
            title: lead.title,
            message: mine.length > 1 ? mine.map((item) => item.title).join(' · ') : lead.detail,
            actionUrl: todoUrl(lead.href, lead.kind),
            kind: lead.kind,
            count: lead.count,
            items: mine,
        })
    }
    return reminders
}
