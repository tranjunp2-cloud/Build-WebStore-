import { describe, it, expect } from 'vitest'

/**
 * TC-F05-SEO-SLUG-LOCK: Slug lock while published
 * Tests the business rule: slug cannot be changed while site is currently published.
 * Unpublished sites (even if previously published) CAN change slugs.
 * Logic extracted from: src/app/api/sites/[siteId]/pages/[pageId]/route.ts
 */

/** Mirrors the slug lock check in the PATCH route handler */
function isSlugLocked(site: { status?: string; publishedAt?: string | null }): boolean {
    return site.status === 'published'
}

describe('Slug Lock While Published (TC-F05-SEO-SLUG-LOCK)', () => {
    it('should lock slug when site status is published', () => {
        expect(isSlugLocked({ status: 'published' })).toBe(true)
    })

    it('should lock slug when published with publishedAt', () => {
        expect(isSlugLocked({ status: 'published', publishedAt: '2026-04-13T00:00:00Z' })).toBe(true)
    })

    it('should allow slug change when site is draft (even if previously published)', () => {
        expect(isSlugLocked({ status: 'draft', publishedAt: '2026-04-13T00:00:00Z' })).toBe(false)
    })

    it('should allow slug change when site is draft with no publishedAt', () => {
        expect(isSlugLocked({ status: 'draft' })).toBe(false)
    })

    it('should allow slug change for new site with no status', () => {
        expect(isSlugLocked({})).toBe(false)
    })
})
