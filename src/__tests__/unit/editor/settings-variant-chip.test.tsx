/**
 * Unit Tests — VariantChip (editor sidebar variant picker)
 * TC-GH2107-03, TC-GH2107-04
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F05-ai-editor-testcases.md (GH-2107)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { VariantChip } from '@/components/editor/settings-variant-chip'

describe('VariantChip', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('[TC-GH2107-03] active chip is a pressed button using primary tokens, not hardcoded blue', () => {
        // Arrange & Act
        render(<VariantChip active onClick={vi.fn()}>Centered</VariantChip>)

        // Assert
        const chip = screen.getByRole('button', { name: 'Centered' })
        expect(chip).toHaveAttribute('type', 'button')
        expect(chip).toHaveAttribute('aria-pressed', 'true')
        expect(chip.className).toContain('hsl(var(--primary)')
        expect(chip.className).not.toMatch(/blue-/)
    })

    it('[TC-GH2107-04] idle chip is not pressed, uses editor hover token and fires onClick', () => {
        // Arrange
        const onClick = vi.fn()
        render(<VariantChip active={false} onClick={onClick}>Default</VariantChip>)
        const chip = screen.getByRole('button', { name: 'Default' })

        // Act
        fireEvent.click(chip)

        // Assert
        expect(chip).toHaveAttribute('aria-pressed', 'false')
        expect(chip.className).toContain('hover:bg-[var(--editor-overlay-hover)]')
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
