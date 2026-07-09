/**
 * Unit Tests — GH-1392 Dashboard No-Website Guard
 *
 * Coverage Map (Issue Test Scenarios):
 *   [TC-1392-GUARD-01] → hasWebsite=true → never guard (any path)
 *   [TC-1392-GUARD-02] → hasWebsite=false + guarded pages → show guard
 *   [TC-1392-GUARD-03] → hasWebsite=false + excluded pages → no guard
 *   [TC-1392-GUARD-04] → hasWebsite=false + dynamic/deep routes → show guard
 *   [TC-1392-GUARD-05] → hasWebsite=false + prefix boundary (false match) → show guard
 *   [TC-1392-GUARD-06] → NO_WEBSITE_EXCLUDED_PREFIXES regression check
 */

import { describe, it, expect } from 'vitest'
import { shouldShowNoWebsiteGuard, NO_WEBSITE_EXCLUDED_PREFIXES } from '@/app/(dashboard)/_components/dashboard-guard-paths'

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-01] — hasWebsite=true → false for any path
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — when hasWebsite=true', () => {
    it('[TC-1392-GUARD-01] returns false for /dashboard when site exists', () => {
        expect(shouldShowNoWebsiteGuard('/dashboard', true)).toBe(false)
    })

    it('returns false for /orders when site exists', () => {
        expect(shouldShowNoWebsiteGuard('/orders', true)).toBe(false)
    })

    it('returns false for /products when site exists', () => {
        expect(shouldShowNoWebsiteGuard('/products', true)).toBe(false)
    })

    it('returns false for /help when site exists (even excluded path)', () => {
        expect(shouldShowNoWebsiteGuard('/help', true)).toBe(false)
    })

    it('returns false for /settings/profile when site exists (excluded path)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/profile', true)).toBe(false)
    })

    it('returns false for /sites when site exists (excluded path)', () => {
        expect(shouldShowNoWebsiteGuard('/sites', true)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-02] — hasWebsite=false + guarded pages → true (show guard)
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — hasWebsite=false, guarded pages', () => {
    // Dashboard core pages
    it('[TC-1392-GUARD-02] returns true for /dashboard when no site', () => {
        expect(shouldShowNoWebsiteGuard('/dashboard', false)).toBe(true)
    })

    it('returns true for /products when no site', () => {
        expect(shouldShowNoWebsiteGuard('/products', false)).toBe(true)
    })

    it('returns true for /orders when no site', () => {
        expect(shouldShowNoWebsiteGuard('/orders', false)).toBe(true)
    })

    it('returns true for /customers when no site', () => {
        expect(shouldShowNoWebsiteGuard('/customers', false)).toBe(true)
    })

    it('returns true for /blog when no site', () => {
        expect(shouldShowNoWebsiteGuard('/blog', false)).toBe(true)
    })

    it('returns true for /discounts when no site', () => {
        expect(shouldShowNoWebsiteGuard('/discounts', false)).toBe(true)
    })

    it('returns true for /contact-leads when no site', () => {
        expect(shouldShowNoWebsiteGuard('/contact-leads', false)).toBe(true)
    })

    it('returns true for /media when no site', () => {
        expect(shouldShowNoWebsiteGuard('/media', false)).toBe(true)
    })

    it('returns true for /templates-health when no site', () => {
        expect(shouldShowNoWebsiteGuard('/templates-health', false)).toBe(true)
    })

    // Settings pages (except excluded ones)
    it('returns true for /settings when no site', () => {
        expect(shouldShowNoWebsiteGuard('/settings', false)).toBe(true)
    })

    it('returns true for /settings/payments when no site', () => {
        expect(shouldShowNoWebsiteGuard('/settings/payments', false)).toBe(true)
    })

    it('returns true for /settings/domains when no site', () => {
        expect(shouldShowNoWebsiteGuard('/settings/domains', false)).toBe(true)
    })

    it('returns true for /settings/email-templates when no site', () => {
        expect(shouldShowNoWebsiteGuard('/settings/email-templates', false)).toBe(true)
    })

    it('returns true for /settings/shipping when no site', () => {
        expect(shouldShowNoWebsiteGuard('/settings/shipping', false)).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-03] — hasWebsite=false + EXCLUDED pages → false (no guard)
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — hasWebsite=false, excluded pages', () => {
    it('[TC-1392-GUARD-03] returns false for /settings/profile (exact match, excluded)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/profile', false)).toBe(false)
    })

    it('returns false for /settings/staff (exact match, excluded)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/staff', false)).toBe(false)
    })

    it('returns false for /help (exact match, excluded)', () => {
        expect(shouldShowNoWebsiteGuard('/help', false)).toBe(false)
    })

    it('returns false for /sites (exact match, excluded)', () => {
        expect(shouldShowNoWebsiteGuard('/sites', false)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-04] — hasWebsite=false + excluded children → false (prefix match)
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — hasWebsite=false, excluded children', () => {
    it('[TC-1392-GUARD-04] returns false for /help/modules (child of excluded /help)', () => {
        expect(shouldShowNoWebsiteGuard('/help/modules', false)).toBe(false)
    })

    it('returns false for /help/faq (child of excluded /help)', () => {
        expect(shouldShowNoWebsiteGuard('/help/faq', false)).toBe(false)
    })

    it('returns false for /sites/123 (child of excluded /sites)', () => {
        expect(shouldShowNoWebsiteGuard('/sites/123', false)).toBe(false)
    })

    it('returns false for /sites/123/settings (deep child of excluded /sites)', () => {
        expect(shouldShowNoWebsiteGuard('/sites/123/settings', false)).toBe(false)
    })

    it('returns false for /settings/profile/edit (child of excluded /settings/profile)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/profile/edit', false)).toBe(false)
    })

    it('returns false for /settings/staff/invite (child of excluded /settings/staff)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/staff/invite', false)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-04] — hasWebsite=false + dynamic/deep routes → true (show guard)
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — hasWebsite=false, dynamic routes', () => {
    it('[TC-1392-GUARD-04] returns true for /orders/123 (dynamic child, not excluded)', () => {
        expect(shouldShowNoWebsiteGuard('/orders/123', false)).toBe(true)
    })

    it('returns true for /products/abc (dynamic child of products)', () => {
        expect(shouldShowNoWebsiteGuard('/products/abc', false)).toBe(true)
    })

    it('returns true for /products/abc/edit (deep dynamic route)', () => {
        expect(shouldShowNoWebsiteGuard('/products/abc/edit', false)).toBe(true)
    })

    it('returns true for /blog/123 (dynamic child of blog)', () => {
        expect(shouldShowNoWebsiteGuard('/blog/123', false)).toBe(true)
    })

    it('returns true for /blog/categories (nested non-excluded page under blog)', () => {
        expect(shouldShowNoWebsiteGuard('/blog/categories', false)).toBe(true)
    })

    it('returns true for /products/new (product creation page)', () => {
        expect(shouldShowNoWebsiteGuard('/products/new', false)).toBe(true)
    })

    it('returns true for /customers/123/details', () => {
        expect(shouldShowNoWebsiteGuard('/customers/123/details', false)).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-05] — Prefix boundary correctness (false-match protection)
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowNoWebsiteGuard — prefix boundary (false-match protection)', () => {
    it('[TC-1392-GUARD-05] returns true for /settings/profile-x (does NOT match /settings/profile)', () => {
        // This is a guarded page, not in the excluded list (which is exactly /settings/profile)
        expect(shouldShowNoWebsiteGuard('/settings/profile-x', false)).toBe(true)
    })

    it('returns true for /sites-foo (does NOT match /sites)', () => {
        // /sites-foo is not a child of /sites, should be guarded
        expect(shouldShowNoWebsiteGuard('/sites-foo', false)).toBe(true)
    })

    it('returns true for /help-me (does NOT match /help)', () => {
        expect(shouldShowNoWebsiteGuard('/help-me', false)).toBe(true)
    })

    it('returns true for /settings/staffing (does NOT match /settings/staff)', () => {
        expect(shouldShowNoWebsiteGuard('/settings/staffing', false)).toBe(true)
    })

    it('boundary: returns false for /settings/profile/ (child syntax)', () => {
        // Even with trailing slash, /settings/profile/ is a child of /settings/profile
        expect(shouldShowNoWebsiteGuard('/settings/profile/', false)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// [TC-1392-GUARD-06] — Regression: NO_WEBSITE_EXCLUDED_PREFIXES constant
// ─────────────────────────────────────────────────────────────────────────────
describe('NO_WEBSITE_EXCLUDED_PREFIXES constant', () => {
    it('[TC-1392-GUARD-06] contains exactly 4 expected excluded prefixes', () => {
        expect(NO_WEBSITE_EXCLUDED_PREFIXES).toHaveLength(4)
    })

    it('includes /settings/profile', () => {
        expect(NO_WEBSITE_EXCLUDED_PREFIXES).toContain('/settings/profile')
    })

    it('includes /settings/staff', () => {
        expect(NO_WEBSITE_EXCLUDED_PREFIXES).toContain('/settings/staff')
    })

    it('includes /help', () => {
        expect(NO_WEBSITE_EXCLUDED_PREFIXES).toContain('/help')
    })

    it('includes /sites', () => {
        expect(NO_WEBSITE_EXCLUDED_PREFIXES).toContain('/sites')
    })

    it('does not include any other paths', () => {
        const expected = ['/settings/profile', '/settings/staff', '/help', '/sites']
        expect(NO_WEBSITE_EXCLUDED_PREFIXES.sort()).toEqual(expected.sort())
    })
})
