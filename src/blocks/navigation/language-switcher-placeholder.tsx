// F26-07: Language switcher dropdown in nav header.
// Opens on hover. Adapts to site Color Mode (dark: variants).
// Sends SWITCH_LOCALE postMessage to parent editor on selection.
// Dynamically reflects the site's actual language pair (generationLocale + activeLocale).

'use client'

import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { getLocaleLabel } from '@/lib/locale-labels'
import { LocaleFlag } from '@/components/locale-flag'

type NavLangSwitcherPlaceholderProps = {
    className?: string
}

export function NavLangSwitcherPlaceholder({ className = '' }: NavLangSwitcherPlaceholderProps) {
    const generationLocale = useEditorStore(state => state.generationLocale)
    const primaryLocale    = useEditorStore(state => state.primaryLocale)
    const secondaryLocale  = useEditorStore(state => state.secondaryLocale)
    const activeLocale     = useEditorStore(state => state.activeLocale)
    const [open, setOpen]  = useState(false)
    const closeTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current)
        setOpen(true)
    }

    const handleLeave = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 120)
    }

    const effectivePrimary = primaryLocale || generationLocale || 'en'

    // Render exactly the site's configured language pair [primary, secondary] — the single
    // source of truth shared with the Quick Language panel, so visitor + editor always agree.
    // Legacy fallback: sites that enabled the switcher before secondaryLocale was persisted
    // have no stored secondary — keep the old [primary, EN, MS] list so they don't break.
    const codes = (secondaryLocale
        ? [effectivePrimary, secondaryLocale]
        : [effectivePrimary, 'en', 'ms']
    ).filter((c, i, arr) => !!c && arr.indexOf(c) === i)
    const locales = codes.map(code => ({ code, visual: getLocaleLabel(code) }))

    const active = locales.find(l => l.code === activeLocale) ?? locales[0]

    const handleSelect = (code: string) => {
        setOpen(false)
        window.parent.postMessage(
            { type: 'SWITCH_LOCALE', locale: code },
            window.location.origin,
        )
    }

    return (
        <div
            className={`relative flex items-center select-none ${className}`.trim()}
            aria-label="Language switcher"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {/* Trigger pill */}
            <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-current/20 bg-white/10 px-2.5 text-[11px] font-semibold transition-all hover:bg-white/20"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <LocaleFlag locale={active.code} className="w-5 shrink-0 rounded-[2px]" />
                <span className="leading-none">{active.visual.short}</span>
                <ChevronDown className={`h-3 w-3 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown — light: white card, dark: dark card */}
            {open && (
                <div
                    role="listbox"
                    className="absolute top-full right-0 mt-1 min-w-[150px] rounded-lg border shadow-lg z-50 p-1
                               bg-white border-black/10
                               dark:bg-[#1E293B] dark:border-white/10"
                >
                    {locales.map(({ code, visual }) => {
                        const isActive = code === activeLocale
                        return (
                            <button
                                key={code}
                                role="option"
                                type="button"
                                aria-selected={isActive}
                                onClick={() => handleSelect(code)}
                                className={[
                                    'flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left rounded-md transition-colors font-medium',
                                    isActive
                                        ? 'bg-black/5 text-slate-900 font-semibold dark:bg-white/10 dark:text-white'
                                        : 'text-slate-500 hover:bg-black/5 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white/90',
                                ].join(' ')}
                            >
                                <LocaleFlag locale={code} className="w-5 shrink-0 rounded-[2px]" />
                                <span className="truncate">{visual.full}</span>
                                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
