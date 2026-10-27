'use client'

import { useI18n, Locale } from '@/i18n'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocaleFlag } from '@/components/locale-flag'

const LABEL: Record<Locale, string> = { en: 'EN', ms: 'MY' }
const LANGUAGE_NAME: Record<Locale, string> = { en: 'English', ms: 'Bahasa Melayu' }
const LOCALES: Locale[] = ['en', 'ms']
const FLAG_SRC: Record<Locale, string> = { en: '/images/flags/flag-gb.svg', ms: '/images/flags/flag-my.svg' }

export default function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'minimal' | 'globe' | 'segmented' | 'flags' }) {
    const { locale, toggleLocale, setLocale } = useI18n()
    const nextLocale = locale === 'en' ? 'ms' : 'en'

    // Auth pages (login, verify-otp): compact centred pill, SVG flag + EN/MY, teal-tinted selected option
    if (variant === 'flags') {
        return (
            <div className="flex justify-center">
                <div
                    role="group"
                    aria-label="Language"
                    className="inline-flex items-center gap-0.5 rounded-full border border-slate-400/[.16] bg-[#131a26] p-[3px]"
                >
                    {LOCALES.map((lang) => {
                        const on = locale === lang
                        return (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => setLocale(lang)}
                                aria-label={`Switch to ${LANGUAGE_NAME[lang]}`}
                                aria-pressed={on}
                                className={cn(
                                    'inline-flex h-7 items-center gap-1.5 rounded-full border-0 pl-2 pr-[11px] text-xs font-semibold leading-4 tracking-[.04em] transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50',
                                    on
                                        ? 'bg-teal-400/[.14] text-teal-300 shadow-[inset_0_0_0_1px_rgba(45,212,191,.32)]'
                                        : 'bg-transparent text-slate-400'
                                )}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- 16×12 static flag, next/image adds nothing */}
                                <img
                                    src={FLAG_SRC[lang]}
                                    alt=""
                                    width={16}
                                    height={12}
                                    className={cn(
                                        'block h-3 w-4 flex-none rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,.1)] transition-opacity duration-200',
                                        on ? 'opacity-100' : 'opacity-70'
                                    )}
                                />
                                <span>{LABEL[lang]}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

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
                    {LOCALES.map((lang) => (
                        <button
                            key={lang}
                            type="button"
                            onClick={() => setLocale(lang)}
                            style={{
                                ...tabBase,
                                ...(locale === lang ? activeStyle : inactiveStyle),
                            }}
                            aria-label={`Switch to ${LANGUAGE_NAME[lang]}`}
                        >
                            {LABEL[lang]}
                        </button>
                    ))}
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
