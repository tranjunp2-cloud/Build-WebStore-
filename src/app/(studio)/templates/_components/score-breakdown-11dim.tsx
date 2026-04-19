'use client'
/**
 * ScoreBreakdown11Dim — vertical list of dimension bars.
 * Shows score/10, weight badge, and criteriaMet/criteriaTotal per dimension.
 */

export type DimensionRow = {
    name: string
    score: number
    weight: number
    criteriaMet: number
    criteriaTotal: number
}

type Props = {
    dimensions: DimensionRow[]
}

function barColor(score: number): string {
    if (score >= 7) return 'bg-emerald-500'
    if (score >= 5) return 'bg-amber-400'
    return 'bg-red-400'
}

function scoreTextColor(score: number): string {
    if (score >= 7) return 'text-emerald-700'
    if (score >= 5) return 'text-amber-700'
    return 'text-red-600'
}

export function ScoreBreakdown11Dim({ dimensions }: Props) {
    if (dimensions.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-4 text-center">
                No dimension data. Run a score first.
            </p>
        )
    }

    return (
        <ul className="space-y-3">
            {dimensions.map((d) => (
                <li key={d.name}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs font-medium truncate flex-1">{d.name}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 flex-shrink-0">
                            w{d.weight}
                        </span>
                        <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${scoreTextColor(d.score)}`}>
                            {d.score.toFixed(1)}/10
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${barColor(d.score)}`}
                            style={{ width: `${Math.min(100, (d.score / 10) * 100)}%` }}
                        />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                        {d.criteriaMet}/{d.criteriaTotal} criteria met
                    </div>
                </li>
            ))}
        </ul>
    )
}
