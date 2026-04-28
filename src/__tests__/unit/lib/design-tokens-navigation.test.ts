/**
 * Unit Tests: Navigation design tokens — NAV_HEIGHT, NAV_Z_INDEX, NAV_Z_CLASS
 * TC-ID: TC-NAV-TOK-01..07
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import {
    NAV_HEIGHT,
    NAV_HEIGHT_PX,
    NAV_HEIGHT_CLASS,
    NAV_HEIGHT_PT_CLASS,
    NAV_HEIGHT_VAR,
    NAV_Z_INDEX,
    NAV_Z_CLASS,
} from '@/lib/design-tokens'

describe('Navigation design tokens', () => {
    it('TC-NAV-TOK-01: NAV_HEIGHT is 64 pixels', () => {
        expect(NAV_HEIGHT).toBe(64)
    })

    it('TC-NAV-TOK-02: NAV_HEIGHT_PX is 64px string', () => {
        expect(NAV_HEIGHT_PX).toBe('64px')
    })

    it('TC-NAV-TOK-03: NAV_HEIGHT_CLASS maps to h-16 Tailwind', () => {
        expect(NAV_HEIGHT_CLASS).toBe('h-16')
    })

    it('TC-NAV-TOK-04: NAV_HEIGHT_PT_CLASS maps to pt-16 Tailwind', () => {
        expect(NAV_HEIGHT_PT_CLASS).toBe('pt-16')
    })

    it('TC-NAV-TOK-05: NAV_HEIGHT_VAR contains CSS var expression', () => {
        expect(NAV_HEIGHT_VAR).toContain('var(--nav-height')
        expect(NAV_HEIGHT_VAR).toContain('64px')
    })

    it('TC-NAV-TOK-06: z-index tiers are strictly ascending', () => {
        expect(NAV_Z_INDEX.base).toBeLessThan(NAV_Z_INDEX.dropdown)
        expect(NAV_Z_INDEX.dropdown).toBeLessThan(NAV_Z_INDEX.mobileBackdrop)
        expect(NAV_Z_INDEX.mobileBackdrop).toBeLessThan(NAV_Z_INDEX.mobileSidebar)
    })

    it('TC-NAV-TOK-07: NAV_Z_CLASS strings are correctly formatted arbitrary Tailwind classes', () => {
        expect(NAV_Z_CLASS.base).toBe('z-[50]')
        expect(NAV_Z_CLASS.dropdown).toBe('z-[51]')
        expect(NAV_Z_CLASS.mobileBackdrop).toBe('z-[52]')
        expect(NAV_Z_CLASS.mobileSidebar).toBe('z-[53]')
    })
})
