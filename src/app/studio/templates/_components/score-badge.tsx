'use client'
/**
 * ScoreBadge — compact score indicator with color coding.
 * ≥7 green | ≥5 amber | <5 red. Pass rubric adds a checkmark ring.
 */

type Props = {
    avgScore: number
    pass: boolean
    size?: 'sm' | 'md'
}

function scoreColor(score: number): string {
    if (score >= 7) return 'bg-emerald-100 text-emerald-700 ring-emerald-300'
    if (score >= 5) return 'bg-amber-100 text-amber-700 ring-amber-300'
    return 'bg-red-100 text-red-700 ring-red-300'
}

export function ScoreBadge({ avgScore, pass, size = 'md' }: Props) {
    const colorClass = scoreColor(avgScore)
    const isSm = size === 'sm'

    return (
        <span
            title={`Score: ${avgScore}/10 — ${pass ? 'Passes rubric' : 'Below threshold'}`}
            className={[
                'inline-flex items-center gap-1 rounded-full font-semibold tabular-nums',
                colorClass,
                isSm ? 'px-1.5 py-0.5 text-[10px] ring-1' : 'px-2.5 py-1 text-xs ring-1',
            ].join(' ')}
        >
            {avgScore.toFixed(1)}
            {pass && <span aria-hidden="true">✓</span>}
        </span>
    )
}
