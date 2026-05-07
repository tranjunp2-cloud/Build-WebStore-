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
function Wrapper({ onEnterStep2 = vi.fn() }: { onEnterStep2?: () => void }) {
    return (
        <I18nProvider defaultLocale="en">
            {/* Anchor elements used by EditorCoachMarks */}
            <div data-coach="page-library" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: 600 }} />
            <div data-coach="menu-settings" style={{ position: 'fixed', top: 0, right: 0, width: 320, height: 600 }} />
            <EditorCoachMarks mountDelayMs={0} onEnterStep2={onEnterStep2} />
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
    })

    afterEach(() => {
        vi.useRealTimers()
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

        // Assert — step 1 title and body visible
        expect(screen.getByText('Step 1: Create pages here')).toBeInTheDocument()
        expect(screen.getByText(/internal pages/)).toBeInTheDocument()
        expect(screen.getByText('Skip')).toBeInTheDocument()
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

    it('TC-F05-02-16e: clicking Skip at step 1 writes flag and closes', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Act
        fireEvent.click(screen.getByText('Skip'))

        // Assert
        expect(screen.queryByText(/Step /)).not.toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('TC-F05-02-16f: ESC key dismisses and writes flag', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Act
        fireEvent.keyDown(window, { key: 'Escape' })

        // Assert
        expect(screen.queryByText(/Step /)).not.toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('TC-F05-02-16g: backdrop click dismisses coach marks', async () => {
        // Arrange
        render(<Wrapper />)
        await advanceCoachMarkTimers()

        // Act — click the backdrop div (first fixed overlay, has onClick handler)
        const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
        fireEvent.click(backdrop)

        // Assert
        expect(screen.queryByText(/Step /)).not.toBeInTheDocument()
    })
})
