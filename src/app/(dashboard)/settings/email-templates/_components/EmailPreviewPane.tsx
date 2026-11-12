'use client'

import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, RefreshCw, RotateCcw, FlaskConical, Mail } from 'lucide-react'
import type { EmailTemplateType } from '@/lib/email/types'
import type { EmailTemplateConfig } from '@/lib/email/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useI18n } from '@/i18n'

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface Props {
    templateType: EmailTemplateType
    locale: 'en' | 'ms'
    draftConfig: Partial<EmailTemplateConfig> & { enabled: boolean }
    onReset: () => void
}

export function EmailPreviewPane({ templateType, locale, draftConfig, onReset }: Props) {
    const { t } = useI18n()
    const et = t.dashboard.settings.emailTemplates.preview
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
    const [html, setHtml] = useState<string>('')
    const [subject, setSubject] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [fetchError, setFetchError] = useState(false)
    const abortRef = useRef<AbortController | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // GH-1499 issue 4: only true desktop (≥1280px, xl) gets to pick Desktop vs Mobile —
    // on phone AND tablet/iPad (mobile through iPad Pro, all <1280px) there's no real
    // "view the desktop layout" use case, so hide the toggle entirely and just show the
    // (mobile-sized) preview. Re-forced on any resize INTO the <xl range (e.g. shrinking
    // a resizable window) so it never gets stuck showing the desktop toggle/frame at a
    // width where switching to it wouldn't make sense.
    const isBelowDesktop = useMediaQuery('(max-width: 1279px)')
    useEffect(() => {
        if (isBelowDesktop) setPreviewMode('mobile')
    }, [isBelowDesktop])

    function doFetch(signal: AbortSignal) {
        setLoading(true)
        setFetchError(false)
        fetch('/api/email-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateType, locale, draftConfig }),
            signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Preview API ${res.status}`)
                return res.json() as Promise<{ subject: string; html: string }>
            })
            .then(({ subject: newSubject, html: newHtml }) => {
                setSubject(newSubject ?? '')
                setHtml(newHtml)
                setLoading(false)
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === 'AbortError') return
                console.error('[EmailPreviewPane] fetch error:', err)
                setFetchError(true)
                setLoading(false)
            })
    }

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            if (abortRef.current) abortRef.current.abort()
            const controller = new AbortController()
            abortRef.current = controller
            doFetch(controller.signal)
        }, 300)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [templateType, locale, draftConfig])

    useEffect(() => {
        return () => { if (abortRef.current) abortRef.current.abort() }
    }, [])

    const handleRefresh = () => {
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        doFetch(controller.signal)
    }

    return (
        <div className="rounded-xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[hsl(var(--card))] overflow-hidden flex flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[hsl(var(--card))] px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {et.live}
                    </span>
                </div>
                <TooltipProvider>
                    <div className="flex items-center gap-1">
                        {/* GH-1499 issue 4: below xl (desktop), only mobile preview makes sense —
                            no toggle needed, and no replacement label either (redundant UI
                            noise) — mode is force-set to 'mobile' above, Refresh stays visible. */}
                        {isBelowDesktop ? null : (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            onClick={() => setPreviewMode('desktop')}
                                            variant="ghost"
                                            size="icon"
                                            aria-label={et.desktop}
                                            className={`h-7 w-7 ${previewMode === 'desktop' ? 'bg-slate-200 dark:bg-white/[0.1] text-[hsl(var(--primary))]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                                        >
                                            <Monitor className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{et.desktop}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            onClick={() => setPreviewMode('mobile')}
                                            variant="ghost"
                                            size="icon"
                                            aria-label={et.mobile}
                                            className={`h-7 w-7 ${previewMode === 'mobile' ? 'bg-slate-200 dark:bg-white/[0.1] text-[hsl(var(--primary))]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                                        >
                                            <Smartphone className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{et.mobile}</TooltipContent>
                                </Tooltip>
                            </>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    onClick={handleRefresh}
                                    variant="ghost"
                                    size="icon"
                                    aria-label={et.refresh}
                                    className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{et.refresh}</TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </div>

            {/* Mock inbox subject bar — styled as an inbox preview row */}
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-white/[0.1] bg-slate-100 dark:bg-[hsl(var(--secondary))] px-4 py-2.5 min-w-0">
                <Mail className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                <span className="shrink-0 text-[11px] font-bold text-[hsl(var(--primary))] uppercase tracking-wide">{et.subjectLabel}</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-white truncate min-w-0">
                    {subject || <span className="font-normal italic text-slate-400 dark:text-slate-600">{et.subjectDefault}</span>}
                </span>
            </div>

            {/* Preview canvas */}
            {/* Self-contained scroll — DESKTOP split-view only (md+). The iframe auto-grows to its
                content height; on desktop we cap this wrapper so it scrolls internally and
                overscroll-contain keeps the scroll from shifting the form/header next to it.
                On mobile the layout is stacked (grid-cols-1), so let the preview grow naturally
                and the page scroll — no cramped inner box. */}
            <div className="relative flex min-h-[360px] items-start justify-center bg-slate-100 dark:bg-[hsl(var(--background))] p-3 sm:p-6 md:max-h-[calc(100vh-500px)] md:overflow-y-auto md:overscroll-contain">
                {/* Subtle loading overlay — keeps iframe visible to avoid flash */}
                {loading && (
                    <div className="absolute inset-0 flex items-start justify-center pt-8 bg-slate-100/70 dark:bg-[hsl(var(--background)/0.7)] z-10 pointer-events-none">
                        <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                    </div>
                )}

                {fetchError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
                        <span className="text-xs text-destructive">{et.unavailable}</span>
                        <Button
                            type="button"
                            onClick={handleRefresh}
                            variant="link"
                            className="text-xs h-auto p-0"
                        >
                            {et.retry}
                        </Button>
                    </div>
                ) : (
                    <iframe
                        srcDoc={html || `<p style="font-family:sans-serif;color:#94a3b8;padding:40px;text-align:center">${escapeHtml(et.placeholder)}</p>`}
                        sandbox="allow-same-origin"
                        title={et.iframeTitle}
                        style={{
                            width: previewMode === 'desktop' ? '560px' : '360px',
                            maxWidth: '100%',
                            minHeight: '480px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#fff',
                            boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                            transition: 'width 0.2s',
                            overflow: 'auto',
                        }}
                        onLoad={(e) => {
                            const iframe = e.currentTarget
                            try {
                                const doc = iframe.contentDocument
                                if (doc) {
                                    // Add 48px buffer for padding-bottom of wrapper divs not captured by scrollHeight
                                    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 48
                                    iframe.style.height = h + 'px'
                                }
                            } catch {
                                // sandboxed — ignore cross-origin height
                            }
                        }}
                    />
                )}
            </div>

            {/* Demo data card */}
            <div className="mx-4 mb-3 mt-3 rounded-lg bg-[hsl(var(--card))] px-4 py-3" style={{ border: '1px solid hsl(var(--border))', borderLeft: '4px solid hsl(var(--info))' }}>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    <FlaskConical className="h-4 w-4 shrink-0 text-slate-500" />
                    {et.demoTitle}
                </p>
                <div className="grid gap-y-1.5 text-xs" style={{ gridTemplateColumns: 'auto 1fr' }}>
                    <span className="pr-8 text-slate-500">{et.demoOrder}</span><span className="font-mono text-slate-300">DEMO-001</span>
                    <span className="pr-8 text-slate-500">{et.demoCustomer}</span><span className="font-mono text-slate-300">John Doe</span>
                    <span className="pr-8 text-slate-500">{et.demoTotal}</span><span className="font-mono text-slate-300">MYR 299.00</span>
                    <span className="pr-8 text-slate-500">{et.demoBrand}</span><span className="font-mono text-slate-300">Aurora Batik</span>
                    <span className="pr-8 text-slate-500">{et.demoSupport}</span><span className="font-mono text-slate-300">help@aurora-batik.my</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] bg-[hsl(var(--card))] px-4 py-2.5 text-xs text-slate-500">
                <span>{et.footerNote}</span>
                <Button
                    type="button"
                    onClick={onReset}
                    variant="link"
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white h-auto p-0"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {et.resetToDefault}
                </Button>
            </div>
        </div>
    )
}
