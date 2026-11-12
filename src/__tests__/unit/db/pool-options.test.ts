/**
 * TC-AISEC-010 — Payload's pg pool limits come from env: DATABASE_POOL_MAX (default 25, clamped 1..50) and
 * DATABASE_POOL_CONNECT_TIMEOUT_MS, idle connections close after 10 s.
 * TC-PERF-013 — the connect (acquire) timeout defaults to 10 s (a suspended Neon compute must be able to wake);
 * production sets 3 s through the env, which still wins.
 * Real: payloadPoolLimits. Faked: nothing.
 */
import { describe, expect, it } from 'vitest'

import { payloadPoolLimits } from '@/lib/db/pool-options'

describe('Payload pool limits [TC-AISEC-010] [TC-PERF-013]', () => {
    it('keeps 25 connections, a 3 s connect timeout and a 10 s idle timeout when nothing is set', () => {
        const limits = payloadPoolLimits({})

        expect(limits).toEqual({ max: 25, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 })
    })

    it('still lets DATABASE_POOL_CONNECT_TIMEOUT_MS set a longer wait', () => {
        expect(payloadPoolLimits({ connectTimeoutMs: '3000' }).connectionTimeoutMillis).toBe(3_000)
    })

    it('takes the pool size and connect timeout from env (the -pooler setup: 10)', () => {
        const limits = payloadPoolLimits({ max: '10', connectTimeoutMs: '5000' })

        expect(limits).toMatchObject({ max: 10, connectionTimeoutMillis: 5000 })
    })

    it.each([
        ['above the limit', '500', 50],
        ['the lowest allowed', '1', 1],
        ['a fraction', '7.9', 7],
    ])('clamps a pool size %s', (_label, raw, expected) => {
        expect(payloadPoolLimits({ max: raw }).max).toBe(expected)
    })

    it.each(['', '  ', 'ten', '0', '-3'])('falls back to the defaults on junk (%j)', (raw) => {
        const limits = payloadPoolLimits({ max: raw, connectTimeoutMs: raw })

        expect(limits).toMatchObject({ max: 25, connectionTimeoutMillis: 10_000 })
    })
})
