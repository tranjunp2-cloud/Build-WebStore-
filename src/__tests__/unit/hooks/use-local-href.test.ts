import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLocalHref } from '@/lib/hooks/use-local-href'
import { BROKEN_URL_PREFIX } from '@/lib/navigation-url'

// ── Mocks — must be at top, before all imports ─────────────────────────────

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(),
}))

// ── Imports — after mocks ──────────────────────────────────────────────────

import { usePathname } from 'next/navigation'

const mockUsePathname = vi.mocked(usePathname)

// ─────────────────────────────────────────────────────────────────────────────
// TC-F05-1278 — useLocalHref hook test suite
// GH issue #1278: storefront logo redirect fix (mailto: and tel: passthrough)
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-F05-1278] useLocalHref hook', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ───────────────────────────────────────────────────────────────────────
    // Group 1: non-local context (pathname = '/shop')
    // ───────────────────────────────────────────────────────────────────────

    describe('[TC-F05-1278] non-local context (pathname = "/shop")', () => {
        beforeEach(() => {
            mockUsePathname.mockReturnValue('/shop')
        })

        it('[TC-F05-1278-01] https:// passes through unchanged', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = 'https://external.example.com/page'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('https://external.example.com/page')
        })

        it('[TC-F05-1278-02] undefined → "#"', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())

            // Act
            const resolved = result.current(undefined)

            // Assert
            expect(resolved).toBe('#')
        })

        it('[TC-F05-1278-02b] empty string → "#"', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())

            // Act
            const resolved = result.current('')

            // Assert
            expect(resolved).toBe('#')
        })

        it('[TC-F05-1278-03] /about passes through unchanged (not local)', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/about'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/about')
        })
    })

    // ───────────────────────────────────────────────────────────────────────
    // Group 2: local dev context (pathname = '/sites/mystore/home')
    // ───────────────────────────────────────────────────────────────────────

    describe('[TC-F05-1278] local dev context (pathname = "/sites/mystore/home")', () => {
        beforeEach(() => {
            mockUsePathname.mockReturnValue('/sites/mystore/home')
        })

        it('[TC-F05-1278-04] /about → /sites/mystore/about', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/about'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/sites/mystore/about')
        })

        it('[TC-F05-1278-05] /services/consulting → /sites/mystore/services/consulting', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/services/consulting'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/sites/mystore/services/consulting')
        })

        it('[TC-F05-1278-06] bare relative "about" (no slash) → /sites/mystore/about', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = 'about'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/sites/mystore/about')
        })

        it('[TC-F05-1278-07] https://external.com passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = 'https://external.com/page'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('https://external.com/page')
        })

        it('[TC-F05-1278-08] //cdn.example.com passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '//cdn.example.com/image.jpg'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('//cdn.example.com/image.jpg')
        })

        it('[TC-F05-1278-09] #section passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '#section'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('#section')
        })

        it('[TC-F05-1278-10] mailto:contact@example.com passes through (CRITICAL BUG FIX)', () => {
            // Arrange — This is the critical bug fix from GH issue #1278
            const { result } = renderHook(() => useLocalHref())
            const href = 'mailto:contact@example.com'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('mailto:contact@example.com')
        })

        it('[TC-F05-1278-11] tel:+1234567890 passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = 'tel:+1234567890'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('tel:+1234567890')
        })

        it('[TC-F05-1278-12] /preview/abc123 passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/preview/abc123'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/preview/abc123')
        })

        it('[TC-F05-1278-13] /sites/already-prefixed passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/sites/another-store/page'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/sites/another-store/page')
        })

        it('[TC-F05-1278-14] BROKEN_URL_PREFIX + "/test" passes through', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = `${BROKEN_URL_PREFIX}/test`

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe(`${BROKEN_URL_PREFIX}/test`)
        })

        it('[TC-F05-1278-15] undefined → "#"', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())

            // Act
            const resolved = result.current(undefined)

            // Assert
            expect(resolved).toBe('#')
        })

        it('[TC-F05-1278-16] empty string → "#"', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())

            // Act
            const resolved = result.current('')

            // Assert
            expect(resolved).toBe('#')
        })
    })

    // ───────────────────────────────────────────────────────────────────────
    // Group 3: null pathname (SSR/test environment)
    // ───────────────────────────────────────────────────────────────────────

    describe('[TC-F05-1278] null pathname (SSR/test environment)', () => {
        beforeEach(() => {
            mockUsePathname.mockReturnValue(null)
        })

        it('[TC-F05-1278-17] /about passes through (branch 1, non-local)', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())
            const href = '/about'

            // Act
            const resolved = result.current(href)

            // Assert
            expect(resolved).toBe('/about')
        })

        it('[TC-F05-1278-18] undefined → "#"', () => {
            // Arrange
            const { result } = renderHook(() => useLocalHref())

            // Act
            const resolved = result.current(undefined)

            // Assert
            expect(resolved).toBe('#')
        })
    })
})
