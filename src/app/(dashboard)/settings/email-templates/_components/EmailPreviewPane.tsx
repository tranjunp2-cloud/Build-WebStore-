'use client'

import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, RefreshCw, RotateCcw } from 'lucide-react'
import type { EmailTemplateType } from '@/lib/email/types'
import type { EmailTemplateConfig } from '@/lib/email/types'

interface Props {
    templateType: EmailTemplateType
    locale: 'en' | 'ms'
    draftConfig: Partial<EmailTemplateConfig> & { enabled: boolean }
    onReset: () => void
}

export function EmailPreviewPane({ templateType, locale, draftConfig, onReset }: Props) {
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
    const [html, setHtml] = useState<string>('')
    const [subject, setSubject] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [fetchError, setFetchError] = useState(false)
    const abortRef = useRef<AbortController | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        <div className="rounded-xl border border-white/[0.08] bg-[#1a2540] overflow-hidden flex flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Live Preview
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setPreviewMode('desktop')}
                        title="Desktop"
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-white/[0.1] text-blue-400' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Monitor className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreviewMode('mobile')}
                        title="Mobile"
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white/[0.1] text-blue-400' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Smartphone className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        title="Refresh"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-white transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Mock inbox subject bar */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">Subject:</span>
                <span className="text-xs text-slate-300 truncate">
                    {subject || <span className="text-slate-600 italic">Default subject (type to override)</span>}
                </span>
            </div>

            {/* Preview canvas — intentionally light background to simulate email client */}
            <div className="relative flex min-h-[540px] max-h-[720px] overflow-y-auto items-start justify-center bg-[#eef3f8] p-6">
                {/* Subtle loading overlay — keeps iframe visible to avoid flash */}
                {loading && (
                    <div className="absolute inset-0 flex items-start justify-center pt-8 bg-[#eef3f8]/70 z-10 pointer-events-none">
                        <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                    </div>
                )}

                {fetchError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
                        <span className="text-xs text-red-400">Preview unavailable — check console for details</span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <iframe
                        srcDoc={html || '<p style="font-family:sans-serif;color:#94a3b8;padding:40px;text-align:center">Preview will appear here</p>'}
                        sandbox="allow-same-origin"
                        title="Email preview"
                        style={{
                            width: previewMode === 'desktop' ? '560px' : '360px',
                            minHeight: '480px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#fff',
                            boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                            transition: 'width 0.2s',
                        }}
                        onLoad={(e) => {
                            const iframe = e.currentTarget
                            try {
                                const body = iframe.contentDocument?.body
                                if (body) iframe.style.height = body.scrollHeight + 'px'
                            } catch {
                                // sandboxed — ignore cross-origin height
                            }
                        }}
                    />
                )}
            </div>

            {/* Demo data card */}
            <div className="mx-4 mb-3 mt-0 rounded-lg border-l-4 border-blue-500 bg-blue-500/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                    🧪 Demo data used in preview
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-slate-500">Order #</span><span className="text-slate-300">DEMO-001</span>
                    <span className="text-slate-500">Customer</span><span className="text-slate-300">John Doe</span>
                    <span className="text-slate-500">Total</span><span className="text-slate-300">MYR 299.00</span>
                    <span className="text-slate-500">Brand</span><span className="text-slate-300">Aurora Batik</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-xs text-slate-500">
                <span>Rendered with sample data · won&apos;t be sent to real customers</span>
                <button
                    type="button"
                    onClick={onReset}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                    <RotateCcw className="h-3 w-3" />
                    Reset to default
                </button>
            </div>
        </div>
    )
}
