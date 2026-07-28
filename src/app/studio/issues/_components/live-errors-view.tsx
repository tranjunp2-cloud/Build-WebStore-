'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { SeverityPill } from './severity-pill'
import { LiveErrorDetailDrawer } from './live-error-detail-drawer'
import type { IssueRecord, LiveError, LiveErrorSource } from './issue-types'

type SourceStatus = 'idle' | 'loading' | 'success' | 'error'

interface SourceState {
    status: SourceStatus
    data: LiveError[]
    fetchedAt: string | null
    manualFetchAt: string | null
    error: string | null
}

type SourceStates = Record<LiveErrorSource, SourceState>
type SourceFilter = 'all' | LiveErrorSource

const EMPTY_SOURCE_STATE: SourceState = {
    status: 'idle',
    data: [],
    fetchedAt: null,
    manualFetchAt: null,
    error: null,
}

const SOURCE_LABEL: Record<LiveErrorSource, string> = {
    sentry: 'Sentry',
    vercel: 'Vercel',
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
})

function formatDateTime(value: string | null): string {
    if (!value) return 'Not fetched'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Unknown' : `${DATE_TIME_FORMAT.format(date)} UTC`
}

function findRelatedError(error: LiveError, candidates: LiveError[]): LiveError | null {
    return (
        candidates.find(
            (candidate) =>
                candidate.source !== error.source &&
                (
                    (!!error.requestId && error.requestId === candidate.requestId)
                    || (!!error.traceId && error.traceId === candidate.traceId)
                ),
        ) ?? null
    )
}

function latestOccurrence(errors: LiveError[]): string | null {
    let latest: string | null = null
    let latestTime = Number.NEGATIVE_INFINITY

    for (const error of errors) {
        const time = new Date(error.occurredAt).getTime()
        if (!Number.isNaN(time) && time > latestTime) {
            latest = error.occurredAt
            latestTime = time
        }
    }

    return latest
}

async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? `Provider request failed (${response.status})`
}

function SourceSummary({
    source,
    state,
    onRetry,
}: {
    source: LiveErrorSource
    state: SourceState
    onRetry: () => void
}) {
    const isLoading = state.status === 'loading'
    const isUnavailable = state.status === 'error'
    const latest = latestOccurrence(state.data)

    return (
        <section
            aria-label={`${SOURCE_LABEL[source]} status`}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4"
        >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[var(--text)]">{SOURCE_LABEL[source]}</h2>
                        <span
                            className={[
                                'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold',
                                isUnavailable
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : isLoading
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                            ].join(' ')}
                        >
                            {isUnavailable ? 'Unavailable' : isLoading ? 'Fetching…' : `${state.data.length} errors`}
                        </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-3)]">
                        Latest event: {formatDateTime(latest)}
                        <br />
                        Provider fetch: {formatDateTime(state.fetchedAt)}
                        <br />
                        Manual request: {formatDateTime(state.manualFetchAt)}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    onClick={onRetry}
                    disabled={isLoading}
                >
                    <RefreshCw
                        aria-hidden="true"
                        size={14}
                        className={isLoading ? 'animate-spin motion-reduce:animate-none' : ''}
                    />
                    {isLoading ? 'Fetching…' : isUnavailable ? 'Retry' : 'Refresh'}
                </button>
            </div>
            {state.error && (
                <p
                    role="alert"
                    className="mt-3 flex items-start gap-2 text-xs leading-5 text-red-600 dark:text-red-400"
                >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                    <span>
                        {state.error}
                        {state.data.length > 0 ? ' Showing the last successful result.' : ' Retry this source.'}
                    </span>
                </p>
            )}
            {state.status === 'success' && state.data.length === 0 && (
                <p className="mt-3 text-xs text-[var(--text-2)]">No qualifying errors returned by this source.</p>
            )}
        </section>
    )
}

