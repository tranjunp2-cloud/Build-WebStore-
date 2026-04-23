/**
 * Regression tests: dark-mode preset primary contrast
 * TC-IDs: TC-F01D-PR.10, TC-F01D-PR.11
 * Convention: docs/TEST_CONVENTION.md
 * PRD: docs/prd/F01-design-quality.md (FR-08)
 */

import { describe, it, expect } from 'vitest'
import { CATEGORY_PRESETS } from '@/lib/ai/theme-presets'
import { checkContrast, generatePalette, relativeLuminance } from '@/lib/theme/color-utils'

const darkPresets = Object.entries(CATEGORY_PRESETS).flatMap(([category, presets]) =>
    presets
        .filter(p => p.colorMode === 'dark')
        .map(p => ({ category, name: p.name, primary: p.primaryColor })),
)

describe('dark preset primary contrast (TC-F01D-PR.10, TC-F01D-PR.11)', () => {
    it('TC-F01D-PR.11 — no dark-mode preset has primary luminance < 0.04', () => {
        darkPresets.forEach(({ name, primary }) => {
            expect(relativeLuminance(primary), `${name}: primary ${primary} luminance too low`).toBeGreaterThanOrEqual(0.04)
        })
    })

    it('TC-F01D-PR.10 — every dark-mode preset primary passes WCAG AA-Large vs its dark surface', () => {
        darkPresets.forEach(({ name, primary }) => {
            const surface = generatePalette(primary, 'dark').surface.primary
            const result = checkContrast(primary, surface)
            expect(result.passAALarge, `${name}: primary ${primary} vs surface — ratio ${result.ratio}:1`).toBe(true)
        })
    })
})
