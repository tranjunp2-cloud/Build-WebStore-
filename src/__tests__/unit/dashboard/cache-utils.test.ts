/**
 * Unit Tests — Cache TTL Utility
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.43  → cache set/get within TTL
 *   TC-F03.44  → cache expiry after TTL
 *   TC-F03.45  → cache delete + cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cacheGet, cacheSet, cacheDelete, cacheCleanup } from '@/lib/cache'

describe('TTL Cache Utility [TC-F03.43, TC-F03.44, TC-F03.45]', () => {
    beforeEach(() => {
        // Clean slate — delete known test keys
        cacheDelete('test:key')
        cacheDelete('test:a')
        cacheDelete('test:b')
        cacheDelete('test:expired')
    })

    describe('cacheGet / cacheSet', () => {
        it('[TC-F03.43] returns cached data within TTL', () => {
            // Arrange
            const data = { metrics: { views: 100 } }

            // Act
            cacheSet('test:key', data, 60_000)
            const result = cacheGet<typeof data>('test:key')

            // Assert
            expect(result).toEqual(data)
        })

        it('[TC-F03.43] returns null for unknown key', () => {
            expect(cacheGet('nonexistent:key')).toBeNull()
        })

        it('[TC-F03.44] returns null after TTL expires', () => {
            // Arrange
            vi.useFakeTimers()
            cacheSet('test:expired', { value: 1 }, 1000)

            // Act — advance past TTL
            vi.advanceTimersByTime(1001)
            const result = cacheGet('test:expired')

            // Assert
            expect(result).toBeNull()

            vi.useRealTimers()
        })

        it('[TC-F03.43] overwrites existing key with new data', () => {
            // Arrange
            cacheSet('test:key', 'old')
            cacheSet('test:key', 'new')

            // Assert
            expect(cacheGet('test:key')).toBe('new')
        })

        it('[TC-F03.43] uses default 60s TTL when not specified', () => {
            // Arrange
            vi.useFakeTimers()
            cacheSet('test:key', 'data')

            // Act — 59s should still be valid
            vi.advanceTimersByTime(59_000)
            expect(cacheGet('test:key')).toBe('data')

            // Act — 61s should expire
            vi.advanceTimersByTime(2_000)
            expect(cacheGet('test:key')).toBeNull()

            vi.useRealTimers()
        })
    })

    describe('cacheDelete', () => {
        it('[TC-F03.45] removes cached entry', () => {
            cacheSet('test:key', 'data')
            cacheDelete('test:key')
            expect(cacheGet('test:key')).toBeNull()
        })

        it('[TC-F03.45] no-op for nonexistent key', () => {
            expect(() => cacheDelete('nonexistent')).not.toThrow()
        })
    })

    describe('cacheCleanup', () => {
        it('[TC-F03.45] evicts expired entries, keeps valid ones', () => {
            // Arrange
            vi.useFakeTimers()
            cacheSet('test:a', 'short', 1000)
            cacheSet('test:b', 'long', 60_000)

            // Act — advance past short TTL
            vi.advanceTimersByTime(1500)
            cacheCleanup()

            // Assert
            expect(cacheGet('test:a')).toBeNull()
            expect(cacheGet('test:b')).toBe('long')

            vi.useRealTimers()
        })
    })
})
