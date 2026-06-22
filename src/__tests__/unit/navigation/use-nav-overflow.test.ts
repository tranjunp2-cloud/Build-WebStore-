import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavOverflow } from '@/blocks/navigation/use-nav-overflow'
import type { NavLink } from '@/blocks/navigation/config'

// Mock ResizeObserver globally
const observeMock = vi.fn()
const disconnectMock = vi.fn()
let resizeCallback: ResizeObserverCallback

beforeEach(() => {
    observeMock.mockReset()
    disconnectMock.mockReset()
    global.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
        resizeCallback = cb
        return { observe: observeMock, disconnect: disconnectMock }
    })
    // Make requestAnimationFrame synchronous so measure() runs inside act()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(performance.now()); return 0 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLinks(n: number): NavLink[] {
    return Array.from({ length: n }, (_, i) => ({ label: `Link ${i}`, url: `/${i}` }))
}

function makeEl(offsetWidth: number): HTMLElement {
    const el = document.createElement('a')
    Object.defineProperty(el, 'offsetWidth', { value: offsetWidth, configurable: true })
    return el
}

function makeContainer(clientWidth: number): HTMLDivElement {
    const div = document.createElement('div')
    Object.defineProperty(div, 'clientWidth', { value: clientWidth, configurable: true })
    return div
}

function triggerMeasure() {
    act(() => { resizeCallback([], null as unknown as ResizeObserver) })
}

// ── TC-NAV-OVERFLOW-01: All items fit ────────────────────────────────────────

describe('useNavOverflow', () => {
    // TC-NAV-OVERFLOW-01
    it('TC-NAV-OVERFLOW-01: returns all links visible when container is wide enough', () => {
        const links = makeLinks(3)
        const { result } = renderHook(() => useNavOverflow(links))

        // 600px container, 80px items → total 248px well within budget
        result.current.containerRef.current = makeContainer(600)
        links.forEach((_, i) => { result.current.itemRefs[i] = makeEl(80) })

        triggerMeasure()

        expect(result.current.visibleCount).toBe(3)
    })

    // TC-NAV-OVERFLOW-02
    it('TC-NAV-OVERFLOW-02: returns reduced visibleCount when items overflow container', () => {
        const links = makeLinks(3)
        const { result } = renderHook(() => useNavOverflow(links))

        // 200px container: items don't all fit (248 > 200), so overflow loop runs.
        // Item 0: 0+80+88=168 ≤ 200 ✓. Item 1: 80+84+88=252 > 200 → stop. count=1.
        result.current.containerRef.current = makeContainer(200)
        links.forEach((_, i) => { result.current.itemRefs[i] = makeEl(80) })

        triggerMeasure()

        expect(result.current.visibleCount).toBe(1)
    })

    // TC-NAV-OVERFLOW-03
    it('TC-NAV-OVERFLOW-03: handles empty links array without error', () => {
        const { result } = renderHook(() => useNavOverflow([]))

        expect(result.current.visibleCount).toBe(0)
    })

    // TC-NAV-OVERFLOW-04
    it('TC-NAV-OVERFLOW-04: disconnects ResizeObserver on unmount', () => {
        const { unmount } = renderHook(() => useNavOverflow(makeLinks(3)))

        unmount()

        expect(disconnectMock).toHaveBeenCalledOnce()
    })

    // TC-NAV-OVERFLOW-05
    it('TC-NAV-OVERFLOW-05: budgetOffset correctly reduces measurement budget', () => {
        const links = makeLinks(3)

        // Without budgetOffset: 600px → all 3 fit
        const { result: r1 } = renderHook(() => useNavOverflow(links, 0))
        r1.current.containerRef.current = makeContainer(600)
        links.forEach((_, i) => { r1.current.itemRefs[i] = makeEl(80) })
        act(() => { resizeCallback([], null as unknown as ResizeObserver) })
        expect(r1.current.visibleCount).toBe(3)

        // budgetOffset 400: available = 600-400 = 200 → same threshold as 200px container → 1 visible
        const { result: r2 } = renderHook(() => useNavOverflow(links, 400))
        r2.current.containerRef.current = makeContainer(600)
        links.forEach((_, i) => { r2.current.itemRefs[i] = makeEl(80) })
        act(() => { resizeCallback([], null as unknown as ResizeObserver) })
        expect(r2.current.visibleCount).toBe(1)
    })

    // TC-NAV-OVERFLOW-07
    it('TC-NAV-OVERFLOW-07: shows all links when they collectively fit despite per-item More-reserve', () => {
        // 5×70px on 370px: total=366 fits, but naive per-item More-reserve would show only 3
        const links = makeLinks(5)
        const { result } = renderHook(() => useNavOverflow(links))

        result.current.containerRef.current = makeContainer(370)
        links.forEach((_, i) => { result.current.itemRefs[i] = makeEl(70) })

        triggerMeasure()

        expect(result.current.visibleCount).toBe(5)
    })

    // TC-NAV-OVERFLOW-06
    it('TC-NAV-OVERFLOW-06: updates visibleCount when container resizes', () => {
        const links = makeLinks(3)
        const { result } = renderHook(() => useNavOverflow(links))

        const container = makeContainer(600)
        result.current.containerRef.current = container
        links.forEach((_, i) => { result.current.itemRefs[i] = makeEl(80) })

        // Initial wide state — all 3 visible
        triggerMeasure()
        expect(result.current.visibleCount).toBe(3)

        // Resize to narrow — only 1 visible
        Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true })
        triggerMeasure()
        expect(result.current.visibleCount).toBe(1)
    })
})
