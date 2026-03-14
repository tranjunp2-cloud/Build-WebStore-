'use client'

import { useI18n, Locale } from '@/i18n'
import { Globe } from 'lucide-react'

const FLAG: Record<Locale, string> = { en: '🇬🇧', ms: '🇲🇾' }
const LABEL: Record<Locale, string> = { en: 'EN', ms: 'MY' }

export default function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'minimal' | 'globe' }) {
    const { locale, setLocale } = useI18n()
    const nextLocale = locale === 'en' ? 'ms' : 'en'

    if (variant === 'globe') {
        return (
            <button
                onClick={() => setLocale(nextLocale)}
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
                onClick={() => setLocale(nextLocale)}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                aria-label="Switch language"
            >
                <span>{FLAG[locale]}</span>
                <span className="font-medium">{LABEL[locale]}</span>
            </button>
        )
    }

    return (
        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
            {(['en', 'ms'] as Locale[]).map((lang) => (
                <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${locale === lang
                        ? 'bg-sky-500/20 text-sky-400 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    aria-label={`Switch to ${lang === 'en' ? 'English' : 'Bahasa Melayu'}`}
                >
                    <span className="text-base">{FLAG[lang]}</span>
                    <span>{LABEL[lang]}</span>
                </button>
            ))}
        </div>
    )
}
