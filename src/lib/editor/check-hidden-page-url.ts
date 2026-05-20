import { buildSlugCanonicalMap, resolveInternalUrlPath } from '@/lib/navigation-url'
import type { PageData } from '@/store/editorStore'

export type HiddenPageStatus = 'hidden' | 'draft' | 'deleted' | 'not-found' | false

/** Returns the visibility status of the page that `url` points to, or false if the page is fully visible/public. */
export function checkHiddenPageUrl(url: string | undefined, pages?: PageData[]): HiddenPageStatus {
    if (!url || !pages?.length) return false
    const slugCanonical = buildSlugCanonicalMap(pages)
    const resolvedPath = resolveInternalUrlPath(url, slugCanonical)
    if (!resolvedPath) return false
    const match = pages.find(p => {
        const s = (p.slug ?? '').trim()
        const pagePath = ((p as { isHomepage?: boolean }).isHomepage || !s || s === '/') ? '/' : (s.startsWith('/') ? s : `/${s}`)
        return pagePath === resolvedPath
    })
    if (!match) return 'not-found'
    if (match.deletedAt != null && match.deletedAt !== '') return 'deleted'
    if (match.isVisible === false) return 'hidden'
    if (match.status === 'draft') return 'draft'
    return false
}