function LiveErrorRow({ error, related, onOpen }: { error: LiveError; related: LiveError | null; onOpen: () => void }) {
    return (
        <button
            type="button"
            className="iss-row w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={onOpen}
        >
            <div className="iss-row-head min-w-0">
                <span
                    aria-hidden="true"
                    className={`sev-dot ${
                        error.severity === 'critical'
                            ? 'sev-danger'
                            : error.severity === 'high'
                              ? 'sev-warn'
                              : error.severity === 'medium'
                                ? 'sev-accent'
                                : 'sev-muted'
                    }`}
                />
                <span className="iss-title min-w-0 break-words">{error.message}</span>
            </div>
            <div className="iss-row-meta">
                <span className="iss-block-chip">{SOURCE_LABEL[error.source]}</span>
                <SeverityPill severity={error.severity} />
                {error.statusCode !== null && (
                    <span className="iss-status-chip iss-status-danger">HTTP {error.statusCode}</span>
                )}
                {related && (
                    <span className="iss-status-chip iss-status-accent">
                        Related {SOURCE_LABEL[related.source]} evidence
                    </span>
                )}
            </div>
            <div className="iss-row-stats">
                <span>
                    Tenant: <b>{error.tenantMatch?.name ?? error.tenantMatch?.slug ?? 'Unknown'}</b>
                </span>
                <span>
                    Host: <b>{error.host ?? 'Unknown'}</b>
                </span>
                <span>
                    Route: <b>{error.route ?? 'Unknown'}</b>
                </span>
                <span>
                    Occurred: <b>{formatDateTime(error.occurredAt)}</b>
                </span>
            </div>
        </button>
    )
}

