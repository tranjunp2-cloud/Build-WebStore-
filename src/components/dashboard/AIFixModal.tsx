'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import type { MissingSeoItem } from './views/SEOView'

interface AIFixModalProps {
    isOpen: boolean
    onClose: () => void
    onSettled?: () => void
    siteId?: string | number | null
    revisionToken?: string | null
    missingSeoItems?: MissingSeoItem[]
}

interface ProposedFix {
    id: string
    targetId: string
    collection: string
    name: string
    proposedTitle?: string
    proposedDescription?: string
    currentTitle?: string
    currentDescription?: string
}

type ModalState = 'loading' | 'review' | 'applying' | 'done' | 'error'

export function selectAppliedFixes<
    T extends { collection: string; targetId: string },
>(selected: readonly T[], undoData: unknown): T[] {
    if (!Array.isArray(undoData)) return []
    const appliedKeys = new Set(
        undoData.flatMap((undo: unknown) => {
            if (!undo || typeof undo !== 'object') return []
            const record = undo as Record<string, unknown>
            return typeof record.collection === 'string' &&
                typeof record.targetId === 'string'
                ? [record.collection + '-' + record.targetId]
                : []
        }),
    )
    return selected.filter((fix) =>
        appliedKeys.has(fix.collection + '-' + fix.targetId),
    )
}

const fixKey = (fix: ProposedFix) => `${fix.collection}-${fix.id}`

const UNDO_STORAGE_KEY = 'seo-fix-undo-backup'
const UNDO_TTL_MS = 5 * 60 * 1000
const REVISION_TOKEN_PATTERN = /^[a-f0-9]{64}$/
const UNDO_TOKEN_PATTERN = /^\d{13}\.[a-f0-9]{64}$/

interface StoredUndo {
    data: unknown
    siteId: string
    revisionToken: string
    undoToken: string
}

export interface UndoContinuation {
    data: unknown[]
    revisionToken: string
    undoToken: string
}

export function parseUndoContinuation(payload: unknown): UndoContinuation | null {
    if (!payload || typeof payload !== 'object') return null
    const record = payload as Record<string, unknown>
    if (Number(record.failedCount) <= 0) return null
    if (
        !Array.isArray(record.remainingUndoData) ||
        record.remainingUndoData.length === 0 ||
        typeof record.revisionToken !== 'string' ||
        !REVISION_TOKEN_PATTERN.test(record.revisionToken) ||
        typeof record.undoToken !== 'string' ||
        !UNDO_TOKEN_PATTERN.test(record.undoToken)
    )
        return null
    return {
        data: record.remainingUndoData,
        revisionToken: record.revisionToken,
        undoToken: record.undoToken,
    }
}

