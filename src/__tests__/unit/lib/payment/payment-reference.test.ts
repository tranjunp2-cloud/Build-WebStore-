import { describe, it, expect } from 'vitest'
import { generateCandidate } from '@/lib/payment/reference'

// TC-F10-02-01 — Payment reference generator
describe('generateCandidate [TC-F10-02-01]', () => {
    it('returns a string matching /^BT-[A-Z2-9]{6}$/', () => {
        const ref = generateCandidate()
        expect(ref).toMatch(/^BT-[A-Z2-9]{6}$/)
    })

    it('does not contain ambiguous characters (0, O, I, 1)', () => {
        // Run 100x to cover random space adequately
        for (let i = 0; i < 100; i++) {
            const ref = generateCandidate()
            expect(ref).not.toMatch(/[0OI1]/)
        }
    })

    it('produces different values across multiple calls (probabilistic, 50 samples)', () => {
        const refs = new Set<string>()
        for (let i = 0; i < 50; i++) {
            refs.add(generateCandidate())
        }
        // With alphabet size 32 and 6 chars → 32^6 ≈ 10^9 combos.
        // Probability of all 50 being identical is astronomically low.
        expect(refs.size).toBeGreaterThan(1)
    })

    it('always has prefix BT- and 6-character suffix', () => {
        for (let i = 0; i < 20; i++) {
            const ref = generateCandidate()
            expect(ref.startsWith('BT-')).toBe(true)
            expect(ref.length).toBe(9) // 'BT-' (3) + 6 chars
        }
    })
})
