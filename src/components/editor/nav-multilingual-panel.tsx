'use client'

import { Check, Languages, Loader2, Lock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLocaleLabel } from '@/lib/locale-labels'

interface NavMultilingualPanelProps {
    siteLocale: string
    activeLocale: string
    generationLocale?: string
    primaryLocale?: string
    pendingLocale?: string | null
    enabled: boolean
    onToggle: (on: boolean) => void
    onLocaleSwitch: (locale: string) => void
    onMakePrimary?: (locale: string) => void
}

const EN_LOCALE = 'en'
const MS_LOCALE = 'ms'

const s = {
    card:    'rounded-[10px] border p-[10px] flex flex-col gap-[6px]',
    row:     'grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[7px] border px-2 py-[6px]',
    flag:    'inline-flex h-5 w-5 items-center justify-center rounded-[5px] border text-[13px] leading-none',
    code:    'font-mono text-[9px] font-bold tracking-wide border rounded px-[4px] py-[1px] uppercase',
    badge:   'inline-flex items-center gap-[3px] rounded-full px-[6px] py-[2px] text-[9.5px] font-bold uppercase tracking-wide',
    btn:     'inline-flex h-[22px] items-center rounded-[5px] border px-[7px] text-[10px] font-semibold transition-colors whitespace-nowrap',
    iconBtn: 'inline-flex h-6 w-6 items-center justify-center rounded-[5px] border transition-colors',
    addBtn:  'inline-flex h-[22px] items-center gap-[3px] rounded-[5px] px-[8px] text-[11px] font-semibold text-[#fff] transition-colors bg-blue-600 hover:bg-blue-500',
}

function LangRow({ flag, full, short, variant = 'default', rightSlot }: {
    flag: string; full: string; short: string
    variant?: 'default' | 'primary' | 'added' | 'disabled'
    rightSlot?: React.ReactNode
}) {
    return (
        <div className={cn(s.row,
            variant === 'primary'  && 'border-blue-500/30 bg-blue-500/[0.08]',
            variant === 'added'    && 'border-emerald-500/30 bg-emerald-500/[0.08]',
            variant === 'disabled' && 'border-white/[0.06] bg-white/[0.02] opacity-50',
            variant === 'default'  && 'border-white/[0.08] bg-white/[0.04]',
        )}>
            <span className={cn(s.flag, 'border-white/[0.08] bg-white/[0.04]')}>{flag}</span>
            <span className="inline-flex items-center gap-[5px] min-w-0">
                <span className="text-[12px] font-semibold text-white/70">{full}</span>
                <span className={cn(s.code, variant === 'primary' ? 'border-blue-500/40 text-blue-400' : 'border-white/10 text-white/40')}>
                    {short}
                </span>
            </span>
            <span className="flex items-center gap-1">{rightSlot}</span>
        </div>
    )
}

