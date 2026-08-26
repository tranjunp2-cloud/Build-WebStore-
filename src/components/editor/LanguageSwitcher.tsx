'use client'

/**
 * LanguageSwitcher — F26-05
 * Uses shadcn DropdownMenu (Radix portal) so the menu renders outside
 * the toolbar's overflow-hidden container and is never clipped.
 * Follows editor-shell light/dark pattern: editor-portal class + dark: variants.
 * Flag emoji labels — renders correctly in all modern browsers.
 * F26: EN + BM hardcoded. F27/F28+: pull from site.supportedLocales[] without UI changes.
 */

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SiteLocale } from '@/store/editorStore'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface LanguageSwitcherProps {
    activeLocale: SiteLocale
    onSwitch: (locale: SiteLocale) => void
    disabled?: boolean
}

const LOCALES: Array<{ id: SiteLocale; label: string; name: string }> = [
    { id: 'en', label: '🇬🇧', name: 'English' },
    { id: 'ms', label: '🇲🇾', name: 'Bahasa Malaysia' },
]

export function LanguageSwitcher({ activeLocale, onSwitch, disabled = false }: LanguageSwitcherProps) {
    const active = LOCALES.find(l => l.id === activeLocale) ?? LOCALES[0]

    return (
        <DropdownMenu>
            {/* group enables group-data-[state=open] on children */}
            <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    aria-label={`Language: ${active.name}`}
                    className={cn(
                        'group inline-flex h-7 items-center gap-1 rounded-full border px-2.5',
                        'text-[11px] font-semibold transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        // dark
                        'dark:border-white/[0.08] dark:bg-[var(--editor-surface-elevated)] dark:text-white/80',
                        'dark:hover:border-white/20 dark:hover:text-white',
                        'dark:data-[state=open]:border-white/20 dark:data-[state=open]:text-white',
                        // light
                        'border-slate-200 bg-white/80 text-slate-600',
                        'hover:border-slate-300 hover:text-slate-800',
                        'data-[state=open]:border-slate-300 data-[state=open]:text-slate-800',
                    )}
                >
                    <span className="text-sm leading-none">{active.label}</span>
                    <ChevronDown
                        className="h-3 w-3 opacity-50 transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                    />
                </button>
            </DropdownMenuTrigger>

            {/* editor-portal: follows globals.css dark/light override block */}
            <DropdownMenuContent
                align="end"
                sideOffset={6}
                className={cn(
                    'editor-portal z-50 min-w-[130px] rounded-lg border shadow-xl p-1',
                    // dark
                    'dark:border-white/[0.08] dark:bg-[var(--editor-surface-elevated)]',
                    // light
                    'border-[var(--editor-border)] bg-white',
                )}
            >
                {LOCALES.map(({ id, label, name }) => {
                    const isActive = id === activeLocale
                    return (
                        <DropdownMenuItem
                            key={id}
                            onSelect={() => { if (!isActive) onSwitch(id) }}
                            aria-current={isActive ? 'true' : undefined}
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium cursor-pointer rounded-md',
                                'dark:focus:bg-white/[0.06] focus:bg-slate-100',
                                'dark:hover:bg-white/[0.06] hover:bg-slate-100',
                                isActive
                                    ? 'dark:text-white text-slate-800'
                                    : 'dark:text-white/60 text-slate-500',
                            )}
                        >
                            <span className="text-base leading-none">{label}</span>
                            <span className="dark:text-white/40 text-slate-400">{name}</span>
                            {isActive && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" aria-hidden="true" />
                            )}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
