'use client'

import { getLocaleLabel } from '@/lib/locale-labels'
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavMultilingualPanelProps {
    siteLocale: string
    activeLocale: string
    enabled: boolean
    onToggle: (on: boolean) => void
    onLocaleSwitch: (locale: string) => void
}

const EN = { locale: 'en', flag: '🇬🇧', full: 'English', short: 'EN' }
const MS = { locale: 'ms', flag: '🇲🇾', full: 'Malay', short: 'MY' }
const STANDARD = [EN, MS]

// Exact design values (light card, converted from computed styles)
// Card bg: #f1f5f9 | border: #e2e8f0 | radius: 10px | padding: 10px
// Row bg: white | border: #e2e8f0 | radius: 7px
// Primary bg: #eff6ff | border: #bfdbfe
// Toggle on: emerald-600 (rgb(5,150,105)) | button: blue-600

function CodeBadge({ text, size = 'md' }: { text: string; size?: 'md' | 'sm' }) {
    return (
        <span className={cn(
            'rounded border border-[#e2e8f0] bg-white font-bold text-slate-500 uppercase tracking-wide',
            size === 'md' ? 'px-[5px] py-[2px] text-[9.5px]' : 'px-[4px] py-[1px] text-[9px]',
        )}>
            {text}
        </span>
    )
}

function FlagBox({ flag }: { flag: string }) {
    return (
        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-white text-[14px] leading-none">
            {flag}
        </span>
    )
}

export function NavMultilingualPanel({
    siteLocale,
    activeLocale,
    enabled,
    onToggle,
    onLocaleSwitch,
}: NavMultilingualPanelProps) {
    const primary = getLocaleLabel(siteLocale)
    const isStandardSite = siteLocale === 'en' || siteLocale === 'ms'
    const hasSecondary = enabled && activeLocale !== siteLocale
    const addOptions = STANDARD.filter(o => o.locale !== siteLocale)

    return (
        // Light card matching design: bg #f1f5f9, border #e2e8f0, radius 10px
        <div className="flex flex-col gap-[6px] rounded-[10px] border border-[#e2e8f0] bg-[#f1f5f9] p-[10px]">

            {/* Header: icon + "Quick Language" */}
            <div className="flex items-center gap-[5px]">
                <Languages className="h-[13px] w-[13px] text-slate-600" strokeWidth={2.5} />
                <span className="text-[11px] font-bold text-slate-700 tracking-[0.02em]">Quick Language</span>
            </div>

            {/* Toggle row: white card */}
            <label className="flex cursor-pointer items-center gap-[10px] rounded-[7px] border border-[#e2e8f0] bg-white px-[10px] py-[6px]">
                <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold text-slate-800 leading-tight">Enable Multi-language</p>
                    {enabled && (
                        <p className="text-[10px] text-slate-500 mt-[2px] leading-tight">
                            Site supports a secondary language.
                        </p>
                    )}
                </div>
                {/* Toggle switch — h=18px, emerald on */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => onToggle(!enabled)}
                    className={cn(
                        'relative shrink-0 inline-flex h-[18px] w-[34px] rounded-full border-2 border-transparent transition-colors duration-200',
                        enabled ? 'bg-emerald-600' : 'bg-slate-300',
                    )}
                >
                    <span className={cn(
                        'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform duration-200',
                        enabled ? 'translate-x-[16px]' : 'translate-x-0',
                    )} />
                </button>
            </label>

            {enabled && (
                <>
                    {/* Primary language row */}
                    <div className="flex items-center gap-[8px] rounded-[7px] border border-[#bfdbfe] bg-[#eff6ff] px-[8px] py-[6px]">
                        <FlagBox flag={primary.flag} />
                        <span className="flex-1 text-[12px] font-medium text-slate-800">{primary.full}</span>
                        <CodeBadge text={primary.short} />
                        <span className="inline-flex items-center gap-[3px] rounded-full bg-blue-600 px-[6px] py-[2px] text-[9.5px] font-bold text-white">
                            Primary
                        </span>
                    </div>

                    {/* Secondary added: show active secondary row */}
                    {hasSecondary && (() => {
                        const sec = getLocaleLabel(activeLocale)
                        const secOpt = STANDARD.find(o => o.locale === activeLocale)
                        return (
                            <div className="flex items-center gap-[8px] rounded-[7px] border border-[#e2e8f0] bg-white px-[8px] py-[6px]">
                                <FlagBox flag={secOpt?.flag ?? sec.flag} />
                                <span className="flex-1 text-[12px] font-medium text-slate-800">{sec.full}</span>
                                <CodeBadge text={sec.short} size="sm" />
                                <button
                                    type="button"
                                    onClick={() => onLocaleSwitch(siteLocale)}
                                    className="h-[22px] rounded-[5px] border border-[#e2e8f0] bg-white px-[8px] text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        )
                    })()}

                    {/* No secondary yet: add options */}
                    {!hasSecondary && (
                        <div className="flex flex-col gap-[4px]">
                            <p className="text-[10.5px] font-semibold text-slate-500 px-[2px]">
                                Add a secondary language
                            </p>
                            {(isStandardSite ? addOptions : STANDARD).map(opt => (
                                <div
                                    key={opt.locale}
                                    className="flex items-center gap-[8px] rounded-[7px] border border-[#e2e8f0] bg-white px-[8px] py-[6px]"
                                >
                                    <FlagBox flag={opt.flag} />
                                    <span className="flex-1 text-[12px] font-medium text-slate-800">{opt.full}</span>
                                    <CodeBadge text={opt.short} size="sm" />
                                    <button
                                        type="button"
                                        onClick={() => onLocaleSwitch(opt.locale)}
                                        className="h-[22px] rounded-[5px] bg-blue-600 px-[8px] text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
