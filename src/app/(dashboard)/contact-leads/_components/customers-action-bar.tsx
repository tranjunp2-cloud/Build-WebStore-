'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n'

function InlineSelect({ value, options, onChange }: {
    value: string
    options: { key: string; label: string }[]
    onChange: (key: string) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = options.find(o => o.key === value) ?? options[0]!

    // Close on outside click (desktop)
    useEffect(() => {
        if (!open) return
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    return (
        // sm:relative needed so the absolute panel anchors to this wrapper on desktop
        <div ref={ref} className="w-full sm:w-auto sm:relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full sm:w-auto sm:min-w-[160px] h-[50px] bg-[#1e293b] border border-white/[0.08] rounded-[16px] px-4 text-[16px] text-white flex items-center justify-between gap-3 outline-none cursor-pointer transition-colors hover:border-white/20"
            >
                <span>{selected.label}</span>
                <ChevronDown className={`w-5 h-5 text-white/50 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                // Mobile: inline (normal flow, pushes content down)
                // Desktop (sm+): absolute overlay so table stays in place
                <div className="mt-1 bg-[#1e293b] border border-white/[0.08] rounded-[16px] overflow-hidden sm:absolute sm:top-[calc(100%+4px)] sm:left-0 sm:min-w-full sm:z-50 sm:mt-0">
                    {options.map(o => (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => { onChange(o.key); setOpen(false) }}
                            className={`w-full px-4 py-[11px] text-left text-[15px] transition-colors hover:bg-white/[0.05] ${o.key === value ? 'text-white font-medium' : 'text-white/60'}`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

type Props = {
    onSearch: (q: string) => void
    onStatusChange: (status: string) => void
    onSourceChange: (source: string) => void
    onExport: () => void
    exporting: boolean
    status: string
    source: string
}

export function CustomersActionBar({ onSearch, onStatusChange, onSourceChange, onExport, exporting, status, source }: Props) {
    const [input, setInput] = useState('')
    const { t } = useI18n()
    const c = t.dashboard.customers

    const STATUS_OPTIONS = useMemo(() => {
        const base = [{ key: '', label: c.statusAll }]
        const contactOpts = [
            { key: 'new', label: c.statusNew },
            { key: 'read', label: c.statusRead },
            { key: 'contacted', label: c.statusContacted },
            { key: 'ignored', label: c.statusIgnored },
        ]
        if (source === 'newsletter') return [...base, { key: 'subscribed', label: c.statusSubscribed }]
        if (source === 'contact-form') return [...base, ...contactOpts]
        return [...base, ...contactOpts, { key: 'subscribed', label: c.statusSubscribed }]
    }, [c, source])

    const SOURCE_OPTIONS = useMemo(() => [
        { key: '', label: c.sourceAll },
        { key: 'contact-form', label: c.sourceContact },
        { key: 'newsletter', label: c.sourceNewsletter },
    ], [c])

    useEffect(() => {
        const timer = setTimeout(() => onSearch(input), 500)
        return () => clearTimeout(timer)
    }, [input, onSearch])

    return (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:flex-1 sm:min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={c.searchPlaceholder}
                    className="w-full h-[50px] bg-[#1e293b] border border-white/[0.08] rounded-[16px] pl-11 pr-4 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-blue-500/50 transition-colors"
                />
            </div>

            <InlineSelect value={status} options={STATUS_OPTIONS} onChange={onStatusChange} />
            <InlineSelect value={source} options={SOURCE_OPTIONS} onChange={onSourceChange} />

            {/* Export button — right-aligned on mobile */}
            <div className="flex justify-end sm:contents">
                <button
                    onClick={onExport}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 h-[48px] px-5 rounded-[10px] text-[14px] font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
                    style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #2dd4bf 100%)' }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 10L8 2M8 10L5 7M8 10L11 7M3 12H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {exporting ? c.exporting : c.exportCsv}
                </button>
            </div>
        </div>
    )
}
