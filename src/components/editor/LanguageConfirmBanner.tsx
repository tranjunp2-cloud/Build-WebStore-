'use client'

import { useState } from 'react'
import { Languages } from 'lucide-react'
import { getLocaleLabel, LOCALE_LABELS } from '@/lib/locale-labels'
import { LocaleFlag } from '@/components/locale-flag'

export type LanguageConfirmAction = 'confirm' | 'switch' | 'dismiss'

export interface LanguageConfirmBannerProps {
    isOpen: boolean
    detectedLocale: string
    onAction: (action: LanguageConfirmAction, locale: string) => void
}

// Design tokens (Figma: F26 confirm dialog)
const GRADIENT_PRIMARY = 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)'
const ICON_GRADIENT = 'linear-gradient(135deg, hsl(var(--info)/0.18) 0%, hsl(var(--primary)/0.18) 100%)'
const DIALOG_SHADOW = '0 20px 48px -8px rgba(0,0,0,0.5), 0 6px 18px rgba(0,0,0,0.35)' /* shadow — keep */

const KEEP_NOTE =
    'Note: Some new template elements added later in the CMS will display in EN/MY by default.'

// Option card background/border per state.
function optionStyle(isSelected: boolean, reco: boolean): React.CSSProperties {
    if (isSelected) {
        return { background: 'var(--editor-surface-elevated)', border: '1px solid hsl(var(--primary))', boxShadow: '0 0 0 3px hsl(var(--primary)/0.18)' }
    }
    if (reco) {
        return { background: 'var(--editor-surface-elevated)', border: '1px solid var(--editor-border)' }
    }
    return { background: 'var(--editor-surface-elevated)', border: '1px solid var(--editor-surface-elevated)' }
}

export function LanguageConfirmBanner({ isOpen, detectedLocale, onAction }: LanguageConfirmBannerProps) {
    const [selected, setSelected] = useState<string>('en')

    if (!isOpen) return null

    const detected = getLocaleLabel(detectedLocale)

    const options = [
        { locale: 'en', ...LOCALE_LABELS.en, reco: true, note: null },
        { locale: 'ms', ...LOCALE_LABELS.ms, reco: true, note: null },
        { locale: detectedLocale, ...detected, reco: false, note: KEEP_NOTE },
    ]

    function handleContinue() {
        if (selected === 'en' || selected === 'ms') {
            onAction('switch', selected)
        } else {
            onAction('confirm', selected)
        }
    }

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm px-4">
            <div
                className="relative w-full max-w-[520px] overflow-hidden rounded-[14px] border border-[var(--editor-border)] bg-[var(--editor-surface)]"
                style={{ boxShadow: DIALOG_SHADOW }}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-2">
                    <div
                        className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[hsl(var(--info))]"
                        style={{ backgroundImage: ICON_GRADIENT }}
                    >
                        <Languages size={18} />
                    </div>
                    <h2 className="text-base font-bold text-[var(--editor-text)] mb-1.5 tracking-tight">
                        {detected.full} language detected
                    </h2>
                    <p className="text-[13px] text-[var(--editor-text-muted)] leading-relaxed">
                        The system detects that you wish to create a website in {detected.full}. However, to ensure
                        the best editing experience with full features and templates, we encourage you to optimize
                        your website in{' '}
                        <span className="text-[hsl(var(--info))] font-medium">English</span> or{' '}
                        <span className="text-[hsl(var(--info))] font-medium">Malay</span>.
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 pb-4">
                    <p className="text-[12.5px] font-semibold text-[var(--editor-text-muted)] mb-3">
                        You want to continue building in:
                    </p>

                    <div className="flex flex-col gap-2">
                        {options.map((opt) => {
                            const isSelected = selected === opt.locale
                            return (
                                <button
                                    key={opt.locale}
                                    type="button"
                                    onClick={() => setSelected(opt.locale)}
                                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-[10px] px-3.5 py-3 text-left transition-all"
                                    style={optionStyle(isSelected, opt.reco)}
                                >
                                    {/* Flag box */}
                                    <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[var(--editor-border)] bg-[var(--editor-bg)] flex-shrink-0">
                                        <LocaleFlag locale={opt.locale} className="w-6 rounded-[2px]" />
                                    </span>

                                    {/* Main: name + pill + note */}
                                    <span className="flex flex-col gap-1 min-w-0">
                                        <span className="text-[14px] font-semibold leading-none text-[var(--editor-text)]">
                                            {opt.full}
                                        </span>
                                        {opt.reco && (
                                            <span className="self-start rounded-full bg-[hsl(var(--info)/0.16)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--info))]">
                                                Recommended
                                            </span>
                                        )}
                                        {opt.note && (
                                            <span className="text-[11.5px] text-[var(--editor-text-muted)] leading-snug">
                                                {opt.note}
                                            </span>
                                        )}
                                    </span>

                                    {/* Short code chip */}
                                    <span
                                        className="rounded-[5px] border px-[7px] py-[3px] font-mono text-[10.5px] font-bold tracking-wide uppercase"
                                        style={opt.reco
                                            ? { background: 'var(--editor-surface)', borderColor: 'hsl(var(--info)/0.4)', color: 'hsl(var(--info))' }
                                            : { background: 'var(--editor-surface)', borderColor: 'var(--editor-border)', color: 'var(--editor-text-muted)' }
                                        }
                                    >
                                        {opt.short}
                                    </span>

                                    {/* Radio — solid blue disc when selected, hollow ring otherwise */}
                                    <span
                                        className="h-[18px] w-[18px] flex-shrink-0 rounded-full transition-colors"
                                        style={isSelected
                                            ? { background: 'hsl(var(--primary))' }
                                            : { border: '2px solid var(--editor-border)' }
                                        }
                                    />
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer — darker bar, buttons right-aligned */}
                <div className="flex items-center justify-end gap-2 border-t border-[var(--editor-border)] bg-[var(--editor-bg)] px-5 py-3.5">
                    <button
                        type="button"
                        onClick={() => onAction('dismiss', detectedLocale)}
                        className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[var(--editor-text-muted)] transition-colors hover:text-[var(--editor-text)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleContinue}
                        className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundImage: GRADIENT_PRIMARY, boxShadow: '0 2px 6px hsl(var(--info)/0.3)' }}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    )
}
