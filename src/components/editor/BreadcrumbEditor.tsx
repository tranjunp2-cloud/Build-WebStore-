'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

const SEPARATORS = ['/', '>', '→', '•', '|'] as const
const HOMEPAGE_SLUGS = new Set(['/', '', 'home', 'index'])

function slugToSegments(slug: string): string[] {
    const raw = slug.replace(/^\//, '')
    if (HOMEPAGE_SLUGS.has(raw)) return []
    return slug.split('/').filter(Boolean)
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

interface BreadcrumbEditorProps {
    homeLabel: string
    separator: string
    showOnAllPages: boolean
    pageSlug?: string
    onChange: (changes: {
        homeLabel?: string
        separator?: string
        showOnAllPages?: boolean
    }) => void
}

export function BreadcrumbEditor({ homeLabel, separator, showOnAllPages, pageSlug, onChange }: BreadcrumbEditorProps) {
    const { t } = useI18n()
    const s = t.editor.settings

    // local state for immediate visual feedback without waiting for store round-trip
    const [localSeparator, setLocalSeparator] = useState(separator)
    const [localHomeLabel, setLocalHomeLabel] = useState(homeLabel)
    const [localShowOnAllPages, setLocalShowOnAllPages] = useState(showOnAllPages)

    // sync all local state when props change (e.g. undo/redo from parent store)
    useEffect(() => { setLocalSeparator(separator) }, [separator])
    useEffect(() => { setLocalHomeLabel(homeLabel) }, [homeLabel])
    useEffect(() => { setLocalShowOnAllPages(showOnAllPages) }, [showOnAllPages])

    return (
        <div className="flex flex-col gap-3">
            {/* Mode */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-slate-400">{s.breadcrumbMode}</span>
                <div className="bg-[#0b1120] rounded-xl px-3 py-2 text-center text-[12px] font-medium text-blue-400">
                    {s.breadcrumbAuto}
                </div>
                <p className="text-[12px] text-slate-400/80 leading-4">{s.breadcrumbAutoDesc}</p>
            </div>

            {/* Home Label */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-slate-400">{s.breadcrumbHomeLabel}</span>
                <Input
                    key={homeLabel}
                    variant="editor"
                    defaultValue={homeLabel}
                    placeholder="Home"
                    maxLength={80}
                    onChange={(e) => setLocalHomeLabel(e.target.value)}
                    onBlur={(e) => onChange({ homeLabel: e.target.value })}
                />
            </div>

            {/* Separator */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-slate-400">{s.breadcrumbSeparator}</span>
                <div className="flex gap-2">
                    {SEPARATORS.map((sep) => {
                        const active = localSeparator === sep
                        return (
                            <button
                                key={sep}
                                type="button"
                                onClick={() => {
                                    setLocalSeparator(sep)
                                    onChange({ separator: sep })
                                }}
                                className={cn(
                                    'flex-1 h-[38px] rounded-xl text-[14px] font-medium transition-colors border',
                                    active
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                        : 'bg-[#0b1120] border-[rgba(59,130,246,0.04)] text-slate-100 hover:bg-white/5'
                                )}
                            >
                                {sep}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Show on All Pages */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-slate-400">{s.breadcrumbShowOnAllPages}</span>
                    <span className="text-[12px] text-slate-400/70 leading-4">{s.breadcrumbShowOnAllPagesDesc}</span>
                </div>
                <Switch
                    checked={localShowOnAllPages}
                    onCheckedChange={(next) => {
                        setLocalShowOnAllPages(next)
                        onChange({ showOnAllPages: next })
                    }}
                />
            </div>

            {/* Preview */}
            {(() => {
                const segments = pageSlug ? slugToSegments(pageSlug) : []
                const allItems = [localHomeLabel || 'Home', ...segments.map(capitalize)]
                // on homepage (no segments), show a demo path so preview is always meaningful
                const previewItems = allItems.length <= 1
                    ? [localHomeLabel || 'Home', 'About']
                    : allItems
                return (
                    <div className="bg-[#0b1120] border border-[rgba(59,130,246,0.04)] rounded-xl px-3 pt-3 pb-3 flex flex-col gap-2">
                        <span className="text-[12px] text-slate-400">{s.breadcrumbPreview}:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                            {previewItems.map((item, i) => (
                                <span key={i} className="flex items-center gap-1">
                                    {i > 0 && <span className="text-[12px] text-slate-400 mx-0.5">{localSeparator}</span>}
                                    <span className={`text-[12px] ${i === previewItems.length - 1 ? 'text-slate-100 font-medium' : i === 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                                        {item}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
