import { expect, it } from 'vitest'
import { blogListingPath } from '@/lib/blog/listing-path'
it('[TC-F35.M55] resolves an actual dedicated listing instead of inventing /blog', () => {
    const pages = [{ slug: 'home', isHomepage: true, layout: [{ blockType: 'blog-list' }] }, { slug: 'articles', layout: [{ blockType: 'blog-list' }] }]
    const result = blogListingPath(pages)
    expect(result).toBe('/articles')
})
it('[TC-F35.M55] falls back to homepage and excludes draft listings', () => {
    const pages = [{ slug: 'news', _status: 'draft', layout: [{ blockType: 'blog-list' }] }]
    expect(blogListingPath(pages)).toBe('')
    expect(blogListingPath([])).toBe('')
})
