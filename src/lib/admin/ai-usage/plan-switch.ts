/** Per-plan "AI on/off" switches of the Overview: one switch per plan group, written to every code of the group. Pure + client-safe. */
import { PLAN_GROUPS, type PlanGroup } from '@/lib/admin/ai-settings/plan-groups'

export interface PlanSwitch {
    id: PlanGroup['id']
    label: string
    codes: readonly string[]
    /** every code of the group has AI on */
    on: boolean
    /** some codes on, some off */
    mixed: boolean
}

/** `disabledPlans` = plan codes with ai_enabled = NO (anything else is on). */
export function planSwitches(disabledPlans: readonly string[]): PlanSwitch[] {
    return PLAN_GROUPS.map((group) => {
        const off = group.codes.filter((code) => disabledPlans.includes(code)).length
        return { id: group.id, label: group.label, codes: group.codes, on: off === 0, mixed: off > 0 && off < group.codes.length }
    })
}

export interface EnabledChange {
    planCode: string
    kind: 'enabled'
    value: 'YES' | 'NO'
}

export const enabledChanges = (plan: Pick<PlanSwitch, 'codes'>, on: boolean): EnabledChange[] =>
    plan.codes.map((planCode) => ({ planCode, kind: 'enabled', value: on ? 'YES' : 'NO' }))
