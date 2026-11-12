import type { ContextElement } from '@ech/agent-core'

/**
 * Where a thing is in the site editor, from anywhere that names one: a change
 * the copilot made ("Show"), an element chip in the chat (hover), an element
 * the merchant asked about. One shape so every caller goes to the same place.
 *
 * - block: a section on a page, optionally one field inside it (`path`)
 * - seo: the page's SEO settings (`path` = seoTitle / seoDescription)
 * - menu / footer: the site header or footer (`path` = header.links, footer.columns.1…)
 * - page: the page itself (switch to it)
 */
export type RevealSurface = 'block' | 'seo' | 'menu' | 'footer' | 'page'

export type RevealTarget = {
    surface: RevealSurface
    pageId?: string
    /** the section, as the server addresses it (`editorBlockId`) */
    blockId?: string
    /** dot path inside the section, or the page / menu field */
    path?: string
    /** what the walker and the canvas tag say: "Hero · Button 1" */
    where: string
    before?: string | null
    /** the value as it is now — finds the element on the canvas and the field in Settings */
    after?: string
    /** a translation's line: the language it is in (the canvas switches to it to show it) */
    locale?: string
}

/** "ctaButtons.0.label" → ["ctaButtons", 0, "label"] */
export function revealPathSegments(path: string): Array<string | number> {
    return path.split('.').filter(Boolean).map((part) => (/^\d+$/.test(part) ? Number(part) : part))
}

export function valueAtRevealPath(value: unknown, path: string | undefined): unknown {
    if (!path) return undefined
    let node: unknown = value
    for (const segment of revealPathSegments(path)) {
        if (node === null || typeof node !== 'object') return undefined
        node = (node as Record<string | number, unknown>)[segment]
    }
    return node
}

type RevealDiff = { entity: { kind: string; id: string; label?: string }; field: string; path?: string; before: string | null; after: string }
type RevealChange = { action?: { kind: string; payload?: unknown } }

/** The page a section of a change is on: the plan's `pageId`, or the page of `pages[]` whose ops touch it. */
function pageOfBlock(changeSet: RevealChange, blockId: string): string | undefined {
    const plan = (changeSet.action?.payload ?? {}) as { pageId?: unknown; pages?: unknown }
    if (typeof plan.pageId === 'string' && plan.pageId) return plan.pageId
    const pages = Array.isArray(plan.pages) ? (plan.pages as Array<{ pageId?: unknown; ops?: unknown }>) : []
    const owner = pages.find((page) =>
        Array.isArray(page.ops) &&
        (page.ops as Array<{ blockId?: unknown; block?: { id?: unknown } }>).some((op) => op.blockId === blockId || op.block?.id === blockId),
    )
    return typeof owner?.pageId === 'string' ? owner.pageId : undefined
}

/** A translation (or a text edit made while viewing a translation) writes the page's copy in that language, not the one on the canvas. */
export function translatedInto(changeSet: RevealChange): string | undefined {
    const kind = changeSet.action?.kind
    const payload = changeSet.action?.payload as { locale?: unknown; pages?: Array<{ locale?: unknown }> } | undefined
    const locale = kind === 'site.translate_page' || kind === 'site.page_patch' ? payload?.locale : kind === 'site.pages_patch' ? payload?.pages?.find((page) => page.locale)?.locale : undefined
    return typeof locale === 'string' && locale ? locale : undefined
}

/** "Hero · Home" + "ctaButtons · “Shop now” · label" → "Hero · ctaButtons · “Shop now” · label" */
function whereOf(diff: RevealDiff): string {
    const owner = diff.entity.label?.split(' · ')[0] ?? diff.entity.id
    return `${owner} · ${diff.field}`
}

/**
 * Where one line of a change card is. A section's line names its field by
 * `path`; the menu and footer by their path (older cards: by the field's words);
 * SEO by the page field. Theme and widget changes have no place → null.
 */
export function revealTargetOf(changeSet: RevealChange, diff: RevealDiff): RevealTarget | null {
    const { kind, id } = diff.entity
    const base = { where: whereOf(diff), before: diff.before, after: diff.after }
    if (kind === 'site_navigation') {
        const footer = diff.path ? diff.path.startsWith('footer') : /footer|tagline|copyright|social/i.test(diff.field)
        return { ...base, surface: footer ? 'footer' : 'menu', ...(diff.path ? { path: diff.path } : {}) }
    }
    if (kind === 'site_page') {
        const seo = diff.path ? /^seo/i.test(diff.path) : /^seo /i.test(diff.field)
        // a new page's id is its address until it is created — only a real id switches pages
        const pageId = /^\d+$|^[a-f0-9]{24}$/i.test(id) ? id : undefined
        return { ...base, surface: seo ? 'seo' : 'page', ...(pageId ? { pageId } : {}), ...(diff.path ? { path: diff.path } : {}) }
    }
    if (kind !== 'site_block') return null
    const pageId = pageOfBlock(changeSet, id)
    const locale = translatedInto(changeSet)
    return { ...base, surface: 'block', blockId: id, ...(pageId ? { pageId } : {}), ...(diff.path ? { path: diff.path } : {}), ...(locale ? { locale } : {}) }
}

/** Every line of a change that has a place in the editor, in card order. */
export function revealTargetsOf(changeSet: RevealChange & { diffs: readonly RevealDiff[] }): RevealTarget[] {
    return changeSet.diffs.flatMap((diff) => {
        const target = revealTargetOf(changeSet, diff)
        return target ? [target] : []
    })
}

const ELEMENT_SURFACE: Record<ContextElement['kind'], RevealSurface> = {
    text: 'block',
    button: 'block',
    image: 'block',
    section: 'block',
    seo: 'seo',
    menu: 'menu',
    footer: 'footer',
    page: 'page',
    // a record picked in the chat is not on the canvas: no page, no section → nothing to light up
    product: 'page',
    post: 'page',
}

/** An element chip of the chat → where it is (hover lights it up). */
export function elementRevealTarget(element: ContextElement): RevealTarget {
    return {
        surface: ELEMENT_SURFACE[element.kind] ?? 'block',
        ...(element.pageId ? { pageId: element.pageId } : {}),
        ...(element.blockId ? { blockId: element.blockId } : {}),
        ...(element.path ? { path: element.path } : {}),
        where: element.label,
        ...(element.value ? { after: element.value } : {}),
    }
}
