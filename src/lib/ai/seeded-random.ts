/**
 * Seeded pseudo-random helpers — deterministic variety primitives shared
 * across the AI gen pipeline (variant picking, theme selection, content
 * rotation). Same seed always yields same output so regenerating the same
 * business produces a stable site, while different seeds distribute evenly.
 *
 * Plan: 260414-2253-ai-gen-variety-root-cause phase-01
 */

/** LCG PRNG (Numerical Recipes constants). Returns [0, 1). */
export function createSeededRandom(seed?: number): () => number {
    let s = (seed ?? Date.now()) | 0
    return () => {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return (s >>> 0) / 0xFFFFFFFF
    }
}

/** djb2 32-bit hash — stable across runtimes, no crypto dep. */
export function hashString(input: string): number {
    let hash = 5381
    const str = (input || '').trim().toLowerCase()
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

/** Fisher-Yates shuffle with seeded RNG. Non-mutating. */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
    const copy = [...arr]
    const rand = createSeededRandom(seed)
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
}

/** Pick 1 item deterministically by seed. Returns undefined for empty input. */
export function seededPick<T>(arr: readonly T[], seed: number): T | undefined {
    if (arr.length === 0) return undefined
    const idx = Math.abs(Math.floor(seed)) % arr.length
    return arr[idx]
}

/**
 * Pick 1 item from a shuffled copy (equivalent to `seededShuffle(arr, seed)[0]`
 * but slightly more efficient). Useful when you want better distribution than
 * pure modulo on biased djb2 hashes.
 */
export function seededShufflePick<T>(arr: readonly T[], seed: number): T | undefined {
    if (arr.length === 0) return undefined
    return seededShuffle(arr, seed)[0]
}
