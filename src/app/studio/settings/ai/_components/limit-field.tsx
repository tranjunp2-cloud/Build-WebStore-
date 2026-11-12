'use client'

import { hitSentence, wouldHaveHit } from '@/lib/admin/ai-settings/limit-stats'
import { UNLIMITED, parseLimitDraft, serializeLimit, type LimitKind } from '@/lib/admin/ai-settings/plan-groups'
import type { GroupStats } from '@/lib/admin/ai-settings/types'
import styles from '../ai-settings.module.css'

/** The four numeric limits of a plan (the fifth kind, AI on/off, is a switch of the plan header). */
export type NumericKind = Exclude<LimitKind, 'enabled'>

interface Props {
    id: string
    kind: NumericKind
    /** stored string ("UNLIMITED" / number) or null when a group's codes differ */
    value: string | null
    stats: GroupStats
    error?: string
    /** AI is off for this plan: the field is greyed out and cannot be edited */
    off?: boolean
    onChange: (value: string) => void
}

const LABEL: Record<NumericKind, string> = {
    budget: 'AI budget per shop / day', pictures: 'Pictures per shop / day',
    monthly: 'Monthly budget per shop', site: 'Website setup budget per shop / day',
}
const NOTE: Partial<Record<NumericKind, string>> = {
    monthly: 'Calendar month, Malaysia time.',
    site: 'Only website setup tasks, rolling 24 hours.',
}
const usd = (n: number) => `$${n.toFixed(n >= 1 ? 2 : 3)}`

export function LimitField({ id, kind, value, stats, error, off = false, onChange }: Props) {
    const mixed = value === null
    const draft = parseLimitDraft(value)
    const spread = kind === 'budget' ? stats.budget : kind === 'pictures' ? stats.pictures : null
    const money = kind !== 'pictures'
    const fmt = (n: number) => (money ? usd(n) : String(Math.round(n)))
    const number = Number(draft.value)
    const typed = !mixed && !draft.unlimited
    const invalid = !off && (Boolean(error) || (typed && (draft.value.trim() === '' || !Number.isFinite(number) || number < 0)))
    const preview = spread && typed && !invalid ? hitSentence(wouldHaveHit(stats.shops, kind as 'budget' | 'pictures', number)) : null
    const hasHit = preview !== null && !preview.startsWith('No shop')
    return (
        <div className={off ? styles.off : undefined}>
            <div className={styles.row}>
                <span className={styles.label} id={`${id}-l`}>{LABEL[kind]}</span>
                <button
                    type="button" role="switch" aria-checked={!mixed && draft.unlimited} disabled={off}
                    aria-labelledby={`${id}-l ${id}-u`} className={styles.switch}
                    onClick={() => onChange(draft.unlimited ? '' : UNLIMITED)}
                >
                    <i /><span id={`${id}-u`}>Unlimited</span>
                </button>
                <span className={`${styles.numIn} ${!typed || off ? styles.disabled : ''} ${invalid ? styles.invalid : ''}`}>
                    {money && <span>$</span>}
                    <input
                        inputMode="decimal" disabled={!typed || off} aria-labelledby={`${id}-l`}
                        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-e` : undefined}
                        value={typed ? draft.value : ''} placeholder={mixed ? 'Differs' : draft.unlimited ? 'No limit' : ''}
                        onChange={(e) => onChange(serializeLimit({ unlimited: false, value: e.target.value }))}
                    />
                </span>
            </div>
            {invalid && <p className={styles.err} id={`${id}-e`}>{error ?? 'Enter a number, 0 or more.'}</p>}
            {spread && !off && (
                <p className={`${styles.small} ${styles.dim}`}>
                    Last 7 days per shop / day: p50 {fmt(spread.p50)} · p90 {fmt(spread.p90)} · max {fmt(spread.max)}
                </p>
            )}
            {!spread && NOTE[kind] && !off && <p className={`${styles.small} ${styles.dim}`}>{NOTE[kind]}</p>}
            {preview && <p className={hasHit ? styles.hit : `${styles.small} ${styles.dim}`}>{preview}</p>}
        </div>
    )
}
