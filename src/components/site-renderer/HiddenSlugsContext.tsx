'use client'

import { createContext, useContext, type ReactNode } from 'react'

type HiddenContext = {
    /** Normalized /slugs of hidden/deleted pages — used for live-site and nav link URLs. */
    slugs: Set<string>
    /** Page IDs of hidden/deleted pages — used for editor preview URLs (/preview/...?pageId=xxx). */
    pageIds: Set<string>
}

const EMPTY: HiddenContext = { slugs: new Set(), pageIds: new Set() }
const HiddenSlugsContext = createContext<HiddenContext>(EMPTY)

export function HiddenSlugsProvider({ value, children }: { value: HiddenContext; children: ReactNode }) {
    return <HiddenSlugsContext.Provider value={value}>{children}</HiddenSlugsContext.Provider>
}

/** Returns true when the given URL points to a hidden or deleted page (editor mode only). */
export function useIsHiddenLink(url: string | undefined): boolean {
    const { slugs, pageIds } = useContext(HiddenSlugsContext)
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed || trimmed === '#') return false

    // Editor preview URLs: /preview/{siteId}?pageId={id}
    if (pageIds.size && trimmed.includes('pageId=')) {
        try {
            const pageId = new URL(trimmed, 'http://x').searchParams.get('pageId')
            if (pageId && pageIds.has(pageId)) return true
        } catch { /* invalid URL — fall through */ }
    }

    // Slug-based: /about, about → /about
    if (slugs.size && !trimmed.startsWith('http')) {
        const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
        if (slugs.has(normalized)) return true
    }

    return false
}
