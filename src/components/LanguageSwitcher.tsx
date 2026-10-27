'use client'

import { useI18n, Locale } from '@/i18n'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocaleFlag } from '@/components/locale-flag'

const LABEL: Record<Locale, string> = { en: 'EN', ms: 'MY' }
const LANGUAGE_NAME: Record<Locale, string> = { en: 'English', ms: 'Bahasa Melayu' }
const LOCALES: Locale[] = ['en', 'ms']

export default function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'minimal' | 'globe' | 'segmented' }) {
    const { locale, toggleLocale, setLocale } = useI18n()
    const nextLocale = locale === 'en' ? 'ms' : 'en'

    if (variant === 'globe') {
        return (
            <button
                onClick={() => toggleLocale()}
                className="group relative flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-all duration-200 px-2 py-1.5 rounded-lg hover:bg-zinc-100"
                aria-label={`Switch to ${LANGUAGE_NAME[nextLocale]}`}
                title={LANGUAGE_NAME[locale]}
            >
                <Globe className="w-4 h-4" />
                <span className="font-medium text-xs uppercase">{LABEL[locale]}</span>
            </button>
        )
    }

    if (variant === 'minimal') {
        return (
            <button
                onClick={() => toggleLocale()}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                aria-label="Switch language"
            >
                <LocaleFlag locale={locale} className="w-5 rounded-[2px]" />
                <span className="font-medium">{LABEL[locale]}</span>
            </button>
        )
    }

    if (variant === 'segmented') {
        return (
            <div className="flex w-full justify-center">
                <div
                    className="inline-flex items-center gap-[2px] rounded-full border border-[rgba(148,163,184,.16)] bg-[#131a26] p-[3px]"
                >
                    {LOCALES.map((lang) => {
                        const selected = locale === lang
                        return (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => setLocale(lang)}
                                aria-label={`Switch to ${LANGUAGE_NAME[lang]}`}
                                aria-pressed={selected}
                                className={cn(
                                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border-0 py-0 pl-2 pr-[11px] text-xs font-semibold leading-4 tracking-[.04em] outline-none transition-all duration-200 hover:brightness-[1.2] focus-visible:ring-2 focus-visible:ring-[rgba(45,212,191,.5)]',
                                    selected
                                        ? 'bg-[rgba(45,212,191,.14)] text-[#5eead4] shadow-[inset_0_0_0_1px_rgba(45,212,191,.32)]'
                                        : 'bg-transparent text-[#94a3b8]',
                                )}
                            >
                                <LocaleFlag
                                    locale={lang}
                                    className={cn(
                                        'h-3 w-4 rounded-[2px] ring-1 ring-white/10',
                                        selected ? 'opacity-100' : 'opacity-70',
                                    )}
                                />
                                {LABEL[lang]}
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
            {LOCALES.map((lang) => (
                <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                        locale === lang
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                    )}
                    aria-label={`Switch to ${LANGUAGE_NAME[lang]}`}
                >
                    <LocaleFlag locale={lang} className="w-5 rounded-[2px]" />
                    <span>{LABEL[lang]}</span>
                </button>
            ))}
        </div>
    )
}
