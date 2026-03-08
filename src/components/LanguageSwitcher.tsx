'use client'

import { useI18n, Locale } from '@/i18n'

const FLAG: Record<Locale, string> = { en: '🇬🇧', ms: '🇲🇾' }
const LABEL: Record<Locale, string> = { en: 'EN', ms: 'MY' }

export default function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'minimal' }) {
    const { locale, setLocale } = useI18n()

    if (variant === 'minimal') {
        return (
            <button
                onClick={() => setLocale(locale === 'en' ? 'ms' : 'en')}
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
