'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CreateIssueModal } from '@/app/studio/_components/modals/create-issue-modal'
import { SeverityPill } from './severity-pill'
import type { IssueRecord, LiveError, LiveErrorFrame, RuntimePromotionInput } from './issue-types'

const SOURCE_LABEL = {
    sentry: 'Sentry',
    vercel: 'Vercel',
} as const

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
})

function formatDateTime(value: string): string {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Unknown' : `${DATE_TIME_FORMAT.format(date)} UTC`
}

function frameLabel(frame: LiveErrorFrame): string {
    const location = [frame.filename, frame.line !== null ? `line ${frame.line}` : null].filter(Boolean).join(' · ')
    const scope = [frame.module, frame.function].filter(Boolean).join(' · ')
    return scope ? `${scope}${location ? ` — ${location}` : ''}` : location || 'Application frame'
}

async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? `Provider request failed (${response.status})`
}

function EvidenceValue({
    label,
    value,
    code = false,
}: {
    label: string
    value: string | number | null | undefined
    code?: boolean
}) {
    const rendered = value === null || value === undefined || value === '' ? 'Unknown' : String(value)

    return (
        <div className="min-w-0 rounded-md bg-[var(--bg-sunk)] p-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]">{label}</dt>
            <dd className="mt-1 break-words text-xs font-medium text-[var(--text)]">
                {code ? <code translate="no">{rendered}</code> : rendered}
            </dd>
        </div>
    )
}

