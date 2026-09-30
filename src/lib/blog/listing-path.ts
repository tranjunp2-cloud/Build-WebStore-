type ListingPage = { slug?: string | null; isHomepage?: boolean | null; _status?: string; layout?: unknown }

/** Prefer a dedicated published listing, then a homepage listing; never invent /blog. */
export function blogListingPath(pages: ListingPage[]): string {
    const listings = pages.filter(page => page._status !== 'draft' && Array.isArray(page.layout)
        && page.layout.some(block => block && typeof block === 'object' && 'blockType' in block && block.blockType === 'blog-list'))
    const page = listings.find(page => !page.isHomepage && page.slug) ?? listings[0]
    return page && !page.isHomepage && page.slug ? `/${page.slug.replace(/^\/+/, '')}` : ''
}
