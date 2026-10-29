'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { PLAN_GROUPS, sharedValue, type LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { GroupStats, LimitValues } from '@/lib/admin/ai-settings/types'
import { Switch } from '../../../_components/ai-limits/switch'
import styles from '../ai-settings.module.css'
import { LimitField, type NumericKind } from './limit-field'

interface Props {
    limits: LimitValues
    stats: GroupStats[]
    errors: Map<string, string>
    /** set the given codes of one limit kind */
    onSet: (kind: LimitKind, codes: readonly PlanCode[], value: string) => void
}

const EMPTY: GroupStats = { group: '', shops: [], budget: { p50: 0, p90: 0, max: 0 }, pictures: { p50: 0, p90: 0, max: 0 } }
const KINDS: NumericKind[] = ['budget', 'pictures', 'monthly', 'site']

/** 'mixed' when the codes of a group differ; NO is the only value that switches AI off. */
function aiState(value: string | null): boolean | 'mixed' {
    return value === null ? 'mixed' : value.trim().toUpperCase() !== 'NO'
}

interface RowProps {
    idBase: string
    codes: readonly PlanCode[]
    limits: LimitValues
    stats: GroupStats
    errors: Map<string, string>
    onSet: Props['onSet']
    /** the switch is shown by the caller (group header) or here (one code) */
    withSwitch: boolean
}

/** AI switch + the four limit fields of a set of plan codes (one group, or one code when edited separately). */
function PlanFields({ idBase, codes, limits, stats, errors, onSet, withSwitch }: RowProps) {
    const pick = (kind: LimitKind) => {
        const first = limits[kind][codes[0]] ?? ''
        return codes.every((code) => (limits[kind][code] ?? '') === first) ? first : null
    }
    const state = aiState(pick('enabled'))
    const off = state === false
    return (
        <>
            {withSwitch && (
                <div className={styles.row}>
                    <Switch checked={state} onChange={(on) => onSet('enabled', codes, on ? 'YES' : 'NO')}>AI is {state === 'mixed' ? 'on for some' : off ? 'off' : 'on'}</Switch>
                </div>
            )}
            {off && <p className={styles.offNote} role="status">AI is off for this plan</p>}
            <div className={styles.fields}>
                {KINDS.map((kind) => (
                    <LimitField key={kind} id={`${idBase}-${kind}`} kind={kind} value={pick(kind)} stats={stats} off={off}
                        error={codes.map((code) => errors.get(['limits', code, kind].join('|'))).find(Boolean)} onChange={(v) => onSet(kind, codes, v)} />
                ))}
            </div>
        </>
    )
}

export function LimitsSection({ limits, stats, errors, onSet }: Props) {
    const [separate, setSeparate] = useState<Record<string, boolean>>({})
    return (
        <section className="aiq-card">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Limits per plan</div>
                    <div className="aiq-card-sub">Per shop. Daily limits are rolling 24 hours, the monthly one is a calendar month. Changes take effect within ~6 min. Stats are from the last 7 days.</div>
                </div>
            </div>
            {PLAN_GROUPS.map((group) => {
                const groupStats = stats.find((s) => s.group === group.id) ?? EMPTY
                const open = Boolean(separate[group.id])
                const together = aiState(sharedValue(group, limits.enabled))
                return (
                    <div className={styles.plan} key={group.id}>
                        <div className={styles.planHead}>
                            <div>
                                <b>{group.label}</b> <span className={styles.dim}>· {groupStats.shops.length} active {groupStats.shops.length === 1 ? 'shop' : 'shops'} this week</span>
                                <p className={`${styles.small} ${styles.dim}`}>
                                    Applies to {group.codes.length} plan {group.codes.length === 1 ? 'code' : 'codes'}: <span className={styles.mono}>{group.codes.join(', ')}</span>
                                </p>
                            </div>
                            <div className={styles.planTools}>
                                {!open && <Switch checked={together} onChange={(on) => onSet('enabled', group.codes, on ? 'YES' : 'NO')}>
                                    AI {together === 'mixed' ? 'differs' : together ? 'on' : 'off'}
                                </Switch>}
                                {group.codes.length > 1 && (
                                    <button type="button" className={styles.link} aria-expanded={open} onClick={() => setSeparate({ ...separate, [group.id]: !open })}>
                                        {open ? 'Edit together' : 'Edit separately'} {open ? <ChevronUp size={14} style={{ verticalAlign: -2 }} /> : <ChevronDown size={14} style={{ verticalAlign: -2 }} />}
                                    </button>
                                )}
                            </div>
                        </div>
                        {open ? (
                            <div className={styles.sep}>
                                {group.codes.map((code) => (
                                    <div key={code}>
                                        <span className={styles.mono}>{code}</span>
                                        <PlanFields idBase={`lim-${code}`} codes={[code]} limits={limits} stats={groupStats} errors={errors} onSet={onSet} withSwitch />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <PlanFields idBase={`lim-${group.id}`} codes={group.codes} limits={limits} stats={groupStats} errors={errors} onSet={onSet} withSwitch={false} />
                        )}
                    </div>
                )
            })}
        </section>
    )
}
