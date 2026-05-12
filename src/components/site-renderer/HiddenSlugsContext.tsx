'use client'

import { createContext, useContext } from 'react'

const HiddenSlugsContext = createContext<Set<string>>(new Set())

export const HiddenSlugsProvider = HiddenSlugsContext.Provider

/** Returns true when the given URL points to a hidden/deleted page (editor mode only). */
export function useIsHiddenLink(url: string | undefined): boolean {
    const hiddenSlugs = useContext(HiddenSlugsContext)
    if (!url || !hiddenSlugs.size) return false
    const trimmed = url.trim()
    if (!trimmed || trimmed === '#') return false
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return hiddenSlugs.has(normalized)
}
