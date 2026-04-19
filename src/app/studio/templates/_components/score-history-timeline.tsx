'use client'
/**
 * ScoreHistoryTimeline — newest-first vertical timeline of up to 20 score runs.
 * Shows date, rubric version, avg score, and delta vs previous entry.
 */
import { ScoreBadge } from './score-badge'

export type ScoreHistoryEntry = {
    id: string | number
    rubricVersion: string
    avgScore: number
    passRubric: boolean
    scorer?: string
    scoredAt: string
}

type Props = {
    history: ScoreHistoryEntry[]
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function Delta({ current, previous }: { current: number; previous?: number }) {
    if (previous === undefined) return null
    const diff = +(current - previous).toFixed(1)
    if (diff === 0) return <span className="text-[10px] text-muted-foreground">±0</span>
    const isPos = diff > 0
    return (
        <span className={`text-[10px] font-medium ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPos ? '+' : ''}{diff}
        </span>
    )
}

export function ScoreHistoryTimeline({ history }: Props) {
    if (history.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-4 text-center">
                No score history yet. Run a score to start tracking.
            </p>
        )
    }

    return (
        <ol className="relative space-y-0 border-l border-border ml-2">
            {history.map((entry, i) => {
                const prev = history[i + 1]
                return (
                    <li key={entry.id} className="pl-4 pb-4 relative">
                        {/* Timeline dot */}
                        <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border border-background" />

                        <div className="flex items-center gap-2 flex-wrap">
                            <ScoreBadge avgScore={entry.avgScore} pass={entry.passRubric} size="sm" />
                            <Delta current={entry.avgScore} previous={prev?.avgScore} />
                            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                {entry.rubricVersion}
                            </span>
                            {entry.scorer && entry.scorer !== 'manual' && (
                                <span className="text-[10px] text-muted-foreground">{entry.scorer}</span>
                            )}
                        </div>

                        <time className="block text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(entry.scoredAt)}
                        </time>
                    </li>
                )
            })}
        </ol>
    )
}
