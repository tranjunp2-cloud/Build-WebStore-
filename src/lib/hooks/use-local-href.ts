'use client'

import { usePathname } from 'next/navigation'
import { BROKEN_URL_PREFIX } from '@/lib/navigation-url'

/**
 * Returns a resolver that prefixes internal relative paths with `/sites/{slug}`
 * when running in local dev (pathname matches `/sites/{slug}/...`).
 *
 * Leaves unchanged: external URLs, anchors, /preview/ paths, /sites/ paths,
 * broken-URL markers, and undefined/empty (returns '#').
 */
export function useLocalHref() {
    const pathname = usePathname()
    const localMatch = pathname?.match(/^\/sites\/([^/]+)/)
    if (!localMatch) return (href: string | undefined) => href || '#'
    const localSlug = localMatch[1]
    return (href: string | undefined): string => {
        if (!href) return '#'
        if (
            /^https?:\/\//.test(href) ||
            href.startsWith('//') ||
            href.startsWith('#') ||
            href.startsWith('/preview/') ||
            href.startsWith('/sites/') ||
            href.startsWith(BROKEN_URL_PREFIX)
        ) {
            return href
        }
        const normalized = href.startsWith('/') ? href : `/${href}`
        return `/sites/${localSlug}${normalized}`
    }
}
