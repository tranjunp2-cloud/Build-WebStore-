/** Small presentational pieces shared by the AI usage screens (no client state; safe in server components). */
import Link from 'next/link'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { PLAN_GROUP_LABELS, type PlanGroup } from '@/lib/admin/ai-usage/groups'
import type { Outcome } from '@/lib/admin/ai-usage/log-filters'

export function PlanBadge({ plan }: { plan: PlanGroup }) {
    return <span className="badge au-plan">{PLAN_GROUP_LABELS[plan]}</span>
}

const OUTCOME_UI: Record<Outcome, { label: string; cls: string }> = {
    ok: { label: 'OK', cls: 'b-live' },
    refused: { label: 'No result', cls: 'b-review' },
    error: { label: 'Error', cls: 'b-error' },
}
export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
    return <span className={`badge ${OUTCOME_UI[outcome].cls}`}>{OUTCOME_UI[outcome].label}</span>
}

export const UnpricedBadge = () => <span className="badge b-unpriced">Unpriced</span>

/** Change vs the previous period. `upIsGood` decides the tone; `pts` shows percentage points instead of percent. */
/** `noEarlier`: the earlier period had nothing to compare with (a rate of 0 % there is not a real 0 %). */
export function Delta({ current, previous, upIsGood, kind = 'pct', noEarlier = false }: { current: number; previous: number; upIsGood: boolean; kind?: 'pct' | 'pts'; noEarlier?: boolean }) {
    if (noEarlier || (kind === 'pct' && !previous)) return <div className="aiq-metric-delta">No earlier data</div>
    if (Math.abs(current - previous) < 1e-9) return <div className="aiq-metric-delta"><Minus size={12} />No change</div>
    const up = current > previous
    const text = kind === 'pts' ? `${Math.abs(current - previous).toFixed(1)} pts` : `${Math.abs(((current - previous) / previous) * 100).toFixed(1)}%`
    return <div className="aiq-metric-delta" data-tone={up === upIsGood ? 'good' : 'bad'}>{up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{text}</div>
}

export function Metric({ label, value, unit, delta, spark }: { label: string; value: string; unit?: string; delta?: ReactNode; spark?: ReactNode }) {
    return (
        <div className="aiq-metric">
            <div className="aiq-metric-label">{label}</div>
            <div className="aiq-metric-val">{value}{unit && <span className="aiq-metric-unit">{unit}</span>}</div>
            {delta}
            {spark && <div className="aiq-metric-spark">{spark}</div>}
        </div>
    )
}

export function CardHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
    return (
        <div className="card-head aiq-card-head" style={{ justifyContent: 'space-between' }}>
            <div><div className="card-title">{title}</div>{sub && <div className="card-sub">{sub}</div>}</div>
            {action}
        </div>
    )
}

export const GoLink = ({ href, children }: { href: string; children: ReactNode }) => (
    <Link className="au-link" href={href}>{children}<ChevronRight size={14} /></Link>
)

/** Row-wide link: the table row itself is not clickable, the main cell is; the chevron cell repeats it for pointers. */
export const RowGo = ({ href, label }: { href: string; label: string }) => (
    <td className="au-go"><Link href={href} aria-label={label} className="au-rowlink"><ChevronRight size={14} /></Link></td>
)

export function ErrorState({ what, retryHref }: { what: string; retryHref: string }) {
    return (
        <div className="card au-state" role="alert">
            <AlertTriangle size={20} className="au-err-txt" />
            <p className="au-err">Could not load {what}.</p>
            <p>The data source did not answer. Nothing was changed. Try again in a moment.</p>
            <Link className="btn btn-sm" href={retryHref}>Try again</Link>
        </div>
    )
}

export function EmptyState({ title, text }: { title: string; text: string }) {
    return <div className="au-state"><strong>{title}</strong><p>{text}</p></div>
}
