import type { DashboardBlockId } from '@/lib/dashboard-utils'

const ORDERS = ['store_order']
// the "design" and "launch" steps: a customised theme, a published site
const ONBOARDING = ['product', 'site', 'site_theme']

/**
 * What the assistant can change that the server-rendered blocks on show read. Traffic reads analytics and the SEO
 * card fetches its own score, so neither adds anything here.
 */
export function dashboardRefreshKinds(blocks: readonly DashboardBlockId[], { onboarding, canViewOrders }: { onboarding: boolean; canViewOrders: boolean }): string[] {
    const kinds = new Set<string>()
    if (onboarding) ONBOARDING.forEach((k) => kinds.add(k))
    if (canViewOrders && (blocks.includes('glance') || blocks.includes('orders'))) ORDERS.forEach((k) => kinds.add(k))
    return [...kinds]
}
