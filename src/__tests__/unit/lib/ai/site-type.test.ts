/**
 * TC-F01-ST-01..04 — Phase fix-500 siteType resolver.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/reports/fix-500-debug.md
 *
 * Verifies resolveSiteType covers every value in SITES_VALID_SITE_TYPES,
 * maps known aliases (portfolio→creative), and defaults unknown to business.
 * This is the hot-fix for the DOMINANT 500 error in /api/ai/generate-site
 * logs ("The following field is invalid: Site Type" — 7 hits / 6h window).
 */

import { describe, it, expect } from 'vitest'
import {
    resolveSiteType,
    isValidSiteType,
    SITES_VALID_SITE_TYPES,
    type SiteType,
} from '@/lib/ai/site-type'

describe('resolveSiteType', () => {
    describe('TC-F01-ST-01: pass-through for valid Sites enum values', () => {
        for (const type of SITES_VALID_SITE_TYPES) {
            it(`"${type}" → "${type}"`, () => {
                expect(resolveSiteType(type)).toBe(type)
            })
        }

        it('case insensitive — "PORTFOLIO" still aliases', () => {
            expect(resolveSiteType('PORTFOLIO')).toBe('creative')
        })

        it('trims whitespace', () => {
            expect(resolveSiteType('  business  ')).toBe('business')
            expect(resolveSiteType('  portfolio  ')).toBe('creative')
        })
    })

    describe('TC-F01-ST-02: legacy + alias mapping', () => {
        it('portfolio → creative (the dominant bug fix)', () => {
            expect(resolveSiteType('portfolio')).toBe('creative')
        })

        it('composer fnb → restaurant', () => {
            expect(resolveSiteType('fnb')).toBe('restaurant')
            expect(resolveSiteType('cafe')).toBe('restaurant')
        })

        it('events/travel → business (no Sites enum match)', () => {
            expect(resolveSiteType('events')).toBe('business')
            expect(resolveSiteType('travel')).toBe('business')
        })

        it('industry synonyms route to parent category', () => {
            expect(resolveSiteType('dental')).toBe('health')
            expect(resolveSiteType('clinic')).toBe('health')
            expect(resolveSiteType('gym')).toBe('fitness')
            expect(resolveSiteType('spa')).toBe('beauty')
            expect(resolveSiteType('salon')).toBe('beauty')
            expect(resolveSiteType('saas')).toBe('tech')
            expect(resolveSiteType('property')).toBe('realestate')
            expect(resolveSiteType('training')).toBe('education')
            expect(resolveSiteType('store')).toBe('ecommerce')
            expect(resolveSiteType('freelancer')).toBe('creative')
            expect(resolveSiteType('agency')).toBe('creative')
        })

        it('hyphen/underscore normalization', () => {
            expect(resolveSiteType('real-estate')).toBe('realestate')
            expect(resolveSiteType('real_estate')).toBe('realestate')
        })
    })

    describe('TC-F01-ST-03: safe defaults for invalid input', () => {
        it('empty string → business', () => {
            expect(resolveSiteType('')).toBe('business')
            expect(resolveSiteType('   ')).toBe('business')
        })

        it('unknown string → business', () => {
            expect(resolveSiteType('xyzzy')).toBe('business')
            expect(resolveSiteType('not-a-real-category')).toBe('business')
        })

        it('null/undefined/number → business', () => {
            expect(resolveSiteType(undefined)).toBe('business')
            expect(resolveSiteType(null)).toBe('business')
            expect(resolveSiteType(42)).toBe('business')
            expect(resolveSiteType({})).toBe('business')
            expect(resolveSiteType([])).toBe('business')
        })
    })

    describe('TC-F01-ST-04: invariants', () => {
        it('SITES_VALID_SITE_TYPES has exactly 11 entries (matches Sites collection)', () => {
            expect(SITES_VALID_SITE_TYPES.length).toBe(11)
        })

        it('every value returned by resolveSiteType is in SITES_VALID_SITE_TYPES', () => {
            const inputs = ['portfolio', 'creative', 'unknown', 'fnb', '', null, 42, 'dental']
            const valid = new Set<SiteType>(SITES_VALID_SITE_TYPES)
            for (const input of inputs) {
                expect(valid.has(resolveSiteType(input))).toBe(true)
            }
        })

        it('isValidSiteType guards enum membership strictly (no alias tolerance)', () => {
            expect(isValidSiteType('creative')).toBe(true)
            expect(isValidSiteType('portfolio')).toBe(false) // alias, not a member
            expect(isValidSiteType('fnb')).toBe(false)
            expect(isValidSiteType(undefined)).toBe(false)
        })
    })
})
