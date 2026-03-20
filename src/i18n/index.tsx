'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import en from './locales/en.json'
import ms from './locales/ms.json'

// ─── Types ──────────────────────────────────────────────────────────────
export type Locale = 'en' | 'ms'
type Translations = typeof en

interface I18nContextType {
    locale: Locale
    t: Translations
    setLocale: (locale: Locale) => void
    toggleLocale: () => void
}

// ─── Context ────────────────────────────────────────────────────────────
const locales: Record<Locale, Translations> = { en, ms }
const I18nContext = createContext<I18nContextType | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────
export function I18nProvider({ children, defaultLocale = 'en' }: { children: ReactNode; defaultLocale?: Locale }) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale)

    // Hydrate from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('primeweb-locale') as Locale | null
        if (saved && locales[saved]) {
            setLocaleState(saved)
        }
    }, [])

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale)
        localStorage.setItem('primeweb-locale', newLocale)
        document.documentElement.lang = newLocale

        // Sync to backend DB for logged-in users (FR-05)
        fetch('/api/users/me/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefer_lang: newLocale })
        }).catch(err => console.warn('Failed to sync language', err))
    }, [])

    const toggleLocale = useCallback(() => {
        setLocale(locale === 'en' ? 'ms' : 'en')
    }, [locale, setLocale])

    return (
        <I18nContext.Provider value={{ locale, t: locales[locale], setLocale, toggleLocale }}>
            {children}
        </I18nContext.Provider>
    )
}

// ─── Hook ───────────────────────────────────────────────────────────────
export function useI18n() {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error('useI18n must be used within I18nProvider')
    return ctx
}

export { type Translations }
