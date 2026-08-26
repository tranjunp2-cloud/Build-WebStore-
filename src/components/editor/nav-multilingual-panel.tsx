'use client'

import { Check, Info, Loader2, Lock, Trash2 } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { getLocaleLabel } from '@/lib/locale-labels'
import { LocaleFlag } from '@/components/locale-flag'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'

interface NavMultilingualPanelProps {
    siteLocale: string
    generationLocale?: string
    primaryLocale?: string
    /** The persisted 2nd language (single source of truth). null = single-language site. */
    secondaryLocale?: string | null
    pendingLocale?: string | null
    /** Feature on → panel shows primary + Add list. Independent from switcherVisible. */
    enabled: boolean
    /** Site has ≥2 languages → header switcher renders. Drives the persistent secondary row. */
    switcherVisible: boolean
    onToggle: (on: boolean) => void
    /** Add a 2nd (standard) language → site becomes multilingual, switcher appears. */
    onAddLanguage: (locale: string) => void
    /** Remove the secondary → back to 1 language, switcher hides. */
    onRemoveLanguage: () => void
    onMakePrimary?: (locale: string) => void
}

const EN_LOCALE = 'en'
const MS_LOCALE = 'ms'

const s = {
    card: 'rounded-[10px] border p-[14px] flex flex-col gap-[10px]',
    row: 'grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[7px] border px-[10px] py-[8px]',
    flag: 'inline-flex h-5 w-5 items-center justify-center rounded-[5px] border text-[13px] leading-none',
    code: 'font-mono text-[9px] font-bold tracking-wide border rounded px-[4px] py-[1px] uppercase',
    badge: 'inline-flex items-center gap-[3px] rounded-full px-[6px] py-[2px] text-[9.5px] font-bold uppercase tracking-wide',
    btn: 'inline-flex h-[22px] items-center rounded-[5px] border px-[7px] text-[10px] font-semibold transition-colors whitespace-nowrap',
    iconBtn: 'inline-flex h-6 w-6 items-center justify-center rounded-[5px] border transition-colors',
    addBtn: 'inline-flex h-[22px] items-center gap-[3px] rounded-[5px] px-[8px] text-[11px] font-semibold text-[#fff] transition-colors bg-blue-600 hover:bg-blue-500',
}

