/**
 * Which reminders also reach the phone as web push. Every reminder lands in the bell; push is for the ones that cost
 * the shop money or a buyer's patience when they wait: orders to confirm, payment proofs to check, orders to ship
 * (the `orders_waiting` automation). Stock, discounts, messages and the website check stay in the bell, so a workspace
 * is never woken up four times a day by default.
 */
import type { AutomationId } from './automation-config'

const PUSH_AUTOMATIONS: ReadonlySet<AutomationId> = new Set<AutomationId>(['orders_waiting'])

export const shouldPushReminder = (automation: AutomationId): boolean => PUSH_AUTOMATIONS.has(automation)

/**
 * The Notifications hook asks this before sending web push. Everything that is not an automation reminder keeps its
 * push (orders, alerts); a reminder pushes only when its row says so (`metadata.push === 'yes'`), so a row written
 * by older code or by hand stays quiet.
 */
export function pushWanted(doc: { type?: unknown; metadata?: unknown }): boolean {
    if (doc.type !== 'AUTOMATION_REMINDER') return true
    const metadata = doc.metadata && typeof doc.metadata === 'object' ? (doc.metadata as { push?: unknown }) : null
    return metadata?.push === 'yes'
}
