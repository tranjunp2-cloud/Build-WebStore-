/**
 * TC-AICP-228 — one reminder per automation built from the To do items: the most urgent item leads, the other items
 * are listed, the dedupe key is per automation and shop day, and the action link opens the page with the item's own
 * task kind in `?todo=` (website tasks open the dashboard, the editor has its own chat).
 * TC-AICP-243 — the dashboard To do card and the reminders are the same items with the same prompts (real
 * `todoText`, no re-implemented wording).
 */
import { describe, expect, it } from 'vitest'
import { AUTOMATION_IDS, AUTOMATIONS } from '@/lib/automations/automation-config'
import { askPageOf, todoUrl, automationDayKey, buildReminders } from '@/lib/automations/automation-reminders'
import { linkPrompt } from '@/components/agent/use-ask-param'
import type { ShopTodoItem } from '@/lib/insights/shop-todo'
import { todoLinkPrompt, todoText, type ShopTodoKind, type TodoLocale } from '@/lib/insights/shop-todo-text'

const HREF: Partial<Record<ShopTodoKind, string>> = {
    discounts_expiring: '/orders', out_of_stock: '/products', low_stock: '/products', payment_proofs: '/orders', orders_to_confirm: '/orders',
    leads_waiting: '/contact-leads', site_broken_links: '/editor/7', site_missing_seo: '/editor/7',
}
const item = (kind: ShopTodoKind, count = 3, locale: TodoLocale = 'en'): ShopTodoItem => ({
    id: kind, kind, severity: 'high', count, href: HREF[kind] ?? '/orders',
    ...todoText(kind, locale, { count, codes: ['RAYA10', 'SALE5'], oldestHours: 30 }),
})

describe('buildReminders [TC-AICP-228]', () => {
    const items = [item('payment_proofs'), item('out_of_stock', 6), item('site_broken_links', 2), item('low_stock', 4), item('discounts_expiring', 2)]

    it('makes one reminder per automation that has items, in the automation order', () => {
        const reminders = buildReminders(items, AUTOMATION_IDS, '2026-10-22')

        expect(reminders.map((r) => r.automation)).toEqual(['discounts', 'stock', 'orders_waiting', 'site_health'])
        expect(reminders.every((r) => r.items.length >= 1)).toBe(true)
    })

    it('leads with the most urgent item and lists the others in the message', () => {
        const stock = buildReminders(items, ['stock'], '2026-10-22')[0]!

        expect(stock.title).toBe(items[1]!.title)
        expect(stock.kind).toBe('out_of_stock')
        expect(stock.count).toBe(6)
        expect(stock.message).toBe(`${items[1]!.title} · ${items[3]!.title}`)
        const proofs = buildReminders(items, ['orders_waiting'], '2026-10-22')[0]!
        expect(proofs.message).toBe(items[0]!.detail)
    })

    it('skips automations that are not due and automations with nothing to report', () => {
        expect(buildReminders(items, ['leads'], '2026-10-22')).toEqual([])
        expect(buildReminders(items, [], '2026-10-22')).toEqual([])
        expect(buildReminders([], AUTOMATION_IDS, '2026-10-22')).toEqual([])
    })

    it('keys each reminder by automation and shop day so a second run the same day creates nothing new', () => {
        const [first] = buildReminders(items, ['discounts'], '2026-10-22')
        const [again] = buildReminders(items, ['discounts'], '2026-10-22')
        const [tomorrow] = buildReminders(items, ['discounts'], '2026-10-23')

        expect(first!.dedupeKey).toBe('automation:discounts:2026-10-22')
        expect(again!.dedupeKey).toBe(first!.dedupeKey)
        expect(tomorrow!.dedupeKey).toBe('automation:discounts:2026-10-23')
        expect(automationDayKey('site_health', '2026-10-26')).toBe('automation:site_health:2026-10-26')
    })
})

describe('todoUrl [TC-AICP-228]', () => {
    it('opens the page with the task kind in ?todo=, never free text', () => {
        const url = todoUrl('/discounts', 'discounts_expiring')

        expect(url).toBe('/discounts?todo=discounts_expiring')
        expect(url).not.toMatch(/ask=/)
    })

    it('adds to an existing query string', () => {
        expect(todoUrl('/orders?tab=new', 'payment_proofs')).toBe('/orders?tab=new&todo=payment_proofs')
    })

    it('sends website tasks to the dashboard, because the site editor has its own chat', () => {
        expect(askPageOf('/editor/7')).toBe('/dashboard')
        expect(askPageOf('/products')).toBe('/products')
        expect(buildReminders([item('site_broken_links')], ['site_health'], '2026-10-26')[0]!.actionUrl).toMatch(/^\/dashboard\?todo=site_broken_links$/)
    })
})

describe('To do card and reminders agree [TC-AICP-243]', () => {
    it.each(['en', 'ms'] as const)('every automation task keeps its own kind, title and page in %s', (locale) => {
        const kinds = AUTOMATION_IDS.flatMap((id) => AUTOMATIONS[id].kinds)
        for (const kind of kinds) {
            const todo = item(kind, 5, locale)
            const [reminder] = buildReminders([todo], AUTOMATION_IDS, '2026-10-22')

            expect(reminder!.title).toBe(todo.title)
            expect(reminder!.kind).toBe(kind)
            const link = new URL(reminder!.actionUrl, 'https://shop.test')
            // the link names the task; the dock turns it into the fixed message of that task (same task as the card)
            expect(link.searchParams.get('todo')).toBe(kind)
            expect(link.searchParams.has('ask')).toBe(false)
            expect(linkPrompt(link.searchParams, locale)).toBe(todoLinkPrompt(kind, locale))
            expect(link.pathname).toBe(askPageOf(todo.href))
        }
    })
})
