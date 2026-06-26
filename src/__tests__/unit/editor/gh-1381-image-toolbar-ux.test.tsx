/**
 * Regression Tests — GH-1381: Image Toolbar Upload UX
 *
 * Covers the ImageToolbar component's loading state display during image processing.
 * When `isProcessing=true`, shows spinner + "uploading" label; when false, shows
 * ImagePlus icon + "changeImage" label.
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-GH1381-01  → ImageToolbar with isProcessing=true renders Loader2 spinner + animate-spin
 *   TC-GH1381-02  → ImageToolbar with isProcessing=true button is disabled
 *   TC-GH1381-03  → ImageToolbar with isProcessing=true shows i18n 'uploading' label
 *   TC-GH1381-04  → ImageToolbar with isProcessing=false renders ImagePlus icon
 *   TC-GH1381-05  → ImageToolbar with isProcessing=false shows i18n 'changeImage' label
 *   TC-GH1381-06  → ImageToolbar with isProcessing=false button is enabled
 *
 * Source:
 *   src/components/editor/ImageToolbar.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ImageToolbar } from '@/components/editor/ImageToolbar'

// ── Mock i18n ─────────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                imageToolbar: {
                    changeImage: 'Change Image',
                    uploading: 'Uploading...',
                    generateAI: 'Generate AI Image',
                },
            },
        },
        locale: 'en',
    }),
}))

// ── Mock image processing ─────────────────────────────────────────────────────
vi.mock('@/lib/utils/image', () => ({
    processImageFile: vi.fn(async (file: File) => file),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ImageToolbar — loading state display (GH-1381)', () => {
    const mockOnImageSelect = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-GH1381-01: Spinner visible when isProcessing=true
    it('TC-GH1381-01: isProcessing=true renders Loader2 spinner with animate-spin class', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        // Find the spinner SVG (Loader2 icon from lucide-react)
        const spinner = container.querySelector('svg.animate-spin')
        expect(spinner).toBeTruthy()
        expect(spinner?.classList.contains('animate-spin')).toBe(true)
    })

    // TC-GH1381-02: Button disabled when isProcessing=true
    it('TC-GH1381-02: isProcessing=true disables the button (prevents duplicate uploads)', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        const button = container.querySelector('button')
        expect(button).toBeTruthy()
        expect(button?.disabled).toBe(true)
        expect(button?.className).toContain('disabled:opacity-50')
    })

    // TC-GH1381-03: Shows "uploading" label when isProcessing=true
    it('TC-GH1381-03: isProcessing=true displays "Uploading..." label from i18n', () => {
        render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        const uploadingLabel = screen.getByText('Uploading...')
        expect(uploadingLabel).toBeTruthy()
    })

    // TC-GH1381-04: ImagePlus icon visible when isProcessing=false
    it('TC-GH1381-04: isProcessing=false renders ImagePlus icon (not spinner)', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )

        // Spinner should NOT be present
        const spinner = container.querySelector('svg.animate-spin')
        expect(spinner).toBeFalsy()

        // ImagePlus should be present (check for the button with the text)
        const button = screen.getByText('Change Image')
        expect(button).toBeTruthy()
    })

    // TC-GH1381-05: Shows "changeImage" label when isProcessing=false
    it('TC-GH1381-05: isProcessing=false displays "Change Image" label from i18n', () => {
        render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )

        const changeLabel = screen.getByText('Change Image')
        expect(changeLabel).toBeTruthy()
    })

    // TC-GH1381-06: Button enabled when isProcessing=false
    it('TC-GH1381-06: isProcessing=false enables the button (allows user interaction)', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )

        const button = container.querySelector('button')
        expect(button).toBeTruthy()
        expect(button?.disabled).toBe(false)
    })

    // TC-GH1381-07: Undefined isProcessing defaults to false
    it('TC-GH1381-07: isProcessing prop undefined defaults to false (enabled state)', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} />
        )

        const button = container.querySelector('button')
        expect(button?.disabled).toBe(false)
        expect(screen.getByText('Change Image')).toBeTruthy()
    })

    // TC-GH1381-08: Transition between loading states
    it('TC-GH1381-08: re-render with isProcessing change updates button state and label', () => {
        const { rerender, container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )

        // Initially: enabled + "Change Image"
        expect(screen.getByText('Change Image')).toBeTruthy()
        let button = container.querySelector('button') as HTMLButtonElement
        expect(button.disabled).toBe(false)

        // Change to isProcessing=true
        rerender(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        // Now: disabled + "Uploading..."
        expect(screen.getByText('Uploading...')).toBeTruthy()
        button = container.querySelector('button') as HTMLButtonElement
        expect(button.disabled).toBe(true)
        expect(container.querySelector('svg.animate-spin')).toBeTruthy()
    })
})
