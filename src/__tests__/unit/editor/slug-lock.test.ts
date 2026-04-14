import { describe, it, expect } from 'vitest'

/**
 * TC-F05-SEO-SLUG-LOCK: Slug lock after publish
 * Tests the business rule: slug cannot be changed when site is published.
 * Logic extracted from: src/app/api/sites/[siteId]/pages/[pageId]/route.ts
 */

/** Mirrors the slug lock check in the PATCH route handler */
function isSlugLocked(site: { status?: string; publishedAt?: string | null }): boolean {
    return Boolean(site.publishedAt || site.status === 'published')
}

describe('Slug Lock After Publish (TC-F05-SEO-SLUG-LOCK)', () => {
    it('should lock slug when site status is published', () => {
        expect(isSlugLocked({ status: 'published' })).toBe(true)
    })

    it('should lock slug when site has publishedAt timestamp', () => {
        expect(isSlugLocked({ publishedAt: '2026-04-13T00:00:00Z' })).toBe(true)
    })

    it('should lock slug when both status and publishedAt are set', () => {
        expect(isSlugLocked({ status: 'published', publishedAt: '2026-04-13T00:00:00Z' })).toBe(true)
    })

    it('should allow slug change when site is draft', () => {
        expect(isSlugLocked({ status: 'draft' })).toBe(false)
    })

    it('should allow slug change when site has no publishedAt', () => {
        expect(isSlugLocked({ status: 'draft', publishedAt: null })).toBe(false)
    })

    it('should allow slug change for new site with no status', () => {
        expect(isSlugLocked({})).toBe(false)
    })
})
