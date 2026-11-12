import type { PageLocation } from '@ech/agent-core'
import { NAV_SECTIONS } from '@/config/sidebar-nav'

const segments = (path: string) => path.split('?')[0]?.split('/').filter(Boolean) ?? []

/**
 * Where the merchant is, named the way the sidebar names it: "Online Store ›
 * Product Store", "eCommerce Operations › Product Master › a record". Sent with
 * every copilot prompt (also with the page chip removed), so "which page am I
 * on" is answered from the screen, not guessed.
 */
export function dashboardPageLocation(pathname: string, module: string): PageLocation {
    const path = pathname.split('?')[0] || '/'
    let best: { title: string; depth: number } | undefined
    for (const section of NAV_SECTIONS) {
        for (const leaf of section.items) {
            // `exact` is a monorepo-only NavLeaf flag (staging's NavLeaf has none): read it if a leaf carries one
            const exact = 'exact' in leaf && (leaf as { exact?: unknown }).exact === true
            const hit = exact ? path === leaf.href : path === leaf.href || path.startsWith(`${leaf.href}/`)
            const depth = segments(leaf.href).length
            if (!hit || (best && best.depth >= depth)) continue
            best = { title: section.header ? `${section.header.en} › ${leaf.label.en}` : leaf.label.en, depth }
        }
    }
    const fallback = segments(path)[0]?.replace(/[-_]/g, ' ') ?? 'dashboard'
    const base = best?.title ?? `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}`
    // deeper than the menu item: a record of it is open (the pin names which one)
    const title = best && segments(path).length > best.depth ? `${base} › a record` : base
    return { title: title.slice(0, 120), path: path.slice(0, 300), module }
}

/** The site editor: which site page is on the canvas. */
export function editorPageLocation(siteId: string | number, pageTitle: string | null | undefined): PageLocation {
    const page = pageTitle?.trim() ? ` › page "${pageTitle.trim().slice(0, 60)}"` : ''
    return { title: `Online Store › Editor${page}`, path: `/editor/${encodeURIComponent(String(siteId))}`, module: 'editor' }
}
