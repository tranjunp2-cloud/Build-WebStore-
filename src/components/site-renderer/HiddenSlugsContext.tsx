'use client'

import { createContext, useContext, type ReactNode } from 'react'

const HiddenSlugsContext = createContext<Set<string>>(new Set())

export function HiddenSlugsProvider({ value, children }: { value: Set<string>; children: ReactNode }) {
    return <HiddenSlugsContext.Provider value={value}>{children}</HiddenSlugsContext.Provider>
}

/** Returns true when the given URL points to a hidden/deleted page (editor mode only). */
export function useIsHiddenLink(url: string | undefined): boolean {
    const hiddenSlugs = useContext(HiddenSlugsContext)
    if (!url || !hiddenSlugs.size) return false
    const trimmed = url.trim()
    if (!trimmed || trimmed === '#') return false
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return hiddenSlugs.has(normalized)
}
