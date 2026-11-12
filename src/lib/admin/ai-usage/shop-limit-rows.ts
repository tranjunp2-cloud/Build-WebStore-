/** Rows of the shop page's "AI limit for this shop" card: plan value, override value, what applies and from where. Pure + client-safe. */
import type { AiLimits } from '@/lib/ai-platform/limit-resolution'
import type { OverrideSource } from './override-form'

export interface LimitRow {
    key: 'enabled' | 'aiBudgetUsd' | 'picturesPerDay' | 'aiBudgetUsdMonthly' | 'siteBudgetUsd'
    label: string
    plan: string
    /** what the override sets for this row; null = the override says nothing here */
    override: string | null
    applied: string
    from: 'plan' | 'override'
}

type Overridden = OverrideSource & { expired: boolean }

const money = (value: number | null, suffix: string) => (value === null ? 'Unlimited' : `$${value}${suffix}`)
const amountFor = (key: LimitRow['key'], limits: AiLimits): string => {
    switch (key) {
        case 'enabled': return limits.enabled ? 'On' : 'Off'
        case 'aiBudgetUsd': return money(limits.aiBudgetUsd, ' / day')
        case 'picturesPerDay': return limits.picturesPerDay === null ? 'Unlimited' : `${limits.picturesPerDay} / day`
        case 'aiBudgetUsdMonthly': return money(limits.aiBudgetUsdMonthly, ' / month')
        case 'siteBudgetUsd': return money(limits.siteBudgetUsd, ' / day')
    }
}

const LABELS: Array<[LimitRow['key'], string]> = [
    ['enabled', 'AI'], ['aiBudgetUsd', 'AI budget'], ['picturesPerDay', 'Pictures'],
    ['aiBudgetUsdMonthly', 'Monthly AI budget'], ['siteBudgetUsd', 'Website setup budget'],
]

/** What the override says for one row (an expired override says nothing). */
function overrideText(key: LimitRow['key'], o: Overridden | null, plan: AiLimits): string | null {
    if (!o || o.expired) return null
    if (o.mode === 'blocked') return key === 'enabled' ? 'Off' : null
    // custom and unlimited grant AI: it only counts as the override's doing when the plan has it off
    if (key === 'enabled') return plan.enabled ? null : 'On'
    if (o.mode === 'unlimited') return 'Unlimited'
    const value = o[key]
    return value === null ? null : amountFor(key, { ...plan, [key]: value })
}

export function limitRows(planLimits: AiLimits, effective: AiLimits, override: Overridden | null): LimitRow[] {
    return LABELS.map(([key, label]) => {
        const set = overrideText(key, override, planLimits)
        const applied = amountFor(key, effective)
        return { key, label, plan: amountFor(key, planLimits), override: set, applied, from: set !== null && effective.source === 'shop' ? 'override' : 'plan' }
    })
}
