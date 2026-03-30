'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import en from './locales/en.json'
import ms from './locales/ms.json'

// ─── Types ──────────────────────────────────────────────────────────────
export type Locale = 'en' | 'ms'
type Translations = typeof en

interface PluralKeys {
    one: string
    other: string
}

interface I18nContextType {
    locale: Locale
    t: Translations
    setLocale: (locale: Locale) => void
    toggleLocale: () => void
    /** Pluralize based on count. Replaces {count} in the template.
     *  EN: uses `one` for count===1, `other` otherwise.
     *  BM: `one` and `other` are the same — no morphological change.
     *  Example: tp(t.plural.issue, 3) → "3 issues" (EN) / "3 isu" (BM)
     */
    tp: (keys: PluralKeys, count: number) => string
    /** Interpolate {key} params into a translation string.
     *  Example: ti("Fixed {count} issues", { count: 5 }) → "Fixed 5 issues"
     */
    ti: (template: string, vars: Record<string, string | number>) => string
}

// ─── Constants ──────────────────────────────────────────────────────────
const LOCALE_KEY = 'prefer_lang' // QA doc: prefer_lang (was: primeweb-locale)

// ─── Context ────────────────────────────────────────────────────────────
const locales: Record<Locale, Translations> = { en, ms }
const I18nContext = createContext<I18nContextType | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────
export function I18nProvider({ children, defaultLocale = 'en' }: { children: ReactNode; defaultLocale?: Locale }) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale)

    // Hydrate from localStorage on mount (and sync to cookie if missing)
    useEffect(() => {
        const saved = localStorage.getItem(LOCALE_KEY) as Locale | null
        if (saved && locales[saved]) {
            setLocaleState(saved)
            document.documentElement.lang = saved
            // Sync to cookie so SSR can pick it up on next reload to prevent FOUC
            document.cookie = `${LOCALE_KEY}=${saved}; path=/; max-age=31536000; samesite=lax`
        }
    }, [])

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale)
        localStorage.setItem(LOCALE_KEY, newLocale)
        document.cookie = `${LOCALE_KEY}=${newLocale}; path=/; max-age=31536000; samesite=lax`
        document.documentElement.lang = newLocale

        // Sync to backend DB for logged-in users (FR-05 / US-F21-03 AC-2)
        fetch('/api/users/me/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefer_lang: newLocale }),
        }).catch(err => console.warn('[i18n] Failed to sync language to DB:', err))
    }, [])

    const toggleLocale = useCallback(() => {
        setLocale(locale === 'en' ? 'ms' : 'en')
    }, [locale, setLocale])

    // FR-08: Pluralization — EN: "1 issue" / "2 issues", BM: "1 isu" / "2 isu" (same form)
    const tp = useCallback((keys: { one: string; other: string }, count: number): string => {
        const template = count === 1 ? keys.one : keys.other
        return template.replace('{count}', String(count))
    }, [])

    // General string interpolation — replaces {key} with vars[key]
    const ti = useCallback((template: string, vars: Record<string, string | number>): string => {
        return Object.entries(vars).reduce(
            (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
            template
        )
    }, [])

    return (
        <I18nContext.Provider value={{ locale, t: locales[locale], setLocale, toggleLocale, tp, ti }}>
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

// ─── Utility: Load prefer_lang from DB and sync to localStorage ──────────
// Call this after successful login to apply DB preference (BR-04).
export async function syncLocaleFromDB(setLocale: (locale: Locale) => void): Promise<void> {
    try {
        const res = await fetch('/api/users/me/preferences', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const dbLang = data?.prefer_lang as Locale | undefined
        if (dbLang && locales[dbLang]) {
            setLocale(dbLang) // This also updates localStorage & documentElement.lang
        }
    } catch (err) {
        console.warn('[i18n] Failed to load language from DB:', err)
    }
}

export { type Translations }
