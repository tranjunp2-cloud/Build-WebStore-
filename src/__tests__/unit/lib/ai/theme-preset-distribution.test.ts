/**
 * TC-F01V-TD — Theme preset distribution (Phase 02 R3 + R6)
 * Source: plans/260414-2253-ai-gen-variety-root-cause/phase-02-theme-preset-expansion.md
 *
 * Verifies pickCategoryTheme distributes presets evenly across 20 business
 * name seeds (fixes modulo-5 hash clustering) and that font pairs expanded
 * with 6 new unique IDs.
 */

import { describe, expect, it } from 'vitest'
import { pickCategoryTheme, hashBusinessName } from '@/lib/ai/category-theme-picker'
import { CATEGORY_PRESETS } from '@/lib/ai/theme-presets'
import { __FONT_PAIRINGS_FOR_TEST, resolveFontPairing } from '@/lib/ai/font-pairings'

// 20 business name samples across language + style mix
const TEST_NAMES = [
    'Farah Glow Spa', 'Priya Nails', 'Zen Hair Studio', 'Bloom Beauty',
    'Rose Petal Salon', 'Moon & Stars', 'Sunset Cafe', 'Coffee & Co',
    'Tech Forward', 'Nova Labs', 'Quantum Solutions', 'Bright Minds',
    'Green Earth', 'Urban Eats', 'Fresh Bites', 'Ocean Blue',
    'Crimson Tide', 'Mountain Peak', 'Valley View', 'City Lights',
]

describe('pickCategoryTheme — Phase 02 distribution (R3 fix)', () => {
    it('TC-F01V-TD.01 — every category has ≥8 presets', () => {
        for (const [cat, presets] of Object.entries(CATEGORY_PRESETS)) {
            expect(presets.length, `${cat} must have ≥8 presets`).toBeGreaterThanOrEqual(8)
        }
    })

    it('TC-F01V-TD.02 — 20 seeds hit ≥5 distinct presets per category', () => {
        for (const cat of Object.keys(CATEGORY_PRESETS)) {
            const picked = new Set<string>()
            for (const name of TEST_NAMES) {
                const seed = hashBusinessName(name)
                const preset = pickCategoryTheme(cat, seed)
                picked.add(preset.name)
            }
            expect(picked.size, `${cat} distribution`).toBeGreaterThanOrEqual(5)
        }
    })

    it('TC-F01V-TD.03 — no single preset wins >40% of 20 seeds', () => {
        for (const cat of Object.keys(CATEGORY_PRESETS)) {
            const counts = new Map<string, number>()
            for (const name of TEST_NAMES) {
                const seed = hashBusinessName(name)
                const preset = pickCategoryTheme(cat, seed)
                counts.set(preset.name, (counts.get(preset.name) ?? 0) + 1)
            }
            const maxShare = Math.max(...counts.values()) / TEST_NAMES.length
            expect(maxShare, `${cat} max preset share`).toBeLessThanOrEqual(0.4)
        }
    })

    it('TC-F01V-TD.04 — same seed reproduces same preset (determinism)', () => {
        const seed = hashBusinessName('Test Business')
        expect(pickCategoryTheme('beauty', seed).name).toBe(
            pickCategoryTheme('beauty', seed).name,
        )
    })
})

describe('font pairings — Phase 02 dedupe (R6 fix)', () => {
    it('TC-F01V-TD.05 — 6 new unique pair IDs exist', () => {
        const newIds = [
            'magazine-cover',
            'boutique-serif',
            'warm-editorial',
            'contemporary',
            'classical',
            'hospitality',
        ]
        for (const id of newIds) {
            const pair = __FONT_PAIRINGS_FOR_TEST[id]
            expect(pair, `new pair ${id} must exist`).toBeDefined()
        }
    })

    it('TC-F01V-TD.06 — ≥14 unique (heading, body) tuples across all ids', () => {
        const tuples = new Set<string>()
        for (const [id, pair] of Object.entries(__FONT_PAIRINGS_FOR_TEST)) {
            void id
            tuples.add(`${pair.fontHeading}|${pair.fontBody}`)
        }
        expect(tuples.size).toBeGreaterThanOrEqual(14)
    })

    it('TC-F01V-TD.07 — each category has ≥3 unique font pairs across its 8 presets', () => {
        for (const [cat, presets] of Object.entries(CATEGORY_PRESETS)) {
            const tuples = new Set<string>()
            for (const p of presets) {
                const pair = resolveFontPairing(p.fontPairingId)
                tuples.add(`${pair.fontHeading}|${pair.fontBody}`)
            }
            expect(tuples.size, `${cat} unique font pairs`).toBeGreaterThanOrEqual(3)
        }
    })
})
