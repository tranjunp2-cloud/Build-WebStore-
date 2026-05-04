/**
 * Unit Tests — FIXED_NAV_VARIANTS set membership
 * TC-NAV-04
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F-navigation.md
 */

import { describe, it, expect } from 'vitest'
import { FIXED_NAV_VARIANTS } from '@/lib/ai/ensure-navigation'

const CANONICAL_VARIANTS = ['default', 'centered', 'mega', 'transparent', 'floating', 'sidebar'] as const

// ── TC-NAV-04: FIXED_NAV_VARIANTS contains all 6 canonical names ─────────────

describe('TC-NAV-04 — FIXED_NAV_VARIANTS contains all 6 canonical variant names', () => {
    it('has exactly 6 entries', () => {
        // Arrange + Act + Assert
        expect(FIXED_NAV_VARIANTS.size).toBe(6)
    })

    it('contains every canonical variant name', () => {
        for (const variant of CANONICAL_VARIANTS) {
            // Arrange + Act
            const isMember = FIXED_NAV_VARIANTS.has(variant)

            // Assert
            expect(isMember, `'${variant}' must be in FIXED_NAV_VARIANTS`).toBe(true)
        }
    })

    it('does not contain legacy variant names', () => {
        // Arrange
        const legacyNames = ['simple', 'mega-menu', 'pill']

        for (const legacy of legacyNames) {
            // Act + Assert
            expect(
                FIXED_NAV_VARIANTS.has(legacy),
                `legacy name '${legacy}' must not be in FIXED_NAV_VARIANTS`,
            ).toBe(false)
        }
    })
})
