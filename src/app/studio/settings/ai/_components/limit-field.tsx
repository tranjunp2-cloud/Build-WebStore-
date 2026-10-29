'use client'

import { hitSentence, wouldHaveHit } from '@/lib/admin/ai-settings/limit-stats'
import { UNLIMITED, parseLimitDraft, serializeLimit, type LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { GroupStats } from '@/lib/admin/ai-settings/types'
import styles from '../ai-settings.module.css'

interface Props {
    id: string
    kind: LimitKind
    /** stored string ("UNLIMITED" / number) or null when a group's codes differ */
    value: string | null
    stats: GroupStats
    error?: string
    onChange: (value: string) => void
}

const usd = (n: number) => `$${n.toFixed(n >= 1 ? 2 : 3)}`

export function LimitField({ id, kind, value, stats, error, onChange }: Props) {
    const mixed = value === null
    const draft = parseLimitDraft(value)
    const spread = kind === 'budget' ? stats.budget : stats.pictures
    const fmt = (n: number) => (kind === 'budget' ? usd(n) : String(Math.round(n)))
    const number = Number(draft.value)
    const typed = !mixed && !draft.unlimited
    const invalid = Boolean(error) || (typed && (draft.value.trim() === '' || !Number.isFinite(number) || number < 0))
    const preview = typed && !invalid ? hitSentence(wouldHaveHit(stats.shops, kind, number)) : null
    const label = kind === 'budget' ? 'AI budget per shop / day' : 'Pictures per shop / day'
    const hasHit = preview !== null && !preview.startsWith('No shop')
    return (
        <div>
            <div className={styles.row}>
                <span className={styles.label} id={`${id}-l`}>{label}</span>
                <button
                    type="button" role="switch" aria-checked={!mixed && draft.unlimited}
                    aria-labelledby={`${id}-l ${id}-u`} className={styles.switch}
                    onClick={() => onChange(draft.unlimited ? '' : UNLIMITED)}
                >
                    <i /><span id={`${id}-u`}>Unlimited</span>
                </button>
                <span className={`${styles.numIn} ${!typed ? styles.disabled : ''} ${invalid ? styles.invalid : ''}`}>
                    {kind === 'budget' && <span>$</span>}
                    <input
                        inputMode="decimal" disabled={!typed} aria-labelledby={`${id}-l`}
                        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-e` : undefined}
                        value={typed ? draft.value : ''} placeholder={mixed ? 'Differs' : draft.unlimited ? 'No limit' : ''}
                        onChange={(e) => onChange(serializeLimit({ unlimited: false, value: e.target.value }))}
                    />
                </span>
            </div>
            {invalid && <p className={styles.err} id={`${id}-e`}>{error ?? 'Enter a number, 0 or more.'}</p>}
            <p className={`${styles.small} ${styles.dim}`}>
                Last 7 days per shop / day: p50 {fmt(spread.p50)} · p90 {fmt(spread.p90)} · max {fmt(spread.max)}
            </p>
            {preview && <p className={hasHit ? styles.hit : `${styles.small} ${styles.dim}`}>{preview}</p>}
        </div>
    )
}
