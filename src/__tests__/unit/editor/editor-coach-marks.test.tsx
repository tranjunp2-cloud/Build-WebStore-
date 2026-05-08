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
function Wrapper({ onEnterStep1 = vi.fn(), onEnterStep2 = vi.fn() }: { onEnterStep1?: () => void; onEnterStep2?: () => void }) {
    return (
        <I18nProvider defaultLocale="en">
            {/* Anchor elements used by EditorCoachMarks */}
            <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />
            <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />
            <EditorCoachMarks mountDelayMs={0} onEnterStep1={onEnterStep1} onEnterStep2={onEnterStep2} />
        </I18nProvider>
    )
}

/** Advance all pending timers through two levels: mountDelay → state update → anchor timer */
async function advanceCoachMarkTimers() {
    // First pass: fires mountDelayMs timer → setStep(1)
    await act(async () => { vi.runAllTimers() })
    // Second pass: fires the 50ms anchor-rect setTimeout inside useAnchorRect
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
        expect(screen.getByText(/internal pages/)).toBeInTheDocument()
        expect(screen.queryByText('Skip')).not.toBeInTheDocument()
        expect(screen.queryByText('Back')).not.toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('TC-F05-02-16c: clicking Tiếp theo calls onEnterStep2 and advances to step 2', async () => {
        // Arrange
        const onEnterStep2 = vi.fn()
        render(<Wrapper onEnterStep2={onEnterStep2} />)
        await advanceCoachMarkTimers()

        // Act
        fireEvent.click(screen.getByText('Next'))
        await advanceCoachMarkTimers()

        // Assert
        expect(onEnterStep2).toHaveBeenCalledOnce()
        expect(screen.getByText('Step 2: Control menu visibility here')).toBeInTheDocument()
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
        expect(screen.getByText('Step 2: Control menu visibility here')).toBeInTheDocument()
        onEnterStep1.mockClear() // clear calls from mount

        // Act
        fireEvent.click(screen.getByText('Back'))
        await advanceCoachMarkTimers()

        // Assert — callback fired, back at step 1, no Back button
        expect(onEnterStep1).toHaveBeenCalledOnce()
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
        expect(screen.queryByText('Back')).not.toBeInTheDocument()
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
})
