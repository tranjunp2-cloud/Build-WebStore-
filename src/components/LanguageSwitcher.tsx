'use client'

import { useI18n, Locale } from '@/i18n'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const FLAG: Record<Locale, string> = { en: '🇬🇧', ms: '🇲🇾' }
const LABEL: Record<Locale, string> = { en: 'EN', ms: 'MY' }

export default function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'minimal' | 'globe' | 'segmented' }) {
    const { locale, toggleLocale, setLocale } = useI18n()
    const nextLocale = locale === 'en' ? 'ms' : 'en'

    if (variant === 'globe') {
        return (
            <button
                onClick={() => toggleLocale()}
                className="group relative flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-all duration-200 px-2 py-1.5 rounded-lg hover:bg-zinc-100"
                aria-label={`Switch to ${nextLocale === 'en' ? 'English' : 'Bahasa Melayu'}`}
                title={locale === 'en' ? 'English' : 'Bahasa Melayu'}
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
                <span>{FLAG[locale]}</span>
                <span className="font-medium">{LABEL[locale]}</span>
            </button>
        )
    }

    if (variant === 'segmented') {
        return (
            <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-[rgba(248,250,252,0.5)]" />
                <div className="flex flex-1 items-center rounded-[16px] border border-white/[0.08] bg-[#1E293B] px-1 h-[42px]">
                    <button
                        type="button"
                        onClick={() => locale !== 'ms' && toggleLocale()}
                        className={cn(
                            'flex-1 flex items-center justify-center rounded-[12px] h-[32px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                            locale === 'ms'
                                ? '!bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                : 'text-[rgba(248,250,252,0.6)] hover:text-white'
                        )}
                    >
                        MY
                    </button>
                    <button
                        type="button"
                        onClick={() => locale !== 'en' && toggleLocale()}
                        className={cn(
                            'flex-1 flex items-center justify-center rounded-[12px] h-[32px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                            locale === 'en'
                                ? '!bg-[#2DD4BF] text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                                : 'text-[rgba(248,250,252,0.6)] hover:text-white'
                        )}
                    >
                        EN
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
            {(['en', 'ms'] as Locale[]).map((lang) => (
                <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                        locale === lang
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                    )}
                    aria-label={`Switch to ${lang === 'en' ? 'English' : 'Bahasa Melayu'}`}
                >
                    <span className="text-base">{FLAG[lang]}</span>
                    <span>{LABEL[lang]}</span>
                </button>
            ))}
        </div>
    )
}
