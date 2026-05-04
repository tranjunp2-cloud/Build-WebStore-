/**
 * Smoke Test: TEMPLATE_PRESETS batch2 (creative) + batch3 (events + others)
 *
 * TC-TF-019 — creative presets compose without error (GH-767 regression guard)
 * TC-TF-020 — events presets compose without error (GH-767 regression guard)
 * TC-TF-021 — all TEMPLATE_PRESETS page slugs unique per preset
 *
 * GH-767 root causes fixed:
 *   1. class-schedule in events/education blueprints → added to unsupported list (949f0115)
 *   2. slug canonicalization in route.ts Set-based detection caused duplicate page slugs
 *      e.g. Services page with contact CTA → slug 'contact', real Contact page → also 'contact'
 *      → fixed to title-first + first-content-block-only detection (0934985a)
 *
 * This test verifies the composer output (before route.ts slug canonicalization).
 * The page slugs tested here are blueprint-level slugs, not canonicalized slugs.
 * They should be unique at the blueprint level for clean generation.
 */

import { describe, it, expect } from 'vitest'
import { TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'
import { composeFromBlueprint } from '@/lib/ai/template-composer'
import { blockRegistry } from '@/blocks/registry'
import { isUnsupportedBlock } from '@/lib/ai/unsupported-blocks'

// Minimal biz override to keep tests deterministic
const TEST_BIZ = {
    name: 'Test Business',
    tagline: 'Test tagline',
    email: 'test@test.com',
    phone: '+60123456789',
    address: '123 Test St',
}

// --- TC-TF-019: creative presets ---

describe('TC-TF-019 — creative TEMPLATE_PRESETS compose without error', () => {
    const creativePresets = TEMPLATE_PRESETS.filter(p => p.category === 'creative')

    it('has at least 4 creative presets', () => {
        expect(creativePresets.length).toBeGreaterThanOrEqual(4)
    })

    for (const preset of creativePresets) {
        const label = `creative preset[${preset.businessIndex}]`

        it(`${label} — composeFromBlueprint returns non-null`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            expect(seed).not.toBeNull()
        })

        it(`${label} — pages array non-empty`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            expect(seed?.pages.length).toBeGreaterThan(0)
        })

        it(`${label} — homepage blocks contain no unsupported block types (post-filter expected)`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            const homepage = seed?.pages[0]
            const unsupportedInOutput = (homepage?.layout ?? []).filter(
                b => isUnsupportedBlock((b as Record<string, unknown>).blockType as string ?? '')
            )
            // After filterUnsupportedBlocks runs in route, these would be dropped.
            // Here we just document what remains in raw composer output.
            // The important thing is no REGISTERED blocks are accidentally in the unsupported list.
            const registeredButUnsupported = unsupportedInOutput.filter(
                b => blockRegistry.has((b as Record<string, unknown>).blockType as string ?? '')
            )
            expect(registeredButUnsupported).toEqual([])
        })

        it(`${label} — page slugs unique within preset`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            const slugs = (seed?.pages ?? []).map(p => p.slug).filter(Boolean)
            const uniqueSlugs = new Set(slugs)
            expect(uniqueSlugs.size).toBe(slugs.length)
        })
    }
})

// --- TC-TF-020: events presets ---

describe('TC-TF-020 — events TEMPLATE_PRESETS compose without error', () => {
    const eventsPresets = TEMPLATE_PRESETS.filter(p => p.category === 'events')

    it('has at least 4 events presets', () => {
        expect(eventsPresets.length).toBeGreaterThanOrEqual(4)
    })

    for (const preset of eventsPresets) {
        const label = `events preset[${preset.businessIndex}]`

        it(`${label} — composeFromBlueprint returns non-null`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            expect(seed).not.toBeNull()
        })

        it(`${label} — pages array non-empty`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            expect(seed?.pages.length).toBeGreaterThan(0)
        })

        it(`${label} — page slugs unique within preset`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            const slugs = (seed?.pages ?? []).map(p => p.slug).filter(Boolean)
            const uniqueSlugs = new Set(slugs)
            expect(uniqueSlugs.size).toBe(slugs.length)
        })
    }
})

// --- TC-TF-021: all TEMPLATE_PRESETS — slug uniqueness ---

describe('TC-TF-021 — ALL TEMPLATE_PRESETS page slugs unique per preset', () => {
    it(`covers ${TEMPLATE_PRESETS.length} presets total`, () => {
        expect(TEMPLATE_PRESETS.length).toBeGreaterThan(40)
    })

    for (const preset of TEMPLATE_PRESETS) {
        const label = `[${preset.category}/${preset.businessIndex}]`

        it(`${label} — page slugs unique`, () => {
            const seed = composeFromBlueprint(preset, 42, TEST_BIZ)
            if (!seed) return // null = no content for category, skip
            const slugs = seed.pages.map(p => p.slug).filter(Boolean)
            const uniqueSlugs = new Set(slugs)
            expect(uniqueSlugs.size).toBe(slugs.length)
        })
    }
})