export function saveUndoToStorage(
    data: unknown,
    siteId: string,
    revisionToken: string,
    undoToken: string,
) {
    try {
        sessionStorage.setItem(
            UNDO_STORAGE_KEY,
            JSON.stringify({ data, siteId, revisionToken, undoToken, timestamp: Date.now() }),
        )
        return true
    } catch (error) {
        console.warn(
            '[AI Fix] Unable to persist undo backup',
            error instanceof Error ? error.name : 'UnknownError',
        )
        return false
    }
}
function loadUndoFromStorage(): StoredUndo | null {
    try {
        const raw = sessionStorage.getItem(UNDO_STORAGE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        const { data, siteId, revisionToken, undoToken, timestamp } = parsed as Record<
            string,
            unknown
        >
        if (
            typeof siteId !== 'string' ||
            typeof revisionToken !== 'string' ||
            !REVISION_TOKEN_PATTERN.test(revisionToken) ||
            typeof undoToken !== 'string' ||
            !UNDO_TOKEN_PATTERN.test(undoToken) ||
            typeof timestamp !== 'number'
        )
            return null
        if (Date.now() - timestamp > UNDO_TTL_MS) {
            sessionStorage.removeItem(UNDO_STORAGE_KEY)
            return null
        }
        return { data, siteId, revisionToken, undoToken }
    } catch {
        return null
    }
}
function clearUndoStorage() {
    try {
        sessionStorage.removeItem(UNDO_STORAGE_KEY)
    } catch (error) {
        console.warn(
            '[AI Fix] Unable to clear undo backup',
            error instanceof Error ? error.name : 'UnknownError',
        )
    }
}

async function loadRevisionToken(
    siteId: string | number,
    signal?: AbortSignal,
): Promise<string | null> {
    const response = await fetch(
        '/api/sites/' + encodeURIComponent(String(siteId)) + '/local-seo-score',
        { cache: 'no-store', signal },
    )
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return null
    const candidate = (payload as Record<string, unknown>).revisionToken
    return typeof candidate === 'string' &&
        REVISION_TOKEN_PATTERN.test(candidate)
        ? candidate
        : null
}

export function AIFixModal({
    isOpen,
    onClose,
    onSettled,
    siteId,
    revisionToken,
    missingSeoItems = [],
}: AIFixModalProps) {
    const { t, ti } = useI18n()
    const router = useRouter()
    const seo = t.dashboard.seo
    const aifix = seo.aifix

    const [state, setState] = useState<ModalState>('loading')
    const [progress, setProgress] = useState(0)
    const [fixes, setFixes] = useState<ProposedFix[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [appliedCount, setAppliedCount] = useState(0)
    const [taskMessages, setTaskMessages] = useState<string[]>([])
    const [abortController, setAbortController] =
        useState<AbortController | null>(null)
    const [activeRevisionToken, setActiveRevisionToken] = useState<
        string | null
    >(null)
    const [undoAvailable, setUndoAvailable] = useState(false)

    // Reset + start when modal opens; abort when closes
    useEffect(() => {
        if (!isOpen) {
            abortController?.abort()
            setAbortController(null)
            setState('loading')
            setProgress(0)
            setFixes([])
            setSelectedIds(new Set())
            setAppliedCount(0)
            setTaskMessages([])
            setActiveRevisionToken(null)
            setUndoAvailable(false)
            return
        }
        if (siteId && missingSeoItems.length > 0) {
            runFixAll()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // ── Stream fixes from API ──────────────────────────────────────────────
    const runFixAll = async () => {
        if (!siteId || missingSeoItems.length === 0) return

        abortController?.abort()
        const controller = new AbortController()
        setAbortController(controller)
        setState('loading')
        setProgress(5)
        setFixes([])
        setTaskMessages([
            ti(seo.fixAllAnalysing, { count: missingSeoItems.length }),
        ])

        try {
            const resolvedRevisionToken = REVISION_TOKEN_PATTERN.test(
                revisionToken ?? '',
            )
                ? revisionToken
                : await loadRevisionToken(siteId, controller.signal)
            if (!resolvedRevisionToken) {
                setState('error')
                setTaskMessages((prev) => [...prev, aifix.errorFailed])
                return
            }
            setActiveRevisionToken(resolvedRevisionToken)

            const res = await fetch('/api/seo/fix-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    siteId: String(siteId),
                    revisionToken: resolvedRevisionToken,
                    missingSeo: missingSeoItems.map((item) => ({
                        collection: item.collection,
                        id: item.id,
                        title: item.title,
                        context: item.context,
                        missingFields: item.missingFields,
                    })),
                }),
            })

            if (!res.ok || !res.body) {
                setState('error')
                setTaskMessages((prev) => [...prev, aifix.errorFailed])
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            const collected: ProposedFix[] = []

            try {
                while (true) {
                    if (controller.signal.aborted) break
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        const jsonStr = line.slice(6).trim()
                        if (!jsonStr) continue
                        try {
                            const data = JSON.parse(jsonStr)
                            if (data.error === 'timeout') {
                                setState('error')
                                setTaskMessages((prev) => [
                                    ...prev,
                                    aifix.errorTimeout,
                                ])
                                // Keep what we have — show review for partial results
                                if (collected.length > 0) {
                                    setFixes([...collected])
                                    initSelection(collected)
                                    setState('review')
                                }
                                return
                            }
                            // Match with original for BR-06 (current values)
                            const original = missingSeoItems.find(
                                (item) =>
                                    String(item.id) === String(data.targetId) &&
                                    item.collection === data.collection,
                            )
                            const fix: ProposedFix = {
                                ...data,
                                currentTitle: original?.currentTitle,
                                currentDescription:
                                    original?.currentDescription,
                            }
                            collected.push(fix)
                            setProgress(
                                Math.min(
                                    90,
                                    Math.round(
                                        (collected.length /
                                            missingSeoItems.length) *
                                            90,
                                    ),
                                ),
                            )
                            setTaskMessages((prev) => {
                                const msg = `${data.proposedTitle ? 'Meta Title' : ''}${data.proposedTitle && data.proposedDescription ? ' + ' : ''}${data.proposedDescription ? 'Meta Desc' : ''} → ${data.name}`
                                return [...prev.slice(-2), msg]
                            })
                        } catch {
                            /* skip */
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }

            if (controller.signal.aborted) return

            if (collected.length === 0) {
                // If we sent items but got 0 back → API errors (e.g. OpenAI quota)
                if (missingSeoItems.length > 0) {
                    setState('error')
                    setTaskMessages((prev) => [...prev, aifix.errorFailed])
                } else {
                    setState('done')
                    setProgress(100)
                    setAppliedCount(0)
                    setTaskMessages([seo.allGood])
                }
                return
            }

            // Stream done → go to REVIEW (not auto-apply)
            setFixes(collected)
            initSelection(collected)
            setProgress(100)
            setState('review')
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return
            setState('error')
            setTaskMessages((prev) => [...prev, aifix.errorFailed])
        }
    }

    // BR-06: field trống → checked. Field bị thay thế (đã có giá trị cũ) → unchecked
    function initSelection(proposedFixes: ProposedFix[]) {
        const defaultSelected = new Set<string>()
        proposedFixes.forEach((fix) => {
            const titleIsReplace = !!(fix.proposedTitle && fix.currentTitle)
            const descIsReplace = !!(
                fix.proposedDescription && fix.currentDescription
            )
            // Only uncheck if ALL proposed fields are replacements
            if (!titleIsReplace && !descIsReplace)
                defaultSelected.add(fixKey(fix))
        })
        setSelectedIds(defaultSelected)
    }

    // ── Apply selected fixes ───────────────────────────────────────────────
    const applyFixes = async () => {
        const selected = fixes.filter((f) => selectedIds.has(fixKey(f)))
        if (selected.length === 0 || !siteId || !activeRevisionToken) return

        setState('applying')
        try {
            const res = await fetch('/api/seo/apply-fixes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'apply',
                    siteId: String(siteId),
                    revisionToken: activeRevisionToken,
                    fixes: selected.map((f) => ({
                        targetId: f.targetId,
                        collection: f.collection,
                        seo: {
                            ...(f.proposedTitle && { title: f.proposedTitle }),
                            ...(f.proposedDescription && {
                                description: f.proposedDescription,
                            }),
                        },
                    })),
                }),
            })

            const data = await res.json()
            if (
                data.success &&
                Array.isArray(data.undoData) &&
                data.undoData.length > 0
            ) {
                const applied = selectAppliedFixes(selected, data.undoData)
                const nextRevisionToken =
                    typeof data.revisionToken === 'string' &&
                    REVISION_TOKEN_PATTERN.test(data.revisionToken)
                        ? data.revisionToken
                        : null
                const nextUndoToken =
                    typeof data.undoToken === 'string' &&
                    UNDO_TOKEN_PATTERN.test(data.undoToken)
                        ? data.undoToken
                        : null
                if (nextRevisionToken && nextUndoToken) {
                    clearUndoStorage()
                    const undoPersisted = saveUndoToStorage(
                        data.undoData,
                        String(siteId),
                        nextRevisionToken,
                        nextUndoToken,
                    )
                    setActiveRevisionToken(nextRevisionToken)
                    setUndoAvailable(undoPersisted)
                } else {
                    clearUndoStorage()
                    setActiveRevisionToken(null)
                    setUndoAvailable(false)
                }
                setAppliedCount(applied.length)
                setTaskMessages(applied.map((fix) => fix.name))
                setState('done')
                if (Number(data.failedCount) > 0) toast.error(aifix.applyFailed)
                router.refresh()
                onSettled?.()
            } else {
                toast.error(aifix.applyFailed)
                setState('review')
            }
        } catch {
            toast.error(aifix.applyFailed)
            setState('review')
        }
    }

    // ── Undo ───────────────────────────────────────────────────────────────
    const handleUndo = useCallback(async () => {
        const undo = loadUndoFromStorage()
        if (!undo) return
        try {
            const res = await fetch('/api/seo/apply-fixes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'undo',
                    siteId: undo.siteId,
                    revisionToken: undo.revisionToken,
                    undoToken: undo.undoToken,
                    fixes: undo.data,
                }),
            })
            const payload: unknown = await res.json()
            if (
                !res.ok ||
                !payload ||
                typeof payload !== 'object' ||
                (payload as Record<string, unknown>).success !== true
            ) {
                toast.error(aifix.applyFailed)
                return
            }

            const continuation = parseUndoContinuation(payload)
            if (Number((payload as Record<string, unknown>).failedCount) > 0) {
                if (continuation) {
                    clearUndoStorage()
                    const undoPersisted = saveUndoToStorage(
                        continuation.data,
                        undo.siteId,
                        continuation.revisionToken,
                        continuation.undoToken,
                    )
                    setActiveRevisionToken(continuation.revisionToken)
                    setUndoAvailable(undoPersisted)
                } else {
                    clearUndoStorage()
                    setActiveRevisionToken(null)
                    setUndoAvailable(false)
                }
                toast.error(aifix.undoPartial)
                router.refresh()
                onSettled?.()
                return
            }

            clearUndoStorage()
            setActiveRevisionToken(null)
            setUndoAvailable(false)
            toast.success(aifix.undoSuccess)
            setState('loading')
            setProgress(0)
            router.refresh()
            onSettled?.()
            onClose()
        } catch {
            toast.error(aifix.applyFailed)
        }
    }, [aifix, router, onClose, onSettled])

    useEffect(() => {
        if (!isOpen || state !== 'done' || !undoAvailable) return
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                handleUndo()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, state, undoAvailable, handleUndo])

    // ── Selection helpers ──────────────────────────────────────────────────
    const toggleFix = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const toggleAll = () => {
        setSelectedIds(
            selectedIds.size === fixes.length
                ? new Set()
                : new Set(fixes.map((f) => fixKey(f))),
        )
    }

    if (!isOpen) return null

    // ── Header ─────────────────────────────────────────────────────────────
    const headerIcon =
        state === 'done' ? (
            <div className="flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0 bg-[#10B981]">
                <Check
                    className="w-5 h-5"
                    style={{ color: '#fff' }}
                    strokeWidth={3}
                />
            </div>
        ) : (
            <div
                className={`flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0 ${state === 'error' ? 'bg-red-500' : 'bg-gradient-to-tr from-[#22D3EE] to-[#3B82F6]'}`}
            >
                <Sparkles
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    strokeWidth={1}
                />
            </div>
        )

    const headerTitle = {
        loading: seo.fixAllProgress,
        review: seo.reviewTitle,
        applying: seo.fixAllProgress,
        done: seo.fixAllComplete,
        error: seo.fixAllFailed,
    }[state]

    const headerSubtitle = {
        loading: aifix.description,
        review: `${fixes.length} ${fixes.length === 1 ? 'fix' : 'fixes'} proposed`,
        applying: aifix.description,
        done: ti(aifix.applySuccess, { count: appliedCount }),
        error: aifix.errorTimeout,
    }[state]

    return createPortal(
        <div
            className="dash-shell fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-[3px] animate-in fade-in duration-200"
            style={{ backgroundColor: 'var(--dash-overlay)' }}
        >
            <div
                className="flex flex-col w-full max-w-[672px] max-h-[85vh] bg-[#1E293B] border border-white/10 rounded-2xl shadow-[0px_25px_50px_-12px_rgba(59,130,246,0.2)] overflow-hidden animate-in zoom-in-95 duration-200 antialiased"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
                {/* Header */}
                <div className="flex flex-col gap-2 px-6 pt-6 pb-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        {headerIcon}
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {headerTitle}
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 pt-1">
                        {headerSubtitle}
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-6 px-6 pt-6 pb-6">
                        {/* ── Loading ── */}
                        {state === 'loading' && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-slate-300 font-medium">
                                            {seo.overallProgress}
                                        </span>
                                        <span className="text-[#38BDF8] font-semibold">
                                            {progress}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-[#0F172A] overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#22D3EE] to-[#3B82F6] transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {taskMessages.slice(-3).map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-3 p-4 rounded-xl border bg-[#064E3B]/40 border-emerald-500/30"
                                        >
                                            <div className="flex bg-[#10B981] w-5 h-5 rounded-[4px] items-center justify-center shrink-0">
                                                <Check
                                                    className="w-3.5 h-3.5"
                                                    style={{ color: '#fff' }}
                                                    strokeWidth={3}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-white">
                                                {msg}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── Error ── */}
                        {state === 'error' && (
                            <div className="flex flex-col gap-3">
                                {taskMessages.slice(-3).map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-3 p-4 rounded-xl border ${idx === taskMessages.slice(-3).length - 1 ? 'bg-red-500/10 border-red-500/30' : 'bg-[#064E3B]/40 border-emerald-500/30'}`}
                                    >
                                        {idx ===
                                        taskMessages.slice(-3).length - 1 ? (
                                            <div className="flex bg-red-500 w-5 h-5 rounded-[4px] items-center justify-center shrink-0">
                                                <span className="text-white text-xs font-bold">
                                                    !
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex bg-[#10B981] w-5 h-5 rounded-[4px] items-center justify-center shrink-0">
                                                <Check
                                                    className="w-3.5 h-3.5"
                                                    style={{ color: '#fff' }}
                                                    strokeWidth={3}
                                                />
                                            </div>
                                        )}
                                        <span
                                            className={`text-sm font-medium ${idx === taskMessages.slice(-3).length - 1 ? 'text-red-400' : 'text-white'}`}
                                        >
                                            {msg}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Review (AC-1 + BR-06) ── */}
                        {(state === 'review' || state === 'applying') && (
                            <div
                                className={`flex flex-col gap-3 ${state === 'applying' ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                                {/* Select all toggle */}
                                <div className="flex items-center justify-between sticky top-0 bg-[#1E293B] z-10 pb-1">
                                    <span className="text-[13px] text-slate-300 font-medium">
                                        {selectedIds.size} / {fixes.length}
                                    </span>
                                    <button
                                        onClick={toggleAll}
                                        className="text-[13px] text-[#38BDF8] hover:underline font-medium"
                                    >
                                        {selectedIds.size === fixes.length
                                            ? seo.deselectAll
                                            : seo.selectAll}
                                    </button>
                                </div>
                                {/* Fix list */}
                                {fixes.map((fix) => {
                                    const titleIsReplace = !!(
                                        fix.proposedTitle && fix.currentTitle
                                    )
                                    const descIsReplace = !!(
                                        fix.proposedDescription &&
                                        fix.currentDescription
                                    )
                                    const hasReplace =
                                        titleIsReplace || descIsReplace
                                    const isChecked = selectedIds.has(
                                        fixKey(fix),
                                    )
                                    return (
                                        <label
                                            key={fixKey(fix)}
                                            className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors duration-200 ${isChecked ? 'bg-emerald-500/10 dark:bg-[#064E3B]/40 border-emerald-500/30' : 'bg-black/[0.02] dark:bg-[#0F172A]/80 border-[#1F2937] hover:border-[#374151]'}`}
                                        >
                                            <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() =>
                                                        toggleFix(fixKey(fix))
                                                    }
                                                    className="peer appearance-none w-[18px] h-[18px] rounded-[4px] border-2 border-[#6B7280] bg-[#1F2937] checked:bg-[#10B981] checked:border-[#10B981] cursor-pointer transition-colors"
                                                />
                                                <svg
                                                    className="absolute w-3 h-3 pointer-events-none opacity-0 peer-checked:opacity-100"
                                                    style={{ color: '#fff' }}
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-sm font-semibold text-white truncate">
                                                        {fix.name}
                                                    </span>
                                                    <span
                                                        className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
                                                        style={{
                                                            background:
                                                                'var(--dash-secondary-bg)',
                                                            color: 'var(--dash-text-muted)',
                                                            border: '1px solid var(--dash-border)',
                                                        }}
                                                    >
                                                        {fix.collection}
                                                    </span>
                                                    {hasReplace && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                                                            {seo.proposedLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                {fix.proposedTitle && (
                                                    <div className="mb-1">
                                                        <span className="text-[10px] text-[#6B7280] uppercase font-semibold tracking-wider">
                                                            Title:{' '}
                                                        </span>
                                                        {titleIsReplace ? (
                                                            <span className="text-[12px] leading-relaxed">
                                                                <span className="text-red-400/80 line-through">
                                                                    {
                                                                        fix.currentTitle
                                                                    }
                                                                </span>
                                                                <span className="text-[#6B7280]">
                                                                    {' '}
                                                                    →{' '}
                                                                </span>
                                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                                    {
                                                                        fix.proposedTitle
                                                                    }
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[12px] text-emerald-600 dark:text-emerald-400">
                                                                {
                                                                    fix.proposedTitle
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {fix.proposedDescription && (
                                                    <div>
                                                        <span className="text-[10px] text-[#6B7280] uppercase font-semibold tracking-wider">
                                                            Desc:{' '}
                                                        </span>
                                                        {descIsReplace ? (
                                                            <span className="text-[12px] leading-relaxed">
                                                                <span className="text-red-400/80 line-through">
                                                                    {fix.currentDescription?.slice(
                                                                        0,
                                                                        60,
                                                                    )}
                                                                    ...
                                                                </span>
                                                                <span className="text-[#6B7280]">
                                                                    {' '}
                                                                    →{' '}
                                                                </span>
                                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                                    {fix.proposedDescription.slice(
                                                                        0,
                                                                        60,
                                                                    )}
                                                                    ...
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[12px] text-emerald-600 dark:text-emerald-400">
                                                                {fix.proposedDescription.slice(
                                                                    0,
                                                                    80,
                                                                )}
                                                                ...
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        )}

                        {/* ── Done ── */}
                        {state === 'done' && (
                            <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex flex-col gap-3.5 p-5 bg-emerald-500/10 dark:bg-[#064E3B]/20 border border-emerald-500/50 rounded-xl max-h-[200px] overflow-y-auto">
                                    {taskMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2"
                                        >
                                            <Check
                                                className="w-[18px] h-[18px] text-emerald-600 dark:text-emerald-500 shrink-0"
                                                strokeWidth={2}
                                            />
                                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                                                {msg}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center p-4 bg-[#0F172A] rounded-xl border border-white/5">
                                    <span className="text-[14px] text-slate-300 font-medium">
                                        {ti(aifix.fixResult, {
                                            count: appliedCount,
                                        })}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    className={`flex items-center gap-3 p-4 lg:px-6 border-t border-white/10 shrink-0 ${state === 'done' ? 'justify-between' : 'justify-end'}`}
                >
                    {state === 'done' && undoAvailable && (
                        <button
                            onClick={handleUndo}
                            className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-[8px] transition-colors"
                        >
                            {aifix.undoLabel}
                        </button>
                    )}

                    {state === 'error' && (
                        <button
                            onClick={() => {
                                setState('loading')
                                setProgress(0)
                                setTaskMessages([])
                                runFixAll()
                            }}
                            className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-[8px] transition-colors"
                        >
                            {seo.error.retry}
                        </button>
                    )}

                    {(state === 'review' || state === 'applying') && (
                        <button
                            onClick={applyFixes}
                            disabled={
                                selectedIds.size === 0 || state === 'applying'
                            }
                            className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] rounded-[8px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {state === 'applying' && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            {state === 'applying'
                                ? aifix.fixing
                                : ti(seo.fixAllApply, {
                                      count: selectedIds.size,
                                  })}
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        disabled={state === 'applying'}
                        className={`px-6 py-2.5 text-[14px] font-medium text-white transition-all shadow-sm rounded-[8px] ${
                            state === 'done'
                                ? 'bg-gradient-to-r from-[#22D3EE] to-[#3B82F6] hover:opacity-90 border-transparent shadow-[0_4px_14px_0_rgba(59,130,246,0.2)]'
                                : 'bg-[#0F172A] border border-white/10 hover:bg-slate-800'
                        }`}
                    >
                        {state === 'done'
                            ? seo.keywordModal.save
                            : seo.keywordModal.cancel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