export function LiveErrorsView({ onPromoted }: { onPromoted: (issue: IssueRecord, created: boolean) => void }) {
    const [sources, setSources] = useState<SourceStates>({
        sentry: { ...EMPTY_SOURCE_STATE, status: 'loading' },
        vercel: { ...EMPTY_SOURCE_STATE, status: 'loading' },
    })
    const [filter, setFilter] = useState<SourceFilter>('all')
    const [selected, setSelected] = useState<LiveError | null>(null)
    const controllers = useRef<Partial<Record<LiveErrorSource, AbortController>>>({})

    const fetchSource = useCallback(async (source: LiveErrorSource) => {
        controllers.current[source]?.abort()
        const controller = new AbortController()
        controllers.current[source] = controller

        setSources((current) => ({
            ...current,
            [source]: {
                ...current[source],
                status: 'loading',
                error: null,
            },
        }))

        try {
            const response = await fetch(`/api/admin/issues/providers?source=${source}`, {
                cache: 'no-store',
                signal: controller.signal,
            })
            if (!response.ok) throw new Error(await responseError(response))

            const result = (await response.json()) as {
                data?: LiveError[]
                fetchedAt?: string
            }
            if (!Array.isArray(result.data)) throw new Error('Provider response was invalid')
            const data = result.data
            setSources((current) => ({
                ...current,
                [source]: {
                    status: 'success',
                    data,
                    fetchedAt: result.fetchedAt ?? null,
                    manualFetchAt: new Date().toISOString(),
                    error: null,
                },
            }))
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return
            setSources((current) => ({
                ...current,
                [source]: {
                    ...current[source],
                    status: 'error',
                    manualFetchAt: new Date().toISOString(),
                    error: error instanceof Error ? error.message : 'Provider request failed',
                },
            }))
        }
    }, [])

    useEffect(() => {
        void fetchSource('sentry')
        void fetchSource('vercel')

        return () => {
            controllers.current.sentry?.abort()
            controllers.current.vercel?.abort()
        }
    }, [fetchSource])

    const allErrors = useMemo(
        () =>
            [...sources.sentry.data, ...sources.vercel.data].sort(
                (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
            ),
        [sources],
    )
    const visibleErrors = filter === 'all' ? allErrors : allErrors.filter((error) => error.source === filter)
    const selectedRelated = selected ? findRelatedError(selected, allErrors) : null
    const initialLoading =
        (sources.sentry.status === 'loading' || sources.vercel.status === 'loading') && allErrors.length === 0
    const totalFailure =
        sources.sentry.status === 'error' && sources.vercel.status === 'error' && allErrors.length === 0
    const filteredSource = filter === 'all' ? null : sources[filter]
    const filteredLoading = filteredSource?.status === 'loading' && filteredSource.data.length === 0

    return (
        <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-live="polite">
                <SourceSummary source="sentry" state={sources.sentry} onRetry={() => void fetchSource('sentry')} />
                <SourceSummary source="vercel" state={sources.vercel} onRetry={() => void fetchSource('vercel')} />
            </div>

            <div className="gen-filters">
                <div className="seg" role="group" aria-label="Filter live errors by source">
                    {(['all', 'sentry', 'vercel'] as const).map((source) => (
                        <button
                            key={source}
                            type="button"
                            className={`${filter === source ? 'active ' : ''}min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                            aria-pressed={filter === source}
                            onClick={() => setFilter(source)}
                        >
                            {source === 'all'
                                ? `All (${allErrors.length})`
                                : `${SOURCE_LABEL[source]} (${sources[source].data.length})`}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="btn min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    onClick={() => {
                        void fetchSource('sentry')
                        void fetchSource('vercel')
                    }}
                    disabled={sources.sentry.status === 'loading' || sources.vercel.status === 'loading'}
                >
                    <RefreshCw aria-hidden="true" size={14} />
                    Refresh both
                </button>
            </div>

            <div className="iss-list scroll-thin" aria-live="polite">
                {(initialLoading || filteredLoading) && (
                    <div className="space-y-2" aria-label="Loading live errors">
                        {[0, 1, 2].map((item) => (
                            <div
                                key={item}
                                className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--bg-sunk)] motion-reduce:animate-none"
                            />
                        ))}
                    </div>
                )}
                {totalFailure && (
                    <div
                        className="empty-state rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]"
                        role="alert"
                    >
                        <AlertTriangle aria-hidden="true" className="mx-auto mb-2 text-red-500" size={24} />
                        <p className="text-sm font-semibold text-[var(--text)]">Live errors are unavailable</p>
                        <p className="mt-1 text-xs text-[var(--text-2)]">
                            Retry Sentry or Vercel independently above. Tracked issues remain available.
                        </p>
                    </div>
                )}
                {!initialLoading &&
                    !filteredLoading &&
                    !totalFailure &&
                    filteredSource?.status === 'error' &&
                    filteredSource.data.length === 0 && (
                        <div
                            className="empty-state rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]"
                            role="alert"
                        >
                            <p className="text-sm font-semibold text-[var(--text)]">
                                {SOURCE_LABEL[filter as LiveErrorSource]} is unavailable
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-2)]">Use the source retry control above.</p>
                        </div>
                    )}
                {!initialLoading &&
                    !filteredLoading &&
                    !totalFailure &&
                    visibleErrors.length === 0 &&
                    filteredSource?.status !== 'error' && (
                        <div className="empty-state rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
                            <p className="text-sm font-semibold text-[var(--text)]">No live errors</p>
                            <p className="mt-1 text-xs text-[var(--text-2)]">
                                No qualifying errors were returned for this filter.
                            </p>
                        </div>
                    )}
                {visibleErrors.map((error) => (
                    <LiveErrorRow
                        key={`${error.source}:${error.providerId}`}
                        error={error}
                        related={findRelatedError(error, allErrors)}
                        onOpen={() => setSelected(error)}
                    />
                ))}
            </div>

            <LiveErrorDetailDrawer
                error={selected}
                relatedError={selectedRelated}
                onClose={() => setSelected(null)}
                onPromoted={onPromoted}
            />
        </>
    )
}
