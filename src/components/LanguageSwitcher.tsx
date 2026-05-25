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
        const activeStyle: React.CSSProperties = {
            background: '#2DD4BF',
            color: '#0B1120',
            boxShadow: '0px 0px 12px 0px rgba(45, 212, 191, 0.4)',
        }
        const inactiveStyle: React.CSSProperties = {
            background: 'transparent',
            color: 'var(--auth-text-muted)',
        }
        const tabBase: React.CSSProperties = {
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            height: 32,
            borderRadius: 12,
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: '16px',
            textAlign: 'center' as const,
            transition: 'all 0.2s ease',
        }

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    height: 'auto',
                }}
            >
                <Globe
                    style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--auth-text)' }}
                />
                <div
                    style={{
                        display: 'flex',
                        flex: 1,
                        alignItems: 'center',
                        padding: '0 4px',
                        height: 42,
                        borderRadius: 16,
                        background: 'var(--auth-input-bg)',
                        border: '1px solid var(--auth-input-border)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => locale !== 'ms' && toggleLocale()}
                        style={{
                            ...tabBase,
                            ...(locale === 'ms' ? activeStyle : inactiveStyle),
                        }}
                    >
                        MY
                    </button>
                    <button
                        type="button"
                        onClick={() => locale !== 'en' && toggleLocale()}
                        style={{
                            ...tabBase,
                            ...(locale === 'en' ? activeStyle : inactiveStyle),
                        }}
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
