/**
 * TC-F01V-SR — Seeded random helpers
 * Source: plans/260414-2253-ai-gen-variety-root-cause/phase-01-variant-pool-randomization.md
 *
 * Verifies deterministic variety primitives used across the AI gen pipeline
 * for Phase 01 variant pool randomization (R2, R9).
 */

import { describe, expect, it } from 'vitest'
import {
    createSeededRandom,
    hashString,
    seededShuffle,
    seededPick,
    seededShufflePick,
} from '@/lib/ai/seeded-random'

describe('createSeededRandom', () => {
    it('TC-F01V-SR.01 — same seed produces identical sequence', () => {
        const a = createSeededRandom(42)
        const b = createSeededRandom(42)
        const seqA = [a(), a(), a(), a()]
        const seqB = [b(), b(), b(), b()]
        expect(seqA).toEqual(seqB)
    })

    it('TC-F01V-SR.02 — different seeds produce different sequences', () => {
        const a = createSeededRandom(1)
        const b = createSeededRandom(2)
        expect(a()).not.toBe(b())
    })

    it('TC-F01V-SR.03 — output range is [0, 1)', () => {
        const rand = createSeededRandom(123)
        for (let i = 0; i < 100; i++) {
            const v = rand()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })
})

describe('hashString', () => {
    it('TC-F01V-SR.04 — deterministic across calls', () => {
        expect(hashString('Bo Bo Spa')).toBe(hashString('Bo Bo Spa'))
        expect(hashString('Farah Glow')).toBe(hashString('Farah Glow'))
    })

    it('TC-F01V-SR.05 — case-insensitive', () => {
        expect(hashString('TEST')).toBe(hashString('test'))
        expect(hashString('Beauty')).toBe(hashString('beauty'))
    })

    it('TC-F01V-SR.06 — empty input returns stable value', () => {
        expect(hashString('')).toBe(hashString(''))
    })

    it('TC-F01V-SR.07 — different inputs likely produce different hashes', () => {
        const hashes = new Set([
            hashString('Farah Glow Spa'),
            hashString('Priya Nails'),
            hashString('Zen Hair Studio'),
            hashString('Bloom Beauty'),
            hashString('Rose Petal Salon'),
        ])
        // 5 distinct strings should produce 5 distinct hashes
        expect(hashes.size).toBe(5)
    })
})

describe('seededShuffle', () => {
    it('TC-F01V-SR.08 — returns new array with same length', () => {
        const input = ['a', 'b', 'c', 'd', 'e']
        const shuffled = seededShuffle(input, 42)
        expect(shuffled).toHaveLength(input.length)
        expect(shuffled).not.toBe(input)
        // Same elements present
        expect([...shuffled].sort()).toEqual([...input].sort())
    })

    it('TC-F01V-SR.09 — deterministic for same seed', () => {
        const input = ['a', 'b', 'c', 'd']
        expect(seededShuffle(input, 7)).toEqual(seededShuffle(input, 7))
    })

    it('TC-F01V-SR.10 — distributes entries across pool for varied seeds', () => {
        const input = ['A', 'B', 'C', 'D', 'E']
        const firstPicks = new Set<string>()
        for (let seed = 1; seed <= 30; seed++) {
            firstPicks.add(seededShuffle(input, seed)[0]!)
        }
        // Over 30 seeds with 5 options, expect to see ≥3 distinct first picks
        // (entropy check — fail if hash is biased toward single index)
        expect(firstPicks.size).toBeGreaterThanOrEqual(3)
    })

    it('TC-F01V-SR.11 — empty array returns empty copy', () => {
        expect(seededShuffle([], 42)).toEqual([])
    })
})

describe('seededPick / seededShufflePick', () => {
    it('TC-F01V-SR.12 — seededPick returns undefined for empty array', () => {
        expect(seededPick([], 42)).toBeUndefined()
        expect(seededShufflePick([], 42)).toBeUndefined()
    })

    it('TC-F01V-SR.13 — seededPick returns deterministic result', () => {
        const arr = ['red', 'green', 'blue']
        expect(seededPick(arr, 100)).toBe(seededPick(arr, 100))
    })

    it('TC-F01V-SR.14 — seededShufflePick distributes across pool', () => {
        const arr = ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen']
        const picks = new Set<string>()
        for (let seed = 1; seed <= 30; seed++) {
            picks.add(seededShufflePick(arr, seed)!)
        }
        // 30 seeds × 5 variants → expect ≥3 distinct picks (no single-variant collapse)
        expect(picks.size).toBeGreaterThanOrEqual(3)
    })

    it('TC-F01V-SR.15 — no variant exceeds 50% share across 30 seeds', () => {
        const arr = ['A', 'B', 'C', 'D', 'E']
        const counts = new Map<string, number>()
        for (let seed = 1; seed <= 30; seed++) {
            const pick = seededShufflePick(arr, seed)!
            counts.set(pick, (counts.get(pick) ?? 0) + 1)
        }
        const maxShare = Math.max(...counts.values()) / 30
        // Distribution entropy check — R2 fix target: no variant >35%
        // Relaxed to 50% for unit test (production target measured by Phase 04 harness)
        expect(maxShare).toBeLessThanOrEqual(0.5)
    })
})
