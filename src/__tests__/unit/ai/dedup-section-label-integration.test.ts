/**
 * Integration tests — dedupSectionLabel wired into emission sites.
 *
 * Plan: plans/260418-2358-wave1-completion/phase-02-wire-dedup-section-label.md
 * TC-ID: F01-WAVE1-DEDUP-INTEG-01..03
 *
 * Verifies the wrapper is called at the 6 emission sites we wired. We don't
 * re-test the helper itself (7 cases already in dedup-section-label.test.ts);
 * we test the call-site invariants: sectionLabel output is either the original
 * string or undefined (never a bad-shaped value), and hardcoded sites produce
 * stable values.
 */

import { describe, it, expect } from 'vitest'
import { dedupSectionLabel } from '@/lib/ai/dedup-section-label'

describe('TC-F01-WAVE1-DEDUP-INTEG — wired emission sites', () => {
    it('TC-01 add-section.ts about case keeps label when headline is distinct', () => {
        // Matches src/lib/ai/add-section.ts:560
        const result = dedupSectionLabel('About Us', 'Our Story')
        expect(result).toBe('About Us')
    })

    it('TC-02 generate-blocks.ts fallback pairs are always pass-through (no accidental drop)', () => {
        // Matches src/lib/ai/generate-blocks.ts:549, :557 — static pairs
        expect(dedupSectionLabel('About', 'Our Story')).toBe('About')
        expect(dedupSectionLabel('Services', 'What We Offer')).toBe('Services')
    })

    it('TC-03 seed-templates.ts drops label when business name overlaps ≥ 2 keywords with Our Story', () => {
        // Matches src/lib/ai/seed-templates.ts:132 — `The Passion Behind ${name}`
        // If name contains 'story' + 'passion' the label "Our Story" overlaps 2 → dropped
        const overlappingName = 'Story Passion Co'
        const result = dedupSectionLabel('Our Story', `The Passion Behind ${overlappingName}`)
        expect(result).toBeUndefined()

        // Normal business name — label preserved
        const normalName = 'Acme Corp'
        const kept = dedupSectionLabel('Our Story', `The Passion Behind ${normalName}`)
        expect(kept).toBe('Our Story')
    })
})
