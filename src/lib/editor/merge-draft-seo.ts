/**
 * GH-2256: the pages list API returns the published version of each page, while
 * editor-data (fetched with draft:true) returns the latest draft. After a reload the
 * SEO inputs must show the draft the merchant saved, so overlay the current page's
 * draft SEO onto the loaded list.
 */
export interface DraftSeo {
    title?: string | null
    description?: string | null
}

export function mergeDraftSeo<T extends { id: string | number }>(
    pages: T[],
    currentPageId: string | number | null | undefined,
    draftSeo: DraftSeo | null | undefined,
): T[] {
    if (currentPageId == null || !draftSeo) return pages
    return pages.map(p =>
        String(p.id) === String(currentPageId)
            ? { ...p, seoTitle: draftSeo.title ?? null, seoDescription: draftSeo.description ?? null }
            : p,
    )
}

/** PATCHing SEO on a published site creates an unpublished draft → show Update. */
export function seoChangeNeedsPublish(
    siteStatus: string | undefined,
    changes: { seoTitle?: string | null; seoDescription?: string | null },
): boolean {
    return siteStatus === 'published' && (changes.seoTitle !== undefined || changes.seoDescription !== undefined)
}
