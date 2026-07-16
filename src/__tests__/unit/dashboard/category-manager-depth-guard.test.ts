// TC-F08-05-24/25/26: getCategoryDepth hop-cap + search-result level accuracy (full-PR review)
import { describe, it, expect } from 'vitest'
import { getCategoryDepth, isDescendant, annotateSearchMatchLevel, type Category } from '@/app/(dashboard)/products/categories/components/CategoryManager'

describe('CategoryManager depth guard (GH-1587 full-PR review)', () => {
    describe('TC-F08-05-24: getCategoryDepth hop cap', () => {
        it('TC-F08-05-24: computes correct depth for a normal 3-level chain', () => {
            const flatList: Category[] = [
                { id: 'l1', name: 'L1', parent: null },
                { id: 'l2', name: 'L2', parent: 'l1' },
                { id: 'l3', name: 'L3', parent: 'l2' },
            ]
            expect(getCategoryDepth(null, flatList)).toBe(1)
            expect(getCategoryDepth('l1', flatList)).toBe(2)
            expect(getCategoryDepth('l2', flatList)).toBe(3)
        })

        it('TC-F08-05-24: terminates instead of looping forever on cyclic data', () => {
            // Regression: before the fix, getCategoryDepth had no hop cap (unlike the sibling
            // isDescendant, which already capped at 5) — a mutually-parented cycle in stored
            // data (legacy rows, or a TOCTOU race in the backend's ancestor walk) would spin
            // this loop forever and freeze the tab. Any bounded return value proves termination.
            const flatList: Category[] = [
                { id: 'a', name: 'A', parent: 'b' },
                { id: 'b', name: 'B', parent: 'a' },
            ]
            const depth = getCategoryDepth('a', flatList)
            expect(depth).toBeLessThanOrEqual(7) // 1 (base) + 5 hop cap + 1 slack
            expect(Number.isFinite(depth)).toBe(true)
        })
    })

    describe('TC-F08-05-25: isDescendant still correct (unchanged, sanity check alongside the depth-cap fix)', () => {
        it('TC-F08-05-25: detects a descendant', () => {
            const flatList: Category[] = [
                { id: 'l1', name: 'L1', parent: null },
                { id: 'l2', name: 'L2', parent: 'l1' },
            ]
            expect(isDescendant('l2', 'l1', flatList)).toBe(true)
            expect(isDescendant('l1', 'l2', flatList)).toBe(false)
        })
    })

    describe('TC-F08-05-26: annotateSearchMatchLevel — real level for search results', () => {
        const flatList: Category[] = [
            { id: 'l1', name: 'Fashion', parent: null },
            { id: 'l2', name: 'Fashion Men', parent: 'l1' },
            { id: 'l3', name: 'Fashion Men Shoes', parent: 'l2' },
        ]

        it('TC-F08-05-26: an L3 search match keeps level 3, not hardcoded 1', () => {
            // Regression: before the fix, search results always got level:1, which mislabeled
            // the badge (showed "L1" for a real L3 category) and incorrectly disabled the L3-lock
            // (isLevel3 derives from level), letting users click "+ Add Subcategory" on an actual
            // L3 result — a guaranteed dead-end since the backend always rejects a 4th level.
            const result = annotateSearchMatchLevel(flatList[2], flatList)
            expect(result.level).toBe(3)
            expect(result.children).toEqual([])
        })

        it('TC-F08-05-26: an L1 search match keeps level 1', () => {
            const result = annotateSearchMatchLevel(flatList[0], flatList)
            expect(result.level).toBe(1)
        })

        it('TC-F08-05-26: handles a populated-object parent reference, not just a raw id', () => {
            const populated: Category = { id: 'l2b', name: 'Fashion Women', parent: { id: 'l1', name: 'Fashion' } }
            const result = annotateSearchMatchLevel(populated, [...flatList, populated])
            expect(result.level).toBe(2)
        })
    })
})
