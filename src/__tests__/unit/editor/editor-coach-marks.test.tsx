import { useState } from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EditorCoachMarks } from '@/components/editor/editor-coach-marks'
import { I18nProvider } from '@/i18n'
import '@testing-library/jest-dom'

// TC-F05-02-16: EditorCoachMarks behaviour

const STORAGE_KEY = 'editor:coach-marks:v1:seen'

/**
 * Wrapper that provides anchor elements the coach marks query via document.querySelector.
 * Renders both data-coach anchors so step 1 + step 2 can resolve their rects.
 */
function Wrapper({ onEnterStep1 = vi.fn(), onEnterStep2 = vi.fn(), onFinish = vi.fn(), isCompact = false }: { onEnterStep1?: () => void; onEnterStep2?: () => void; onFinish?: () => void; isCompact?: boolean }) {
    return (
        <I18nProvider defaultLocale="en">
            {/* Anchor elements used by EditorCoachMarks */}
            <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />
            <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />
            <EditorCoachMarks mountDelayMs={0} onEnterStep1={onEnterStep1} onEnterStep2={onEnterStep2} onFinish={onFinish} isCompact={isCompact} />
        </I18nProvider>
    )
}

/** Same anchors as Wrapper, but takes onEnterStep1 directly so a test can rerender with a new reference. */
function RerenderableWrapper({ onEnterStep1 }: { onEnterStep1: () => void }) {
    return (
        <I18nProvider defaultLocale="en">
            <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />
            <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />
            <EditorCoachMarks mountDelayMs={0} onEnterStep1={onEnterStep1} onEnterStep2={vi.fn()} />
        </I18nProvider>
    )
}

/** Page library anchor only renders when `anchorPresent` — simulates the compact Tools sheet
 * mounting its panel (and the anchor with it) some time after openTools() is called, instead
 * of it being present synchronously like the other wrappers assume. */
function DelayedAnchorWrapper({ anchorPresent }: { anchorPresent: boolean }) {
    return (
        <I18nProvider defaultLocale="en">
            {anchorPresent && <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />}
            <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />
            <EditorCoachMarks mountDelayMs={0} onEnterStep1={vi.fn()} onEnterStep2={vi.fn()} isCompact />
        </I18nProvider>
    )
}

/** Mirrors production: EditorToolsSheet mounts exactly ONE tab's panel (and its anchor) at a
 * time, swapped via openTools() — unlike Wrapper, which renders both anchors permanently. */
function MutexAnchorWrapper() {
    const [activeAnchor, setActiveAnchor] = useState<'pages' | 'settings'>('pages')
    return (
        <I18nProvider defaultLocale="en">
            {activeAnchor === 'pages' && <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />}
            {activeAnchor === 'settings' && <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />}
            <EditorCoachMarks
                mountDelayMs={0}
                isCompact
                onEnterStep1={() => setActiveAnchor('pages')}
                onEnterStep2={() => setActiveAnchor('settings')}
            />
        </I18nProvider>
    )
}

/** Advance all pending timers through two levels: mountDelay → state update → anchor timer */
async function advanceCoachMarkTimers() {
    // First pass: fires mountDelayMs timer → setStep(1)
    await act(async () => { vi.runAllTimers() })
    // Second pass: fires the anchor-rect setTimeout (50ms for step 1, 150ms for step 2)
    await act(async () => { vi.runAllTimers() })
}

