/**
 * TC-AIWB-65 — the change walker under the canvas: opened at the line the merchant clicked,
 * ‹ › go through every place of the change (wrapping), each step bumps `seq` (the same place
 * reveals again), Done closes. Real: useChangeWalker store. Faked: nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useChangeWalker } from '@/components/editor/agent/change-walker-store'

const targets = ['Hero · headline', 'Hero · ctaButtons', 'SEO · SEO title'].map((where) => ({ surface: 'block' as const, where }))

describe('change walker [TC-AIWB-65]', () => {
    beforeEach(() => useChangeWalker.getState().close())

    it('opens at the clicked line and steps both ways, wrapping', () => {
        useChangeWalker.getState().open(targets, 1)
        expect(useChangeWalker.getState().index).toBe(1)
        useChangeWalker.getState().step(1)
        useChangeWalker.getState().step(1)
        expect(useChangeWalker.getState().index).toBe(0)
        useChangeWalker.getState().step(-1)
        expect(useChangeWalker.getState().targets[useChangeWalker.getState().index]?.where).toBe('SEO · SEO title')
    })

    it('every open and step bumps seq; an out-of-range start is clamped; Done empties it', () => {
        const before = useChangeWalker.getState().seq
        useChangeWalker.getState().open(targets, 9)
        expect(useChangeWalker.getState().index).toBe(2)
        useChangeWalker.getState().step(0)
        expect(useChangeWalker.getState().seq).toBe(before + 2)
        useChangeWalker.getState().close()
        expect(useChangeWalker.getState().targets).toEqual([])
    })
})
