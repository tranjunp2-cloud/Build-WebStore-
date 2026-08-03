import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'

interface AutoResizeHarnessProps {
    borderHeight: number
    maxHeight: number
    scrollHeight: number
}

function readRenderedHeight(element: HTMLTextAreaElement) {
    const height = Number.parseFloat(element.style.height)
    return Number.isFinite(height) ? height : 34
}

function AutoResizeHarness({ borderHeight, maxHeight, scrollHeight }: AutoResizeHarnessProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    useAutoResizeTextarea(textareaRef, 'Long product name', maxHeight)

    return (
        <textarea
            ref={(element) => {
                textareaRef.current = element
                if (!element) return

                Object.defineProperties(element, {
                    scrollHeight: {
                        configurable: true,
                        get: () => scrollHeight,
                    },
                    offsetHeight: {
                        configurable: true,
                        get: () => readRenderedHeight(element),
                    },
                    clientHeight: {
                        configurable: true,
                        get: () => readRenderedHeight(element) - borderHeight,
                    },
                })
            }}
            aria-label="Product name"
            style={{ boxSizing: 'border-box' }}
        />
    )
}

// ── TC-F08-04-94: Auto-resizing Product Name content visibility ─────────────
describe('useAutoResizeTextarea [TC-F08-04-94]', () => {
    it('includes border height so the textarea client box contains its full scroll height', () => {
        // Arrange
        render(<AutoResizeHarness borderHeight={2} maxHeight={Number.POSITIVE_INFINITY} scrollHeight={84} />)

        // Act
        const textarea = screen.getByRole('textbox', { name: 'Product name' })

        // Assert
        expect(textarea).toHaveStyle({ height: '86px', overflowY: 'hidden' })
        expect(textarea.clientHeight).toBe(textarea.scrollHeight)
    })

    it('enables vertical scrolling when content plus borders exceeds a finite maximum height', () => {
        // Arrange
        render(<AutoResizeHarness borderHeight={2} maxHeight={85} scrollHeight={84} />)

        // Act
        const textarea = screen.getByRole('textbox', { name: 'Product name' })

        // Assert
        expect(textarea).toHaveStyle({ height: '85px', overflowY: 'auto' })
        expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight)
    })

    it('preserves the previous sizing behavior for borderless textarea consumers', () => {
        // Arrange
        render(<AutoResizeHarness borderHeight={0} maxHeight={160} scrollHeight={84} />)

        // Act
        const textarea = screen.getByRole('textbox', { name: 'Product name' })

        // Assert
        expect(textarea).toHaveStyle({ height: '84px', overflowY: 'hidden' })
        expect(textarea.clientHeight).toBe(textarea.scrollHeight)
    })
})
