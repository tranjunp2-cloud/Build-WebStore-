/**
 * TC-F01V-SK — Skeleton diversity (R1 fix — plan 2253 follow-up)
 * Source: branch feat/F01-ai-gen-skeleton-variants
 *
 * Verifies enforceMinimumStructure rotates through the 3 category recipes
 * per business seed so same-category businesses no longer collapse to a
 * single fixed block sequence.
 */

import { describe, expect, it } from 'vitest'
import { enforceMinimumStructure } from '@/lib/ai/structure-enforcer'
import { hashBusinessName } from '@/lib/ai/category-theme-picker'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'

// #2103 A1: stats / pricing / logo-cloud / FAQ blocks are only injected when the merchant's FACTS can
// fill them, so the recipe-driven skeleton variety is exercised with a shop that told us enough.
const RICH_FACTS = buildGenerationFacts({
    businessInfo: {
        businessName: 'Rich Shop',
        products: 'Alpha RM10, Beta RM20, Gamma RM30',
        phone: '012-3456789',
        buyingMethods: ['delivery', 'pickup'],
        shopFacts: 'Started in 2015',
    },
    tenant: { payments: { payment_fpx: true, payment_cod: true } },
})
const richCtx = (seed: number) => ({ seed, userBiz: { name: 'Rich Shop', facts: RICH_FACTS } })

const TEST_NAMES = [
    'Farah Glow Spa', 'Priya Nails', 'Zen Hair', 'Bloom Beauty',
    'Rose Petal', 'Lotus Massage', 'Glam Studio', 'Bella Skin',
    'Orchid Wellness', 'Jade Beauty', 'Velvet Lash', 'Mint Nail',
]

const CATEGORIES = ['beauty', 'restaurant', 'tech', 'realestate', 'fitness'] as const

describe('skeleton diversity — R1 recipe-based enforcement', () => {
    it('TC-F01V-SK.01 — 12 seeds per category produce ≥2 distinct skeletons', () => {
        for (const cat of CATEGORIES) {
            const skeletons = new Set<string>()
            for (const name of TEST_NAMES) {
                const seed = hashBusinessName(name)
                const result = enforceMinimumStructure([], cat, richCtx(seed))
                const seq = result.map((b) => String(b.blockType)).join('→')
                skeletons.add(seq)
            }
            expect(skeletons.size, `${cat} distinct skeletons`).toBeGreaterThanOrEqual(2)
        }
    })

    it('TC-F01V-SK.02 — same seed reproduces same skeleton (determinism)', () => {
        const seed = hashBusinessName('Deterministic Spa')
        const a = enforceMinimumStructure([], 'beauty', { seed })
        const b = enforceMinimumStructure([], 'beauty', { seed })
        expect(a.map((x) => x.blockType)).toEqual(b.map((x) => x.blockType))
    })

    it('TC-F01V-SK.03 — navigation always at index 0 across all recipes', () => {
        for (const cat of CATEGORIES) {
            for (const name of TEST_NAMES.slice(0, 6)) {
                const seed = hashBusinessName(name)
                const result = enforceMinimumStructure([], cat, { seed })
                expect(result[0]?.blockType, `${cat} ${name}`).toBe('navigation')
            }
        }
    })

    it('TC-F01V-SK.04 — footer always at last index across all recipes', () => {
        for (const cat of CATEGORIES) {
            for (const name of TEST_NAMES.slice(0, 6)) {
                const seed = hashBusinessName(name)
                const result = enforceMinimumStructure([], cat, { seed })
                expect(result[result.length - 1]?.blockType, `${cat} ${name}`).toBe('footer')
            }
        }
    })

    it('TC-F01V-SK.05 — no skeleton dominates >75% of 12 same-category gens', () => {
        // Note: 12 seeds × 3 recipes has natural small-sample variance.
        // Perfect uniform distribution → ~4/4/4 (33% max). Relaxed to 75%
        // to accept realistic djb2 + Fisher-Yates variance. Baseline pre-R1
        // would be 100% (always same mandatoryBlocks sequence).
        for (const cat of CATEGORIES) {
            const counts = new Map<string, number>()
            for (const name of TEST_NAMES) {
                const seed = hashBusinessName(name)
                const result = enforceMinimumStructure([], cat, richCtx(seed))
                const seq = result.map((b) => String(b.blockType)).join('→')
                counts.set(seq, (counts.get(seq) ?? 0) + 1)
            }
            const maxShare = Math.max(...counts.values()) / TEST_NAMES.length
            expect(maxShare, `${cat} dominant skeleton share`).toBeLessThanOrEqual(0.75)
        }
    })
})
