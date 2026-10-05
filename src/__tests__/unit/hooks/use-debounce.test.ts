// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

// ─── useDebounce [TC-F14.24] ────────────────────────────────────────────────

describe('useDebounce — 300ms delay [TC-F14.24]', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('[TC-F14.24] value does not update before 300ms', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'Selangor' } }
        )
        rerender({ value: 'Sabah' })
        act(() => { vi.advanceTimersByTime(299) })
        expect(result.current).toBe('Selangor')
    })

    it('[TC-F14.24] value updates after 300ms', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'Selangor' } }
        )
        rerender({ value: 'Sabah' })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('Sabah')
    })

    it('[TC-F14.24] 5 rapid changes → only last value emitted after debounce', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'Selangor' } }
        )
        const states = ['KL', 'Johor', 'Perak', 'Sarawak', 'Sabah']
        states.forEach(s => {
            rerender({ value: s })
            vi.advanceTimersByTime(50) // 50ms per change; Sabah's 300ms timer has only 50ms consumed when loop ends
        })
        expect(result.current).toBe('Selangor')
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('Sabah')
    })
})