describe('EditorCoachMarks — TC-F05-02-16', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
        // jsdom always returns zero DOMRects; mock non-zero dims so the rect.width guard passes
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 0, left: 0, right: 280, bottom: 600, width: 280, height: 600,
            x: 0, y: 0, toJSON: () => ({}),
        } as DOMRect)
        // jsdom doesn't implement scrollIntoView at all — stub it so the isCompact scroll-into-
        // view call doesn't throw; tests assert positioning math, not actual scroll behavior.
        Element.prototype.scrollIntoView = vi.fn()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('TC-F05-02-16a: renders nothing when localStorage flag already set', async () => {
        // Arrange
        localStorage.setItem(STORAGE_KEY, 'true')

        // Act
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Assert — nothing from coach marks should appear
        expect(screen.queryByText(/Step 1/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Step 2/)).not.toBeInTheDocument()
    })

    it('TC-F05-02-16b: renders step 1 after mountDelayMs when flag absent', async () => {
        // Arrange — no localStorage flag
        // Act
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Assert — step 1 title and body visible; no skip/back at step 1
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
        expect(screen.getByText(/page library/)).toBeInTheDocument()
        expect(screen.queryByText('Skip')).not.toBeInTheDocument()
        expect(screen.queryByText('Back')).not.toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('TC-F05-02-16c: clicking Next calls onEnterStep2 and advances to step 2', async () => {
        // Arrange
        const onEnterStep2 = vi.fn()
        render(<Wrapper onEnterStep2={onEnterStep2} />)
        await advanceCoachMarkTimers()

        // Act
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()

        // Assert
        expect(onEnterStep2).toHaveBeenCalledOnce()
        expect(screen.getByText('Step 2: Manage menu visibility here')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('TC-F05-02-16d: clicking Done writes localStorage flag and unmounts UI', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Go to step 2 first
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()

        // Act — finish
        fireEvent.click(screen.getByText('Done'))

        // Assert — UI gone and flag persisted
        expect(screen.queryByText(/Step /)).not.toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('TC-F05-02-16e: Back button at step 2 navigates back to step 1 and calls onEnterStep1', async () => {
        // Arrange — advance to step 2
        const onEnterStep1 = vi.fn()
        render(<Wrapper onEnterStep1={onEnterStep1} />)
        await advanceCoachMarkTimers()
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()
        expect(screen.getByText('Step 2: Manage menu visibility here')).toBeInTheDocument()
        onEnterStep1.mockClear() // clear calls from mount

        // Act
        fireEvent.click(screen.getByText('Back'))
        await advanceCoachMarkTimers()

        // Assert — callback fired, back at step 1, no Back button, flag NOT written
        expect(onEnterStep1).toHaveBeenCalledOnce()
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
        expect(screen.queryByText('Back')).not.toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('TC-F05-02-16f: ESC key does NOT dismiss coach marks (removed per GH-864)', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()

        // Act
        fireEvent.keyDown(window, { key: 'Escape' })

        // Assert — still visible; ESC no longer closes coach marks
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('TC-F05-02-16g: backdrop area does NOT dismiss coach marks (removed per GH-864)', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()

        // Act — attempt to click any backdrop panel (4-panel approach, no onClick)
        const backdrops = document.querySelectorAll('.fixed[aria-hidden="true"]')
        backdrops.forEach(el => fireEvent.click(el as HTMLElement))

        // Assert — still visible; backdrop click no longer closes coach marks
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
    })

    it('TC-F05-02-16h: Next/Done button pairs text-white with the teal bg on one element (GH-1584)', async () => {
        // globals.css remaps `.editor-shell .text-white` to dark text in light mode
        // and only keeps white for allow-listed backgrounds. The allow-list selector
        // `.bg-[hsl(var(--primary))].text-white` needs BOTH classes on the same
        // element — dropping either one re-introduces dark text on the teal button.
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Word-boundary match: toContain() is substring-based and would stay green
        // for `text-white/90` or `hover:bg-[hsl(var(--primary))]` — variants the CSS
        // allow-list selector does NOT match, so the dark-text bug would silently return.
        const TEXT_WHITE = /(?:^|\s)text-white(?:\s|$)/
        const TEAL_BG = /(?:^|\s)bg-\[hsl\(var\(--primary\)\)\](?:\s|$)/

        const nextBtn = screen.getByText('Next')
        expect(nextBtn.className).toMatch(TEXT_WHITE)
        expect(nextBtn.className).toMatch(TEAL_BG)

        fireEvent.click(nextBtn)
        await advanceCoachMarkTimers()

        const doneBtn = screen.getByText('Done')
        expect(doneBtn.className).toMatch(TEXT_WHITE)
        expect(doneBtn.className).toMatch(TEAL_BG)
    })

    it('TC-F05-02-16i: isCompact renders card fully above the anchor (no spotlight overlap) at step 1 and step 2', async () => {
        // Arrange — narrow viewport, anchor rect sits in the lower 2/3 of the screen (Tools sheet).
        // JSDOM never lays out real pixels, so offsetHeight (what the component measures via
        // useLayoutEffect) must be mocked directly — getBoundingClientRect is mocked globally
        // for the anchor query and would otherwise leak a bogus height onto the card too.
        const MOCK_CARD_HEIGHT = 220
        const GAP = 16
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 400, left: 20, right: 370, bottom: 800, width: 350, height: 400,
            x: 20, y: 400, toJSON: () => ({}),
        } as DOMRect)
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(MOCK_CARD_HEIGHT)

        // Act — step 1
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card1 = screen.getByRole('dialog')
        const top1 = parseFloat(String(card1.style.top))

        // Assert — card bottom edge (top + measured height) stays above the anchor's top (400),
        // clamped with GAP; no `translateY` centering (compact is top-anchored, not center-anchored)
        expect(card1.style.transform).toBe('')
        expect(top1 + MOCK_CARD_HEIGHT).toBeLessThanOrEqual(400 - GAP)

        // Act — advance to step 2
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()
        const card2 = screen.getByRole('dialog')
        const top2 = parseFloat(String(card2.style.top))

        // Assert — same no-overlap guarantee at step 2
        expect(card2.style.transform).toBe('')
        expect(top2 + MOCK_CARD_HEIGHT).toBeLessThanOrEqual(400 - GAP)
    })

    it('TC-F05-02-16j: isCompact clamps card horizontally within the viewport margins', async () => {
        // Arrange
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 400, left: 20, right: 370, bottom: 800, width: 350, height: 400,
            x: 20, y: 400, toJSON: () => ({}),
        } as DOMRect)
        const VIEWPORT_MARGIN = 16

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card = screen.getByRole('dialog')
        const left = parseFloat(String(card.style.left))

        // Assert — horizontally clamped within [VIEWPORT_MARGIN, innerWidth - VIEWPORT_MARGIN]
        expect(left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
        expect(left).toBeLessThanOrEqual(390 - VIEWPORT_MARGIN)
    })

    it('TC-F05-02-16k: isCompact caps card max-height to the space above a short-viewport anchor (no growth past it)', async () => {
        // Arrange — short/landscape viewport where the anchor (bottom Tools sheet) sits
        // closer to the top, leaving limited room above it for a tall card. rect.top=300
        // keeps available space (268px) above MIN_CARD_MAX_HEIGHT's floor so this exercises
        // the actual cap formula, not the floor fallback.
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 300, left: 20, right: 370, bottom: 490, width: 350, height: 190,
            x: 20, y: 300, toJSON: () => ({}),
        } as DOMRect)

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card = screen.getByRole('dialog')

        // Assert — max-height is capped to the space actually available above the anchor
        // (rect.top - GAP - VIEWPORT_MARGIN = 300-16-16 = 268px), so overflow content
        // scrolls internally instead of growing the box past the anchor's top edge.
        expect(card.style.maxHeight).toBe('268px')
    })

    it('TC-F05-02-16l: isCompact floors card max-height at MIN_CARD_MAX_HEIGHT when the anchor is very close to the top', async () => {
        // Arrange — pathologically short viewport where naive available space (rect.top -
        // GAP - VIEWPORT_MARGIN = 60-16-16 = 28px) would collapse the card to unusable size;
        // the floor keeps it legible at the cost of a small, accepted overlap.
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 60, left: 20, right: 370, bottom: 290, width: 350, height: 230,
            x: 20, y: 60, toJSON: () => ({}),
        } as DOMRect)

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card = screen.getByRole('dialog')

        // Assert — floored at MIN_CARD_MAX_HEIGHT (140px), not the naive 28px
        expect(card.style.maxHeight).toBe('140px')
    })

    it('TC-F05-02-16m: mount-triggered onEnterStep1 calls the LATEST callback, not one frozen from the first render (GH-1607 regression: coach marks never appeared on compact because isCompactLayout is false on first render and only flips true after mount, so a stale onEnterStep1 closure never called openTools)', async () => {
        // Arrange — mount with an initial onEnterStep1, then rerender with a NEW reference
        // before the mount-delay timer fires, simulating the parent (page.tsx) re-rendering
        // once isCompactLayout syncs from its SSR-safe `false` default to the real `true`.
        const staleOnEnterStep1 = vi.fn()
        const latestOnEnterStep1 = vi.fn()
        const { rerender } = render(<RerenderableWrapper onEnterStep1={staleOnEnterStep1} />)
        rerender(<RerenderableWrapper onEnterStep1={latestOnEnterStep1} />)

        // Act — fire the mount-delay timer
        await advanceCoachMarkTimers()

        // Assert — the LATEST callback fires, not the one captured when the effect first ran
        expect(latestOnEnterStep1).toHaveBeenCalledOnce()
        expect(staleOnEnterStep1).not.toHaveBeenCalled()
    })

    it('TC-F05-02-16n: useAnchorRect polls and recovers when the anchor mounts after the initial resolve delay (adversarial-review regression: a single fixed-delay guess can miss a first-time compact panel mount, e.g. SettingsPanel mounting fresh inside EditorToolsSheet)', async () => {
        // Arrange — anchor absent at mount, simulating openTools() not having finished
        // mounting the compact panel (and its data-coach anchor) yet.
        const { rerender } = render(<DelayedAnchorWrapper anchorPresent={false} />)

        // Act — mount-delay(0ms) timer fires -> onEnterStep1(), setStep(1); lets the resulting
        // re-render commit so useAnchorRect's step-1 effect registers its own resolve timer.
        await act(async () => { vi.runAllTimers() })

        // The initial anchor-resolve delay (50ms, step 1) elapses with the anchor still absent
        // -> resolve() returns false -> polling starts instead of giving up.
        await act(async () => { vi.advanceTimersByTime(50) })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        // Anchor "mounts" shortly after (compact Tools sheet finishes mounting the panel late)
        rerender(<DelayedAnchorWrapper anchorPresent />)

        // One poll tick (100ms) — resolve() now finds the anchor and the card renders.
        await act(async () => { vi.advanceTimersByTime(100) })

        // Assert
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('TC-F05-02-16o: Done calls onFinish (parent uses this to close the compact Tools sheet so it does not stay open after onboarding ends)', async () => {
        // Arrange
        const onFinish = vi.fn()
        render(<Wrapper onFinish={onFinish} />)
        await advanceCoachMarkTimers()
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()

        // Act
        fireEvent.click(screen.getByText('Done'))

        // Assert
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it('TC-F05-02-16p: isCompact shrinks card width below CARD_WIDTH on a narrow viewport, clamped consistently in the horizontal-position math', async () => {
        // Arrange — 260px viewport: CARD_WIDTH(300) + 2*VIEWPORT_MARGIN(16) = 332 doesn't fit,
        // but 260-32=228 stays above MIN_CARD_WIDTH(220), so this exercises the shrink formula
        // itself, not the floor.
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(260)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 400, left: 10, right: 250, bottom: 690, width: 240, height: 290,
            x: 10, y: 400, toJSON: () => ({}),
        } as DOMRect)

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card = screen.getByRole('dialog')
        const left = parseFloat(String(card.style.left))

        // Assert — width shrunk to fit (260 - 2*16 = 228px), and left/right both respect
        // VIEWPORT_MARGIN using that same shrunk width (not the original 300px)
        expect(card.style.width).toBe('228px')
        expect(left).toBeGreaterThanOrEqual(16)
        expect(left + 228).toBeLessThanOrEqual(260 - 16)
    })

    it('TC-F05-02-16q: isCompact floors card width at MIN_CARD_WIDTH on a pathologically narrow viewport', async () => {
        // Arrange — 200px viewport: naive shrink (200-32=168) would go below MIN_CARD_WIDTH(220)
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(200)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 400, left: 10, right: 190, bottom: 690, width: 180, height: 290,
            x: 10, y: 400, toJSON: () => ({}),
        } as DOMRect)

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()
        const card = screen.getByRole('dialog')

        // Assert — floored at MIN_CARD_WIDTH (220px), not the naive 168px
        expect(card.style.width).toBe('220px')
    })

    it('TC-F05-02-16r: isCompact scrolls the anchor into view once when it resolves (e.g. the nav-link form under Settings→Menu can sit below the fold in SettingsPanel\'s own scroll container)', async () => {
        // Arrange
        const scrollIntoViewSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>

        // Act
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()

        // Assert — scrolled with minimal movement (block: 'nearest'), not always-to-top
        expect(scrollIntoViewSpy).toHaveBeenCalledOnce()
        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'instant', block: 'nearest' })
    })

    it('TC-F05-02-16s: desktop (isCompact=false) never scrolls the anchor into view — never touch desktop', async () => {
        // Arrange
        const scrollIntoViewSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>

        // Act
        render(<Wrapper isCompact={false} />)
        await advanceCoachMarkTimers()

        // Assert
        expect(scrollIntoViewSpy).not.toHaveBeenCalled()
    })

    it('TC-F05-02-16t: stepping 1→2 clears the stale rect immediately instead of rendering against the OLD (now-unmounted) anchor for the whole resolve window (code-review regression: backdrop/spotlight/click-blocker would linger at step 1\'s position — potentially covering the freshly-mounted step-2 panel — until the new anchor resolved)', async () => {
        // Arrange — mutex anchors mirror production (EditorToolsSheet mounts one panel at a time)
        render(<MutexAnchorWrapper />)
        await advanceCoachMarkTimers()
        expect(screen.getByRole('dialog')).toBeInTheDocument() // step 1 resolved

        // Act — advance to step 2: unmounts the step-1 anchor, mounts step-2's, but the new
        // anchor hasn't resolved yet (resolve timer/poll hasn't fired)
        fireEvent.click(screen.getByText('Next'))

        // Assert — nothing renders during the gap (no stale card/backdrop/spotlight at the
        // old, now-unmounted anchor's coordinates) — the component's own !rect guard hides
        // everything until the new anchor resolves, rather than showing a mismatched one
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        // Once the new (step-2) anchor resolves, the overlay reappears correctly
        await advanceCoachMarkTimers()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('TC-F05-02-16u: Next/Done button row sits OUTSIDE the scrollable content region, not inside it (code-review fix: buttons must stay reachable even when body copy is clipped by maxHeight, not scroll out of reach with no visible affordance)', async () => {
        // Arrange
        render(<Wrapper isCompact />)
        await advanceCoachMarkTimers()

        // Act
        const nextBtn = screen.getByText('Next')
        const scrollRegion = document.querySelector('.overflow-y-auto')

        // Assert
        expect(scrollRegion).not.toBeNull()
        expect(scrollRegion?.contains(nextBtn)).toBe(false)
    })
})
