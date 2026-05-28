'use client'

import { useState } from 'react'
import { getLocaleLabel, LOCALE_LABELS } from '@/lib/locale-labels'

export type LanguageConfirmAction = 'confirm' | 'switch' | 'dismiss'

export interface LanguageConfirmBannerProps {
    isOpen: boolean
    detectedLocale: string
    onAction: (action: LanguageConfirmAction, locale: string) => void
}

const CARD_STYLE = {
    background: 'linear-gradient(180deg, rgba(22,30,46,0.99) 0%, rgba(11,17,32,1) 100%)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
}

export function LanguageConfirmBanner({ isOpen, detectedLocale, onAction }: LanguageConfirmBannerProps) {
    const [selected, setSelected] = useState<string>('en')

    if (!isOpen) return null

    const detected = getLocaleLabel(detectedLocale)

    const options = [
        { locale: 'en', ...LOCALE_LABELS.en, recommended: true },
        { locale: 'ms', ...LOCALE_LABELS.ms, recommended: true },
        { locale: detectedLocale, ...detected, recommended: false },
    ]

    function handleContinue() {
        if (selected === 'en' || selected === 'ms') {
            onAction('switch', selected)
        } else {
            onAction('confirm', selected)
        }
    }

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="relative w-full max-w-md rounded-2xl border border-white/10 overflow-hidden"
                style={CARD_STYLE}
            >
                <div className="h-px w-full bg-gradient-to-r from-blue-500/40 via-teal-400/60 to-blue-500/40" />

                <div className="p-6">
                    <h2 className="text-base font-semibold text-white mb-2">
                        {detected.full} language detected
                    </h2>
                    <p className="text-xs text-white/50 mb-5">
                        The system detects that you wish to create a website in {detected.full}. However, to ensure the best
                        editing experience with full features and templates, we encourage you to optimize your website in{' '}
                        <span className="text-teal-400 font-medium">English</span> or{' '}
                        <span className="text-teal-400 font-medium">Malay</span>.
                    </p>

                    <p className="text-xs font-medium text-white/70 mb-3">You want to continue building in:</p>

                    <div className="flex flex-col gap-2">
                        {options.map((opt) => {
                            const isSelected = selected === opt.locale
                            return (
                                <button
                                    key={opt.locale}
                                    onClick={() => setSelected(opt.locale)}
                                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium text-white transition-colors text-left ${
                                        isSelected
                                            ? 'border-teal-500/60 bg-teal-500/15'
                                            : 'border-white/10 bg-white/5 hover:bg-white/8'
                                    }`}
                                >
                                    <span className="text-base">{opt.flag}</span>
                                    <span className="font-semibold">
                                        {opt.recommended ? opt.full : `Keep ${opt.full}`}
                                    </span>
                                    <div className="ml-auto flex items-center gap-1.5">
                                        {opt.recommended && (
                                            <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 uppercase tracking-wide">
                                                Recommended
                                            </span>
                                        )}
                                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60 uppercase tracking-wide">
                                            {opt.short}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <p className="mt-4 text-[11px] text-white/30">
                        Note: Some new template elements added later in the CMS will display in EN/MY by default.
                    </p>

                    <div className="mt-5 flex gap-3">
                        <button
                            onClick={() => onAction('dismiss', detectedLocale)}
                            className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleContinue}
                            className="flex-1 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-400"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