export function LiveErrorDetailDrawer({
    error,
    relatedError,
    onClose,
    onPromoted,
}: {
    error: LiveError | null
    relatedError: LiveError | null
    onClose: () => void
    onPromoted: (issue: IssueRecord, created: boolean) => void
}) {
    const [detail, setDetail] = useState<LiveError | null>(null)
    const [detailFetchedAt, setDetailFetchedAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [showPromotion, setShowPromotion] = useState(false)
    const [retryToken, setRetryToken] = useState(0)

    useEffect(() => {
        if (!error) {
            setDetail(null)
            setDetailFetchedAt(null)
            setDetailError(null)
            setShowPromotion(false)
            return
        }

        if (error.source === 'vercel') {
            setDetail(error)
            setDetailFetchedAt(null)
            setDetailError(null)
            setLoading(false)
            setShowPromotion(false)
            return
        }

        const controller = new AbortController()
        setDetail(null)
        setDetailFetchedAt(null)
        setDetailError(null)
        setLoading(true)

        void (async () => {
            try {
                const params = new URLSearchParams({
                    source: error.source,
                    id: error.providerId,
                })
                const response = await fetch(`/api/admin/issues/providers?${params}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                })
                if (!response.ok) throw new Error(await responseError(response))

                const result = (await response.json()) as {
                    data?: LiveError
                    fetchedAt?: string
                }
                if (!result.data) throw new Error('Provider detail response was empty')
                setDetail(result.data)
                setDetailFetchedAt(result.fetchedAt ?? null)
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
                setDetailError(fetchError instanceof Error ? fetchError.message : 'Provider detail request failed')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        })()

        return () => controller.abort()
    }, [error, retryToken])

    const displayed = detail ?? error
    const promotion = useMemo<RuntimePromotionInput | null>(() => {
        if (!displayed || displayed.source !== 'sentry') return null
        const source = SOURCE_LABEL[displayed.source]
        const normalizedMessage = displayed.message.replace(/\s+/g, ' ').trim()

        return {
            source: displayed.source,
            providerId: displayed.providerId,
            title: `${source}: ${normalizedMessage}`.slice(0, 300),
            severity: displayed.severity,
        }
    }, [displayed, relatedError])

    return (
        <>
            <Dialog
                open={!!error}
                onOpenChange={(open) => {
                    if (!open) onClose()
                }}
            >
                <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden overscroll-contain p-0 sm:max-w-3xl">
                    <DialogHeader className="border-b border-[var(--border)] px-6 pb-4 pt-6 pr-12 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                            {displayed && <SeverityPill severity={displayed.severity} />}
                            {displayed && (
                                <span className="rounded border border-[var(--border)] bg-[var(--bg-sunk)] px-2 py-1 text-[10px] font-semibold text-[var(--text-2)]">
                                    {SOURCE_LABEL[displayed.source]}
                                </span>
                            )}
                            {relatedError && (
                                <span className="rounded bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                    Related {SOURCE_LABEL[relatedError.source]} evidence
                                </span>
                            )}
                        </div>
                        <DialogTitle className="break-words pr-2 text-lg leading-7 text-[var(--text)]">
                            {displayed?.message ?? 'Live error detail'}
                        </DialogTitle>
                        <DialogDescription>
                            {displayed
                                ? `${formatDateTime(displayed.occurredAt)} · temporary provider evidence`
                                : 'Loading temporary provider evidence…'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        {loading && (
                            <div className="rounded-md border border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-3 text-sm text-[var(--text-2)]">
                                Loading provider detail…
                            </div>
                        )}

                        {detailError && (
                            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 p-4">
                                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                    Additional provider detail is unavailable
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                                    {detailError}. The safe list evidence below remains available.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 min-h-11 border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]"
                                    onClick={() => setRetryToken((value) => value + 1)}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    Retry Detail
                                </Button>
                            </div>
                        )}

                        {displayed && (
                            <>
                                <section aria-labelledby="live-error-evidence">
                                    <h3 id="live-error-evidence" className="text-sm font-semibold text-[var(--text)]">
                                        Safe evidence
                                    </h3>
                                    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <EvidenceValue
                                            label="Tenant"
                                            value={
                                                displayed.tenantMatch?.name ?? displayed.tenantMatch?.slug ?? 'Unknown'
                                            }
                                        />
                                        <EvidenceValue label="Host" value={displayed.host} code />
                                        <EvidenceValue label="Route" value={displayed.route} code />
                                        <EvidenceValue
                                            label="Method / status"
                                            value={
                                                [
                                                    displayed.method,
                                                    displayed.statusCode !== null
                                                        ? `HTTP ${displayed.statusCode}`
                                                        : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ') || null
                                            }
                                            code
                                        />
                                        <EvidenceValue label="Release" value={displayed.release} code />
                                        <EvidenceValue label="Deployment" value={displayed.deploymentId} code />
                                        <EvidenceValue label="Request ID" value={displayed.requestId} code />
                                        <EvidenceValue label="Trace ID" value={displayed.traceId} code />
                                    </dl>
                                </section>

                                {(displayed.frames?.length ?? 0) > 0 && (
                                    <section aria-labelledby="live-error-frames">
                                        <h3 id="live-error-frames" className="text-sm font-semibold text-[var(--text)]">
                                            In-application frames
                                        </h3>
                                        <ol className="mt-3 space-y-2">
                                            {displayed.frames.slice(0, 5).map((frame, index) => (
                                                <li
                                                    key={`${frame.filename ?? 'frame'}:${frame.line ?? index}:${frame.function ?? index}`}
                                                    className="break-words rounded-md border border-[var(--border)] bg-[var(--bg-sunk)] px-3 py-2 font-mono text-xs text-[var(--text-2)]"
                                                    translate="no"
                                                >
                                                    {frameLabel(frame)}
                                                </li>
                                            ))}
                                        </ol>
                                    </section>
                                )}

                                <section
                                    aria-labelledby="live-error-guidance"
                                    className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4"
                                >
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-emerald-700 dark:text-emerald-300">
                                        {displayed.guidance.label || 'Suggested next checks'}
                                    </p>
                                    <h3
                                        id="live-error-guidance"
                                        className="mt-1 text-sm font-semibold text-[var(--text)]"
                                    >
                                        {displayed.guidance.investigationArea}
                                    </h3>
                                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--text-2)]">
                                        {displayed.guidance.checks.map((check) => (
                                            <li key={check}>{check}</li>
                                        ))}
                                    </ol>
                                    <div className="mt-4 border-t border-emerald-500/20 pt-3">
                                        <p className="text-xs font-semibold text-[var(--text)]">Escalation condition</p>
                                        <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                                            {displayed.guidance.escalationCondition}
                                        </p>
                                    </div>
                                </section>

                                {relatedError && (
                                    <section className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
                                        <h3 className="text-sm font-semibold text-[var(--text)]">
                                            Exact related {SOURCE_LABEL[relatedError.source]} evidence
                                        </h3>
                                        <p className="mt-1 break-words text-xs leading-5 text-[var(--text-2)]">
                                            {relatedError.message}
                                        </p>
                                    </section>
                                )}

                                {detailFetchedAt && (
                                    <p className="text-xs text-[var(--text-3)]">
                                        Detail fetched {formatDateTime(detailFetchedAt)}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {displayed && (
                        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--bg-sunk)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                            {displayed.providerUrl ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="min-h-11 border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]"
                                >
                                    <a href={displayed.providerUrl} target="_blank" rel="noreferrer">
                                        Open in {SOURCE_LABEL[displayed.source]}
                                        <ExternalLink aria-hidden="true" />
                                    </a>
                                </Button>
                            ) : (
                                <span />
                            )}
                            <Button
                                type="button"
                                className="min-h-11"
                                onClick={() => setShowPromotion(true)}
                                disabled={!promotion}
                            >
                                Create Tracked Issue
                            </Button>
                            {displayed.source === 'vercel' && (
                                <p className="max-w-sm text-xs leading-5 text-[var(--text-3)]">
                                    Vercel promotion is blocked until a stable server refetch contract passes the live delivery gate.
                                </p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {showPromotion && promotion && (
                <CreateIssueModal
                    runtimePromotion={promotion}
                    onClose={() => setShowPromotion(false)}
                    onCreated={(issue, created) => {
                        if (!issue) return
                        setShowPromotion(false)
                        onPromoted(issue, created ?? true)
                    }}
                />
            )}
        </>
    )
}
