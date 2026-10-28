'use client'

import { createContext, type ReactNode, useContext } from 'react'
import { VISITOR_LANGUAGE_COOKIE } from '@/lib/site-languages'

/**
 * The live site's languages for the menu's language switcher: the languages the site has and the one being
 * served. Outside the live site (the editor, its preview) there is no provider and the switcher keeps
 * talking to the editor.
 */
type LiveLanguage = { languages: string[]; active: string }

const LiveLanguageContext = createContext<LiveLanguage | null>(null)

export function LiveLanguageProvider({ languages, active, children }: LiveLanguage & { children: ReactNode }) {
    return <LiveLanguageContext.Provider value={{ languages, active }}>{children}</LiveLanguageContext.Provider>
}

export const useLiveLanguage = () => useContext(LiveLanguageContext)

/** A visitor picks a language: kept in a cookie for the site's pages, and the page is served again in it. */
export function chooseVisitorLanguage(code: string) {
    document.cookie = `${VISITOR_LANGUAGE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
}
