import { getDisplayPageTitle } from '@/store/editorStore'
import type { PageData } from '@/store/editorStore'
import { isReservedPageSlug } from '@/lib/utils/reserved-page-slugs'
import { buildSlugCanonicalMap, resolveInternalUrlPath } from '@/lib/navigation-url'

/** System pages (404) live in the footer section, never in the regular page list. */
export const SYSTEM_PAGE_SLUGS = new Set(['404', '/404'])

export function slugifyPageTitle(title: string) {
    return title
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
}

/** Public URL path of a page — homepage is always "/". */
export function getPagePath(page: Pick<PageData, 'slug' | 'isHomepage'>) {
    if (page.isHomepage || page.slug === 'home' || page.slug === '') return '/'
    return page.slug.startsWith('/') ? page.slug : `/${page.slug}`
}

/** Collect slugs (normalized to /slug) from a nav links tree (recursive). */
function collectNavSlugs(links: unknown, slugCanonical: Map<string, string>): Set<string> {
    const slugs = new Set<string>()
    if (!Array.isArray(links)) return slugs
    for (const link of links) {
        if (!link || typeof link !== 'object') continue
        const l = link as { url?: string; children?: unknown }
        const resolvedPath = resolveInternalUrlPath(l.url, slugCanonical)
        if (resolvedPath) slugs.add(resolvedPath)
        if (l.children) for (const s of collectNavSlugs(l.children, slugCanonical)) slugs.add(s)
    }
    return slugs
}

/** Return IDs of pages whose slug appears in the nav links tree. */
export function collectMenuPageIds(links: unknown, pages: PageData[]): Set<string> {
    const navSlugs = collectNavSlugs(links, buildSlugCanonicalMap(pages))
    const ids = new Set<string>()
    for (const page of pages) {
        if (navSlugs.has(getPagePath(page))) ids.add(page.id)
    }
    return ids
}

export type PageStatusKind = 'live' | 'draft' | 'hidden'

export interface PageStatusLabels {
    tooltipLive: string
    tooltipLiveHidden: string
    tooltipLiveNoLink: string
    tooltipDraft: string
    tooltipDraftSite: string
}

export interface PageStatus {
    kind: PageStatusKind
    /** Live page that is not linked from the header menu. */
    noLink: boolean
    tooltip: string
}

/**
 * Status shown on a page card. Hidden wins over Live/Draft because hiding is an
 * explicit user choice; the tooltip still explains whether the page is live.
 */
export function getPageStatus(
    page: PageData,
    labels: PageStatusLabels,
    siteStatus?: string,
    menuPageIds?: Set<string>,
): PageStatus {
    const isPageLive = page.status === 'published' && siteStatus === 'published'

    if (page.isVisible === false) {
        return { kind: 'hidden', noLink: false, tooltip: isPageLive ? labels.tooltipLiveHidden : labels.tooltipDraft }
    }
    if (isPageLive) {
        const noLink = Boolean(menuPageIds && !menuPageIds.has(page.id))
        return { kind: 'live', noLink, tooltip: noLink ? labels.tooltipLiveNoLink : labels.tooltipLive }
    }
    const draftBecauseSite = page.status === 'published' && siteStatus !== 'published'
    return { kind: 'draft', noLink: false, tooltip: draftBecauseSite ? labels.tooltipDraftSite : labels.tooltipDraft }
}

export type NewPageValidation = { slug: string; error: null | 'empty' | 'invalid' | 'duplicate' | 'reserved' }

/**
 * Client-side check for the "Add new page" form. Compares against every
 * non-deleted page (including the 404 system page) by slug, path and title.
 * The server's 409 response stays as the fallback for anything missed here.
 */
export function validateNewPageTitle(title: string, pages: PageData[], locale: string): NewPageValidation {
    const name = title.trim()
    const slug = slugifyPageTitle(name)
    if (!name) return { slug, error: 'empty' }
    if (!slug) return { slug, error: 'invalid' }
    if (isReservedPageSlug(slug)) return { slug, error: 'reserved' }

    const lowerName = name.toLowerCase()
    const path = `/${slug}`
    const duplicate = pages.some(page => {
        if (page.deletedAt) return false
        const pageSlug = page.slug.replace(/^\//, '')
        return pageSlug === slug
            || getPagePath(page) === path
            || page.title.trim().toLowerCase() === lowerName
            || getDisplayPageTitle(page, locale).trim().toLowerCase() === lowerName
    })
    return { slug, error: duplicate ? 'duplicate' : null }
}
