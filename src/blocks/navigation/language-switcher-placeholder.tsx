// F26-07: Language switcher dropdown in nav header.
// Visual style matches the editor toolbar LanguageSwitcher (pill + dark dropdown).
// Sends SWITCH_LOCALE postMessage to parent editor on selection.
// Scales to 3+ locales — F27 wires full locale list.

'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

type NavLangSwitcherPlaceholderProps = {
    className?: string
}

const LOCALES = [
    { code: 'en', flag: '🇬🇧', label: 'EN' },
    { code: 'ms', flag: '🇲🇾', label: 'BM' },
] as const

export function NavLangSwitcherPlaceholder({ className = '' }: NavLangSwitcherPlaceholderProps) {
    const activeLocale = useEditorStore(state => state.activeLocale)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const active = LOCALES.find(l => l.code === activeLocale) ?? LOCALES[0]

    const handleSelect = (code: string) => {
        setOpen(false)
        window.parent.postMessage(
            { type: 'SWITCH_LOCALE', locale: code },
            window.location.origin,
        )
    }

    return (
        <div
            ref={ref}
            className={`relative flex items-center select-none ${className}`.trim()}
            aria-label="Language switcher"
        >
            {/* Trigger — pill style matches editor toolbar LanguageSwitcher */}
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-current/20 bg-white/10 px-2.5 text-[11px] font-semibold transition-all hover:bg-white/20"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="text-sm leading-none">{active.flag}</span>
                <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown — dark neutral, works on both light and dark navs */}
            {open && (
                <div
                    role="listbox"
                    className="absolute top-full right-0 mt-1.5 min-w-[130px] rounded-lg border border-white/10 bg-gray-900 shadow-xl z-50 p-1"
                >
                    {LOCALES.map(({ code, flag, label }) => {
                        const isActive = activeLocale === code
                        return (
                            <button
                                key={code}
                                role="option"
                                type="button"
                                aria-selected={isActive}
                                onClick={() => handleSelect(code)}
                                className={[
                                    'flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-left rounded-md transition-colors',
                                    isActive
                                        ? 'bg-white/10 text-white font-semibold'
                                        : 'text-white/60 hover:bg-white/[0.06] font-medium',
                                ].join(' ')}
                            >
                                <span className="text-base leading-none">{flag}</span>
                                <span className="text-white/40">{label}</span>
                                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
