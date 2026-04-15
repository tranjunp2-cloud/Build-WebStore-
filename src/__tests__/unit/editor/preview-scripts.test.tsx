import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PreviewScripts } from '@/components/editor/PreviewScripts'

describe('PreviewScripts', () => {
    let mockPostMessage: ReturnType<typeof vi.fn>
    let originalParent: Window

    beforeEach(() => {
        vi.useFakeTimers()
        mockPostMessage = vi.fn()
        originalParent = window.parent
        
        Object.defineProperty(window, 'parent', {
            value: {
                postMessage: mockPostMessage,
            },
            writable: true,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        document.body.innerHTML = ''
        Object.defineProperty(window, 'parent', {
            value: originalParent,
            writable: true,
        })
    })

    it('should send BLOCK_LAYOUT on mount initially', () => {
        // Arrange
        document.body.innerHTML = `
            <div data-block-index="0" data-block-type="hero">
                <h1>Title</h1>
            </div>
        `

        // Act
        render(<PreviewScripts />)
        vi.advanceTimersByTime(100) // Trigger postLayouts timeout

        // Assert
        expect(mockPostMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'BLOCK_LAYOUT',
                layouts: expect.any(Array),
            }),
            expect.any(String)
        )
    })

    it('should prevent default click on anchors when inside iframe editor', () => {
        // Arrange
        document.body.innerHTML = `
            <a href="https://example.com" id="test-link">Link</a>
        `
        render(<PreviewScripts />)
        const link = document.getElementById('test-link')

        // Mock window !== window.parent (inside iframe scenario) is already done in beforeEach
        const preventDefaultSpy = vi.fn()
        const stopPropagationSpy = vi.fn()
        
        const mockEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
        Object.assign(mockEvent, { preventDefault: preventDefaultSpy, stopPropagation: stopPropagationSpy })

        // Act
        link?.dispatchEvent(mockEvent)

        // Assert
        expect(preventDefaultSpy).toHaveBeenCalled()
        expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should allow default click on anchors when outside iframe (standalone view)', () => {
        // Arrange
        document.body.innerHTML = `
            <a href="https://example.com" id="test-link">Link</a>
        `
        
        // Mock window === window.parent (standalone scenario)
        Object.defineProperty(window, 'parent', {
            value: window,
            writable: true,
        })
        
        render(<PreviewScripts />)
        const link = document.getElementById('test-link')

        const preventDefaultSpy = vi.fn()
        const stopPropagationSpy = vi.fn()
        
        const mockEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
        Object.assign(mockEvent, { preventDefault: preventDefaultSpy, stopPropagation: stopPropagationSpy })

        // Act
        link?.dispatchEvent(mockEvent)

        // Assert
        expect(preventDefaultSpy).not.toHaveBeenCalled()
        expect(stopPropagationSpy).not.toHaveBeenCalled()
    })

    it('should cleanup event listeners on unmount', () => {
        // Arrange
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
        const { unmount } = render(<PreviewScripts />)

        // Act
        unmount()

        // Assert
        expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseover', expect.any(Function))
        removeEventListenerSpy.mockRestore()
    })

    describe('SET_DROP_HINT message', () => {
        afterEach(() => {
            document.getElementById('editor-preview-styles')?.remove()
        })

        it('should update CSS drop hint text when receiving SET_DROP_HINT message', () => {
            // Arrange — inject the style element that PreviewScripts creates
            const style = document.createElement('style')
            style.id = 'editor-preview-styles'
            style.innerHTML = `
                .insert-marker::after {
                  content: 'Drop to add block'; /*drop-hint*/
                }
            `
            document.head.appendChild(style)

            render(<PreviewScripts />)

            // Act — dispatch SET_DROP_HINT message from same origin
            const event = new MessageEvent('message', {
                data: { type: 'SET_DROP_HINT', text: 'Lepaskan untuk tambah blok' },
                origin: window.location.origin,
            })
            window.dispatchEvent(event)

            // Assert — CSS content should be updated
            expect(style.innerHTML).toContain("content: 'Lepaskan untuk tambah blok'")
            expect(style.innerHTML).toContain('/*drop-hint*/')
        })

        it('should escape single quotes in drop hint text', () => {
            // Arrange
            const style = document.createElement('style')
            style.id = 'editor-preview-styles'
            style.innerHTML = `
                .insert-marker::after {
                  content: 'Drop to add block'; /*drop-hint*/
                }
            `
            document.head.appendChild(style)

            render(<PreviewScripts />)

            // Act — text with single quote
            const event = new MessageEvent('message', {
                data: { type: 'SET_DROP_HINT', text: "Drop it's here" },
                origin: window.location.origin,
            })
            window.dispatchEvent(event)

            // Assert — single quote should be escaped
            expect(style.innerHTML).toContain("content: 'Drop it\\'s here'")
        })

        it('should not crash when style element is missing', () => {
            // Arrange — no style element injected
            render(<PreviewScripts />)

            // Act — should not throw
            const event = new MessageEvent('message', {
                data: { type: 'SET_DROP_HINT', text: 'Test' },
                origin: window.location.origin,
            })
            expect(() => window.dispatchEvent(event)).not.toThrow()
        })
    })
})
