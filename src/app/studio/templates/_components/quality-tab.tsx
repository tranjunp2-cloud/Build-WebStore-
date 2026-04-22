'use client'
/**
 * QualityTab — composites ScoreBadge + ScoreBreakdown11Dim + RubricVersionPicker
 * + ScoreHistoryTimeline + re-score button.
 *
 * Plain fetch + useState — no TanStack Query (KISS per spec).
 * Loads quality data on mount; re-scores on button click.
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ScoreBadge } from './score-badge'
import { ScoreBreakdown11Dim } from './score-breakdown-11dim'
import { RubricVersionPicker } from './rubric-version-picker'
import { ScoreHistoryTimeline } from './score-history-timeline'
import type { RubricVersionValue } from './rubric-version-picker'
import type { DimensionRow } from './score-breakdown-11dim'
import type { ScoreHistoryEntry } from './score-history-timeline'

type QualityScore = {
    id: string | number
    rubricVersion: string
    avgScore: number
    passRubric: boolean
    scorer?: string
    scoredAt: string
    dimensions?: DimensionRow[]
}

type QualityState = {
    latest: QualityScore | null
    history: ScoreHistoryEntry[]
}

type Props = { templateId: string | number }

export function QualityTab({ templateId }: Props) {
    const [state, setState] = useState<QualityState>({ latest: null, history: [] })
    const [loading, setLoading] = useState(true)
    const [scoring, setScoring] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [version, setVersion] = useState<RubricVersionValue>('v1.3')

    const fetchQuality = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/quality`, { cache: 'no-store' })
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
            const json = await res.json()
            setState(json.data)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load quality data')
        } finally {
            setLoading(false)
        }
    }, [templateId])

    useEffect(() => { fetchQuality() }, [fetchQuality])

    const handleRescore = async () => {
        setScoring(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/templates/${templateId}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rubricVersion: version, scorer: 'manual' }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error ?? `Score failed: ${res.status}`)
            }
            // Reload history after scoring
            await fetchQuality()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Scoring failed')
        } finally {
            setScoring(false)
        }
    }

    const latest = state.latest
    const dimensions: DimensionRow[] = (latest?.dimensions ?? []) as DimensionRow[]

    return (
        <div className="p-4 space-y-5">
            {/* Header row: badge + controls */}
            <div className="flex items-center gap-3 flex-wrap">
                {loading ? (
                    <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
                ) : latest ? (
                    <ScoreBadge avgScore={latest.avgScore} pass={latest.passRubric} size="md" />
                ) : (
                    <span className="text-xs text-muted-foreground">Not scored yet</span>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <RubricVersionPicker value={version} onChange={setVersion} disabled={scoring} />
                    <button
                        onClick={handleRescore}
                        disabled={scoring || loading}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw size={11} className={scoring ? 'animate-spin' : ''} />
                        {scoring ? 'Scoring…' : 'Re-score'}
                    </button>
                </div>
            </div>

            {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            {/* Dimension breakdown */}
            {!loading && (
                <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Breakdown
                    </h3>
                    <ScoreBreakdown11Dim dimensions={dimensions} />
                </section>
            )}

            {/* History timeline */}
            {!loading && (
                <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        History
                    </h3>
                    <ScoreHistoryTimeline history={state.history} />
                </section>
            )}
        </div>
    )
}
