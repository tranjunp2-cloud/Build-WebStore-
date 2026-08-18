/**
 * TC-F01-LU-01 — logAiUsage cost estimation
 * Source: plans/260414-0914-ai-model-optimization/phase-05-gateway-observability.md
 */

import { describe, expect, it } from 'vitest'
import { estimateCostUsd } from '@/lib/ai/log-usage'

describe('estimateCostUsd', () => {
    it('computes gpt-4o cost from pricing table', () => {
        // $2.50 per 1M input, $10 per 1M output
        // 1000 in + 500 out = 0.0025 + 0.005 = 0.0075
        const cost = estimateCostUsd('gpt-4o', 1000, 500)
        expect(cost).toBeCloseTo(0.0075, 6)
    })

    it('computes gpt-4.1-mini cost (primary post-phase-03a)', () => {
        // $0.40 per 1M input, $1.60 per 1M output
        // 4000 in + 8000 out = 0.0016 + 0.0128 = 0.0144
        const cost = estimateCostUsd('gpt-4.1-mini', 4000, 8000)
        expect(cost).toBeCloseTo(0.0144, 6)
    })

    it('computes gpt-4.1-nano cost (cheapest tier)', () => {
        // $0.05 per 1M input, $0.20 per 1M output
        // 2000 in + 1000 out = 0.0001 + 0.0002 = 0.0003
        const cost = estimateCostUsd('gpt-4.1-nano', 2000, 1000)
        expect(cost).toBeCloseTo(0.0003, 6)
    })

    it('strips date suffix from model name (gpt-4.1-mini-2025-04-14)', () => {
        const cost = estimateCostUsd('gpt-4.1-mini-2025-04-14', 1000, 1000)
        expect(cost).toBeCloseTo(0.002, 6) // 0.0004 + 0.0016
    })

    it('returns 0 for unknown model', () => {
        expect(estimateCostUsd('totally-fake-model', 1000, 1000)).toBe(0)
    })

    it('returns 0 for empty model string', () => {
        expect(estimateCostUsd('', 1000, 1000)).toBe(0)
    })

    it('handles zero tokens gracefully', () => {
        expect(estimateCostUsd('gpt-4o', 0, 0)).toBe(0)
    })

    it('phase-03a savings proof: 4.1-mini vs 4o on same workload', () => {
        const workload4o = estimateCostUsd('gpt-4o', 4000, 8000)
        const workload41 = estimateCostUsd('gpt-4.1-mini', 4000, 8000)
        // Expect ~6.25x cheaper
        const ratio = workload4o / workload41
        expect(ratio).toBeGreaterThan(6)
        expect(ratio).toBeLessThan(7)
    })
})
