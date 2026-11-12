import type { OverrideSource } from '@/lib/admin/ai-usage/override-form'

/** One line for the Limits column of the override table: "$0.50/day · 20 pictures · $15/month · site $1/day". */
export function overrideValues(o: OverrideSource): string {
    if (o.mode === 'blocked') return 'AI off'
    if (o.mode === 'unlimited') return 'No budget limits'
    const parts: string[] = []
    if (o.aiBudgetUsd !== null) parts.push(`$${o.aiBudgetUsd}/day`)
    if (o.picturesPerDay !== null) parts.push(`${o.picturesPerDay} pictures/day`)
    if (o.aiBudgetUsdMonthly !== null) parts.push(`$${o.aiBudgetUsdMonthly}/month`)
    if (o.siteBudgetUsd !== null) parts.push(`site $${o.siteBudgetUsd}/day`)
    return parts.join(' · ') || 'Plan values'
}
