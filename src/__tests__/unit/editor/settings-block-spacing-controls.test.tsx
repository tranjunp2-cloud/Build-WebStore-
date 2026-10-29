/**
 * Unit Tests — BlockSpacingControls (Layout & Spacing sliders)
 * TC-GH2107-06, TC-GH2107-07, TC-GH2107-08, TC-GH2107-09, TC-GH2107-14
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F05-ai-editor-testcases.md (GH-2107)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'
import { BlockSpacingControls } from '@/components/editor/settings-block-spacing-controls'

const onCommit = vi.fn()

interface HostProps { top: number; bottom: number; savedTop: number; savedBottom: number }

/**
 * Mirrors SettingsPanel: local preview values (top/bottom) plus the values
 * stored on the block (savedTop/savedBottom). Committing writes to "saved".
 */
function Host(initial: HostProps) {
    const [top, setTop] = useState(initial.top)
    const [bottom, setBottom] = useState(initial.bottom)
    const [saved, setSaved] = useState({ paddingTop: initial.savedTop, paddingBottom: initial.savedBottom })
    return (
        <BlockSpacingControls
            title="Layout & Spacing"
            topLabel="Top spacing"
            bottomLabel="Bottom spacing"
            top={top}
            bottom={bottom}
            savedTop={saved.paddingTop}
            savedBottom={saved.paddingBottom}
            onTopChange={setTop}
            onBottomChange={setBottom}
            onCommit={(field, value) => {
                onCommit(field, value)
                setSaved(prev => ({ ...prev, [field]: value }))
            }}
        />
    )
}

const defaults: HostProps = { top: 32, bottom: 32, savedTop: 32, savedBottom: 32 }

describe('BlockSpacingControls', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('[TC-GH2107-06] pointer up commits the dragged value once', () => {
        // Arrange
        render(<Host {...defaults} />)
        const top = screen.getByRole('slider', { name: 'Top spacing' })

        // Act
        fireEvent.focus(top)
        fireEvent.change(top, { target: { value: '48' } })
        fireEvent.pointerUp(top)
        fireEvent.blur(top)

        // Assert — blur after pointer up must not save the same value again
        expect(onCommit).toHaveBeenCalledTimes(1)
        expect(onCommit).toHaveBeenCalledWith('paddingTop', 48)
    })

    it('[TC-GH2107-07] keyboard change is saved on key up', () => {
        // Arrange
        render(<Host {...defaults} />)
        const bottom = screen.getByRole('slider', { name: 'Bottom spacing' })

        // Act — browser changes the value on ArrowRight keydown, then keyup fires
        fireEvent.focus(bottom)
        fireEvent.change(bottom, { target: { value: '36' } })
        fireEvent.keyUp(bottom, { key: 'ArrowRight' })

        // Assert
        expect(onCommit).toHaveBeenCalledWith('paddingBottom', 36)
    })

    it('[TC-GH2107-08] focus then blur without change does not save', () => {
        // Arrange
        render(<Host {...defaults} />)
        const top = screen.getByRole('slider', { name: 'Top spacing' })

        // Act
        fireEvent.focus(top)
        fireEvent.keyUp(top, { key: 'Tab' })
        fireEvent.blur(top)

        // Assert
        expect(onCommit).not.toHaveBeenCalled()
    })

    it('[TC-GH2107-09] fill position follows the value (0-120 range)', () => {
        // Arrange & Act
        render(<Host top={36} bottom={0} savedTop={36} savedBottom={0} />)

        // Assert
        expect(screen.getByRole('slider', { name: 'Top spacing' }).style.getPropertyValue('--fill-ratio')).toBe('0.3')
        expect(screen.getByRole('slider', { name: 'Bottom spacing' }).style.getPropertyValue('--fill-ratio')).toBe('0')
        expect(screen.getByText('36px')).toBeInTheDocument()
    })

    it('[TC-GH2107-14] same slider instance saves again after the stored value changed from outside, without focus', () => {
        // Arrange — controlled directly (no remount): mirrors SettingsPanel keeping one slider across selections
        const props = {
            title: 'Layout & Spacing', topLabel: 'Top spacing', bottomLabel: 'Bottom spacing',
            bottom: 32, savedBottom: 32, onTopChange: vi.fn(), onBottomChange: vi.fn(), onCommit,
        }
        const { rerender } = render(<BlockSpacingControls {...props} top={32} savedTop={32} />)
        const top = screen.getByRole('slider', { name: 'Top spacing' })
        rerender(<BlockSpacingControls {...props} top={48} savedTop={32} />)   // dragged to 48
        fireEvent.pointerUp(top)                                                 // saved 48
        rerender(<BlockSpacingControls {...props} top={32} savedTop={32} />)   // undo / other block: store back to 32
        onCommit.mockClear()

        // Act — Safari: click does not focus a range input; drag to 48 again
        rerender(<BlockSpacingControls {...props} top={48} savedTop={32} />)
        fireEvent.pointerUp(top)

        // Assert
        expect(onCommit).toHaveBeenCalledTimes(1)
        expect(onCommit).toHaveBeenCalledWith('paddingTop', 48)
    })
})
