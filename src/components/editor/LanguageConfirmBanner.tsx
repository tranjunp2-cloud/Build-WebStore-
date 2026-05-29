'use client'

import { useState } from 'react'
import { Sparkles, Check, Languages } from 'lucide-react'
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

const KEEP_NOTE =
    'Note: Some new template elements added later in the CMS will display in EN/MY by default.'

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
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="relative w-full max-w-[520px] rounded-2xl border border-white/10 overflow-hidden"
                style={CARD_STYLE}
            >
                <div className="h-px w-full bg-gradient-to-r from-blue-500/40 via-blue-400/60 to-blue-500/40" />

                {/* Header */}
                <div className="px-6 pt-5 pb-2">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                        <Languages size={18} />
                    </div>
                    <h2 className="text-base font-bold text-white mb-1.5 tracking-tight">
                        {detected.full} language detected
                    </h2>
                    <p className="text-[13px] text-white/50 leading-relaxed">
                        The system detects that you wish to create a website in {detected.full}. However, to ensure
                        the best editing experience with full features and templates, we encourage you to optimize
                        your website in{' '}
                        <span className="text-blue-400 font-medium">English</span> or{' '}
                        <span className="text-blue-400 font-medium">Malay</span>.
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 pb-2">
                    <p className="text-[12.5px] font-semibold text-white/70 mb-3">
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
                                    className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_0_3px_rgba(59,130,246,0.22),0_0_12px_rgba(59,130,246,0.15)]'
                                            : opt.reco
                                              ? 'border-blue-500/70 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.12)] hover:border-blue-500 hover:bg-blue-500/15'
                                              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/6'
                                    }`}
                                >
                                    {/* Flag box */}
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/8 text-[20px] leading-none flex-shrink-0">
                                        {opt.flag}
                                    </span>

                                    {/* Main: name + pill + note */}
                                    <span className="flex flex-col gap-1 min-w-0">
                                        <span className={`text-[14px] font-semibold leading-none ${opt.reco ? 'text-white' : 'text-white/60'}`}>
                                            {opt.full}
                                        </span>
                                        {opt.reco && (
                                            <span className="inline-flex items-center gap-1 self-start rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 uppercase tracking-wide">
                                                <Sparkles size={9} />
                                                Recommended
                                            </span>
                                        )}
                                        {opt.note && (
                                            <span className="text-[11.5px] text-white/40 leading-snug">
                                                {opt.note}
                                            </span>
                                        )}
                                    </span>

                                    {/* Short code */}
                                    <span className={`rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wide uppercase ${
                                        opt.reco
                                            ? 'border-blue-500/50 text-blue-400'
                                            : 'border-white/15 text-white/35'
                                    }`}>
                                        {opt.short}
                                    </span>

                                    {/* Radio */}
                                    <span
                                        className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors"
                                        style={isSelected
                                            ? { border: '2px solid #3b82f6', background: '#3b82f6' }
                                            : { border: '2px solid rgba(255,255,255,0.55)', background: 'transparent' }
                                        }
                                    >
                                        {isSelected && <Check size={11} strokeWidth={3} className="text-white" />}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pt-3 pb-5 flex gap-3">
                    <button
                        type="button"
                        onClick={() => onAction('dismiss', detectedLocale)}
                        className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleContinue}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    )
}
