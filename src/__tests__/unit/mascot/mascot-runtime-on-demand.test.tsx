import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import React from 'react'

// The heavy runtime (three + R3F + GLB). The test only cares whether the provider imports it.
const runtimeLoaded = vi.fn()
vi.mock('@/mascot/r3f/MascotRenderer', () => {
    runtimeLoaded()
    class MascotStore {
        register = vi.fn((o: { def: unknown; size: number }) => ({ id: 1, size: o.size, state: { def: o.def } }))
        unregister = vi.fn()
        setDef = vi.fn()
        resize = vi.fn()
        setFps = vi.fn()
    }
    return { MascotStore, MascotCanvas: () => null }
})

import { MascotProvider, Mascot, MascotAvatar } from '@/mascot'
import { MascotStore } from '@/mascot/r3f/store'

// IntersectionObserver stand-in: tests decide when an element comes into view
let observers: { cb: IntersectionObserverCallback; els: Element[] }[] = []
class FakeIO {
    constructor(public cb: IntersectionObserverCallback) { observers.push({ cb, els: [] }) }
    observe(el: Element) { observers.find((o) => o.cb === this.cb)!.els.push(el) }
    unobserve() {}
    disconnect() { observers = observers.filter((o) => o.cb !== this.cb) }
}
function scrollIntoView() {
    for (const o of [...observers]) {
        o.cb(o.els.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry), {} as IntersectionObserver)
    }
}
async function idle() {
    await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => { await vi.dynamicImportSettled() })
}

beforeEach(() => {
    vi.useFakeTimers()
    observers = []
    runtimeLoaded.mockClear()
    vi.stubGlobal('IntersectionObserver', FakeIO)
    // jsdom has no WebGL: pretend the device can render 3D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

// ── TC-MASCOT-01 — no robot, no download ────────────────────────────────────
describe('[TC-MASCOT-01] provider without a mascot', () => {
    it('never imports the 3D runtime', async () => {
        render(<MascotProvider><p>dashboard</p></MascotProvider>)
        await idle()
        expect(runtimeLoaded).not.toHaveBeenCalled()
    })
})

// ── TC-MASCOT-02 — load only once a robot is on screen ──────────────────────
describe('[TC-MASCOT-02] mascot outside the viewport', () => {
    it('imports the runtime only after the mascot intersects', async () => {
        render(<MascotProvider><Mascot scene="welcome" size={120} /></MascotProvider>)
        await idle()
        expect(runtimeLoaded).not.toHaveBeenCalled()

        act(() => scrollIntoView())
        await idle()
        expect(runtimeLoaded).toHaveBeenCalledTimes(1)
    })
})

// ── TC-MASCOT-03 — toasts never trigger the download ────────────────────────
describe('[TC-MASCOT-03] passive avatar (toast icon)', () => {
    it('keeps its fallback and does not import the runtime even when visible', async () => {
        const { getByTestId } = render(
            <MascotProvider>
                <MascotAvatar state="success" size={20} passive fallback={<svg data-testid="check" />} />
            </MascotProvider>,
        )
        act(() => scrollIntoView())
        await idle()
        expect(runtimeLoaded).not.toHaveBeenCalled()
        expect(getByTestId('check')).toBeInTheDocument()
    })
})

// ── TC-MASCOT-05 — the render loop sleeps with no robot on screen ───────────
describe('[TC-MASCOT-05] MascotStore.renderAll', () => {
    it('asks for no further frame when no mascot is registered', () => {
        const gl = { domElement: { width: 1024, height: 1024 }, setScissorTest: vi.fn(), setClearColor: vi.fn(), autoClear: true }
        expect(new MascotStore().renderAll(gl as never)).toBe(false)
    })
})