export function NavMultilingualPanel({
    siteLocale,
    activeLocale,
    generationLocale,
    primaryLocale,
    pendingLocale,
    enabled,
    onToggle,
    onLocaleSwitch,
    onMakePrimary,
}: NavMultilingualPanelProps) {
    const isPending = !!pendingLocale
    // primaryLocale = user's chosen primary (Make Default). Fallback to generationLocale.
    const effectivePrimary = primaryLocale || generationLocale || siteLocale
    const primary = getLocaleLabel(effectivePrimary)

    // Secondary: activeLocale if differs from primary
    const hasSecondary = enabled && activeLocale !== effectivePrimary
    const secondary = hasSecondary ? getLocaleLabel(activeLocale) : null

    // Available locales user can choose from: generationLocale (if non-standard) + EN + MS
    // Dedupe — if generation is already EN or MS, don't repeat.
    const allLocales: string[] = [generationLocale || '', EN_LOCALE, MS_LOCALE].filter(
        (l, i, arr) => l && arr.indexOf(l) === i,
    )

    // Add list: everything except primary and secondary (max 2 active at a time)
    const addOptions = allLocales
        .filter(l => l !== effectivePrimary && l !== activeLocale)
        .map(l => ({ locale: l, ...getLocaleLabel(l) }))

    // Remove secondary:
    // If secondary is a standard locale (EN/MS), switch active back to primary
    // If primary itself is non-standard (e.g. Vi) — turning off enabled is cleaner
    const handleRemove = () => {
        if (effectivePrimary === EN_LOCALE || effectivePrimary === MS_LOCALE) {
            onLocaleSwitch(effectivePrimary)
        } else {
            onToggle(false)
        }
    }

    // Handle "Add" click:
    // If locale is standard (EN/MS) → set as active (secondary)
    // If locale is non-standard (the source language) → make it primary
    const handleAdd = (locale: string) => {
        if (locale === EN_LOCALE || locale === MS_LOCALE) {
            onLocaleSwitch(locale)
        } else {
            onMakePrimary?.(locale)
        }
    }

    return (
        <div className={cn(s.card, 'border-white/[0.08] bg-white/[0.03]')}>
            {/* Header */}
            <div className="inline-flex items-center gap-[5px]">
                <Languages className="h-3 w-3 text-blue-400" strokeWidth={2.5} />
                <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-white/70">
                    Quick Language
                </span>
            </div>

            {/* Toggle */}
            <label className="flex cursor-pointer items-center justify-between gap-[10px] rounded-[7px] border border-white/[0.08] bg-white/[0.04] px-[10px] py-[6px]">
                <div className="flex flex-col">
                    <span className="text-[11.5px] font-semibold text-white/80">Enable Multi-language</span>
                    {enabled && (
                        <span className="text-[10px] text-white/40 leading-snug mt-[1px]">
                            Site supports a secondary language.
                        </span>
                    )}
                </div>
                <button
                    type="button" role="switch" aria-checked={enabled}
                    onClick={() => onToggle(!enabled)}
                    className={cn(
                        'relative shrink-0 inline-flex h-[18px] w-[30px] rounded-full transition-colors duration-200',
                        enabled ? 'bg-emerald-500' : 'bg-white/20',
                    )}
                >
                    <span className={cn(
                        'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-white shadow mt-[2px] transition-transform duration-200',
                        enabled ? 'translate-x-[14px]' : 'translate-x-[2px]',
                    )} />
                </button>
            </label>

            {enabled && (
                <>
                    {/* Active language rows */}
                    <div className="flex flex-col gap-[5px]">
                        {/* Primary — always shown with [Primary] tag */}
                        <LangRow
                            flag={primary.flag} full={primary.full} short={primary.short}
                            variant="primary"
                            rightSlot={
                                <span className={cn(s.badge, 'bg-blue-600 text-[#fff]')}>
                                    <Check size={9} strokeWidth={3} /> Primary
                                </span>
                            }
                        />

                        {/* Secondary — shown when activeLocale differs from primary */}
                        {hasSecondary && secondary && (
                            <LangRow
                                flag={secondary.flag}
                                full={secondary.full}
                                short={secondary.short}
                                variant="added"
                                rightSlot={
                                    <span className="inline-flex items-center gap-[4px]">
                                        <button
                                            type="button"
                                            onClick={() => onMakePrimary?.(activeLocale)}
                                            className={cn(s.btn, 'border-white/10 text-white/70 hover:border-blue-400 hover:text-blue-400')}
                                        >
                                            Make Default
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemove}
                                            aria-label="Remove language"
                                            className={cn(s.iconBtn, 'border-white/10 text-white/40 hover:border-red-400/60 hover:text-red-400 hover:bg-red-500/10')}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </span>
                                }
                            />
                        )}
                    </div>

                    {/* Add options — dim + lock when max reached (Primary + Secondary) */}
                    {addOptions.length > 0 && (
                        <div className="flex flex-col gap-[5px]">
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-white/30 px-[1px]">
                                Add a secondary language
                            </p>
                            {addOptions.map(opt => {
                                const isThisPending = pendingLocale === opt.locale
                                return (
                                <LangRow
                                    key={opt.locale}
                                    flag={opt.flag} full={opt.full} short={opt.short}
                                    variant={hasSecondary || (isPending && !isThisPending) ? 'disabled' : 'default'}
                                    rightSlot={
                                        isThisPending ? (
                                            <span className="inline-flex items-center gap-[4px] text-[10px] font-semibold text-blue-400">
                                                <Loader2 size={11} className="animate-spin" />
                                                Adding…
                                            </span>
                                        ) : hasSecondary ? (
                                            <span className={cn(s.iconBtn, 'border-white/[0.08] text-white/30 cursor-not-allowed')}>
                                                <Lock size={10} />
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => handleAdd(opt.locale)}
                                                className={cn(s.addBtn, isPending && 'opacity-50 cursor-not-allowed')}
                                            >
                                                Add
                                            </button>
                                        )
                                    }
                                />
                                )
                            })}
                        </div>
                    )}

                    {/* Warning when at max (2 languages) */}
                    {hasSecondary && secondary && (
                        <p className="flex items-start gap-[4px] text-[10px] text-amber-400/70 px-[1px] leading-snug">
                            <span className="mt-[1px]">⚠</span>
                            <span>Max 2 languages. Remove {secondary.full} to switch.</span>
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
