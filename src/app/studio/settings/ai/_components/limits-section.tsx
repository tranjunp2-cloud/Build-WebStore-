'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { PLAN_GROUPS, sharedValue, type LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { GroupStats, LimitValues } from '@/lib/admin/ai-settings/types'
import styles from '../ai-settings.module.css'
import { LimitField } from './limit-field'

interface Props {
    limits: LimitValues
    stats: GroupStats[]
    errors: Map<string, string>
    /** set the given codes of one limit kind */
    onSet: (kind: LimitKind, codes: readonly PlanCode[], value: string) => void
}

const EMPTY: GroupStats = { group: '', shops: [], budget: { p50: 0, p90: 0, max: 0 }, pictures: { p50: 0, p90: 0, max: 0 } }

export function LimitsSection({ limits, stats, errors, onSet }: Props) {
    const [separate, setSeparate] = useState<Record<string, boolean>>({})
    return (
        <section className="aiq-card">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Daily limits per plan</div>
                    <div className="aiq-card-sub">Per shop, rolling 24 hours. Changes take effect within ~6 min. Stats are from the last 7 days.</div>
                </div>
            </div>
            {PLAN_GROUPS.map((group) => {
                const groupStats = stats.find((s) => s.group === group.id) ?? EMPTY
                const open = Boolean(separate[group.id])
                const kinds: LimitKind[] = ['budget', 'pictures']
                return (
                    <div className={styles.plan} key={group.id}>
                        <div className={styles.planHead}>
                            <div>
                                <b>{group.label}</b> <span className={styles.dim}>· {groupStats.shops.length} active {groupStats.shops.length === 1 ? 'shop' : 'shops'} this week</span>
                                <p className={`${styles.small} ${styles.dim}`}>
                                    Applies to {group.codes.length} plan {group.codes.length === 1 ? 'code' : 'codes'}: <span className={styles.mono}>{group.codes.join(', ')}</span>
                                </p>
                            </div>
                            {group.codes.length > 1 && (
                                <button type="button" className={styles.link} aria-expanded={open} onClick={() => setSeparate({ ...separate, [group.id]: !open })}>
                                    {open ? 'Edit together' : 'Edit separately'} {open ? <ChevronUp size={14} style={{ verticalAlign: -2 }} /> : <ChevronDown size={14} style={{ verticalAlign: -2 }} />}
                                </button>
                            )}
                        </div>
                        {open ? (
                            <div className={styles.sep}>
                                {group.codes.map((code) => (
                                    <div key={code}>
                                        <span className={styles.mono}>{code}</span>
                                        <div className={styles.fields}>
                                            {kinds.map((kind) => (
                                                <LimitField key={kind} id={`lim-${code}-${kind}`} kind={kind} value={limits[kind][code]} stats={groupStats}
                                                    error={errors.get(['limits', code, kind].join('|'))} onChange={(v) => onSet(kind, [code], v)} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.fields}>
                                {kinds.map((kind) => (
                                    <LimitField key={kind} id={`lim-${group.id}-${kind}`} kind={kind} value={sharedValue(group, limits[kind])} stats={groupStats}
                                        error={group.codes.map((code) => errors.get(['limits', code, kind].join('|'))).find(Boolean)}
                                        onChange={(v) => onSet(kind, group.codes, v)} />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </section>
    )
}