function LangRow({ locale, full, short, variant = 'default', rightSlot }: {
    locale: string; full: string; short: string
    variant?: 'default' | 'primary' | 'added' | 'disabled'
    rightSlot?: React.ReactNode
}) {
    return (
        <div className={cn(s.row,
            variant === 'primary' && 'border-blue-500/30 bg-blue-500/[0.08]',
            variant === 'added' && 'border-emerald-500/30 bg-emerald-500/[0.08]',
            variant === 'disabled' && 'border-white/[0.06] bg-white/[0.02] opacity-50',
            variant === 'default' && 'border-white/[0.08] bg-white/[0.04]',
        )}>
            <span className={cn(s.flag, 'overflow-hidden border-white/[0.08] bg-white/[0.04]')}>
                <LocaleFlag locale={locale} className="w-4 rounded-[2px]" />
            </span>
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
    generationLocale,
    primaryLocale,
    secondaryLocale: secondaryLocaleProp,
    pendingLocale,
    enabled,
    switcherVisible,
    onToggle,
    onAddLanguage,
    onRemoveLanguage,
    onMakePrimary,
}: NavMultilingualPanelProps) {
    const { t, ti } = useI18n()
    const tx = t.editor.navigation.quickLanguage
    const isPending = !!pendingLocale
    // primaryLocale = user's chosen primary (Make Default). Fallback to generationLocale.
    const effectivePrimary = primaryLocale || generationLocale || siteLocale
    const primary = getLocaleLabel(effectivePrimary)

    // Available locales user can choose from: generationLocale (if non-standard) + EN + MS
    // Dedupe — if generation is already EN or MS, don't repeat.
    const allLocales: string[] = [generationLocale || '', EN_LOCALE, MS_LOCALE].filter(
        (l, i, arr) => l && arr.indexOf(l) === i,
    )

    // Secondary comes from the persisted single source of truth (headerBlock.secondaryLocale),
    // surfaced via the prop — so the panel and the visitor header switcher always agree on the
    // exact 2-language pair. Shown only when the feature is on AND a 2nd language is configured.
    const secondaryLocale: string | null =
        enabled && switcherVisible && secondaryLocaleProp && secondaryLocaleProp !== effectivePrimary
            ? secondaryLocaleProp
            : null
    const hasSecondary = !!secondaryLocale
    const secondary = secondaryLocale ? getLocaleLabel(secondaryLocale) : null

    // Add list: everything except primary and the configured secondary (max 2 active).
    const addOptions = allLocales
        .filter(l => l !== effectivePrimary && l !== secondaryLocale)
        .map(l => ({ locale: l, ...getLocaleLabel(l) }))

    // Handle "Add" click:
    // Standard locale (EN/MS) → add as the secondary language (site becomes multilingual).
    // Non-standard option (the source language) → promote it to primary instead.
    const handleAdd = (locale: string) => {
        if (locale === EN_LOCALE || locale === MS_LOCALE) {
            onAddLanguage(locale)
        } else {
            onMakePrimary?.(locale)
        }
    }

    return (
        <div className={cn(s.card, 'border-white/[0.08] bg-white/[0.03]')}>
            {/* Header */}
            <div className="inline-flex items-center gap-[5px]">
                <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-white/70">
                    {tx.title}
                </span>
                <Tooltip.Provider delayDuration={150}>
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                type="button"
                                aria-label={tx.title}
                                className={cn(
                                    'inline-flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/50',
                                    // dark
                                    'dark:text-white/40 dark:hover:text-white/70',
                                    // light (avoid literal white on hover → icon stays visible)
                                    'text-slate-400 hover:text-slate-600',
                                )}
                            >
                                <Info className="h-[13px] w-[13px]" />
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            {/* editor-portal: follows globals.css dark/light override block */}
                            <Tooltip.Content
                                side="top"
                                align="start"
                                sideOffset={6}
                                collisionPadding={8}
                                className={cn(
                                    'editor-portal z-50 max-w-[240px] rounded-[8px] border px-[10px] py-[7px] text-[11px] leading-relaxed shadow-xl',
                                    'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                                    // dark
                                    'dark:border-white/[0.08] dark:bg-[#1E293B] dark:text-white/80',
                                    // light
                                    'border-[rgba(0,0,0,0.1)] bg-white text-slate-700',
                                )}
                            >
                                {tx.tooltip}
                                <Tooltip.Arrow className="dark:fill-[#1E293B] fill-white" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </Tooltip.Provider>
            </div>

            {/* Toggle */}
            <label className="flex cursor-pointer items-center justify-between gap-[10px] rounded-[7px] border border-white/[0.08] bg-white/[0.04] px-[12px] py-[9px]">
                <div className="flex flex-col">
                    <span className="text-[11.5px] font-semibold text-white/80">{tx.enable}</span>
                    {enabled && (
                        <span className="text-[10px] text-white/40 leading-snug mt-[1px]">
                            {tx.enabledHint}
                        </span>
                    )}
                </div>
                <Switch checked={enabled} onCheckedChange={onToggle} />
            </label>

            {enabled && (
                <>
                    {/* Active language rows */}
                    <div className="flex flex-col gap-[7px]">
                        {/* Primary — always shown with [Primary] tag */}
                        <LangRow
                            locale={effectivePrimary} full={primary.full} short={primary.short}
                            variant="primary"
                            rightSlot={
                                <span className={cn(s.badge, 'bg-blue-600 text-[#fff]')}>
                                    <Check size={9} strokeWidth={3} /> {tx.primary}
                                </span>
                            }
                        />

                        {/* Secondary — shown when a 2nd language is configured (switcherVisible) */}
                        {secondaryLocale && secondary && (
                            <LangRow
                                locale={secondaryLocale}
                                full={secondary.full}
                                short={secondary.short}
                                variant="added"
                                rightSlot={
                                    <span className="inline-flex items-center gap-[4px]">
                                        <button
                                            type="button"
                                            onClick={() => secondaryLocale && onMakePrimary?.(secondaryLocale)}
                                            className={cn(s.btn, 'border-white/10 text-white/70 hover:border-blue-400 hover:text-blue-400')}
                                        >
                                            {tx.makeDefault}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onRemoveLanguage}
                                            aria-label={tx.removeLanguage}
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
                        <div className="flex flex-col gap-[7px]">
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-white/30 px-[1px]">
                                {tx.addSecondary}
                            </p>
                            {addOptions.map(opt => {
                                const isThisPending = pendingLocale === opt.locale
                                return (
                                    <LangRow
                                        key={opt.locale}
                                        locale={opt.locale} full={opt.full} short={opt.short}
                                        variant={hasSecondary || (isPending && !isThisPending) ? 'disabled' : 'default'}
                                        rightSlot={
                                            isThisPending ? (
                                                <span className="inline-flex items-center gap-[4px] text-[10px] font-semibold text-blue-400">
                                                    <Loader2 size={11} className="animate-spin" />
                                                    {tx.adding}
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
                                                    {tx.add}
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
                            <span>{ti(tx.maxLanguages, { name: secondary.full })}</span>
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
