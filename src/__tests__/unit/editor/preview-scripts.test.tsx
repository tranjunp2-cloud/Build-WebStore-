import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PreviewScripts, replaceDropHintCSS } from '@/components/editor/PreviewScripts'

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

    it('should open external links in new tab when outside iframe (standalone view)', () => {
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

        // Assert — external links call preventDefault to open in new tab (not navigate away from preview)
        expect(preventDefaultSpy).toHaveBeenCalled()
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

    // TC-F05-06-09: contentEditable must not activate on table-scroll wrapper divs
    it('should not set contenteditable on a div that directly wraps a <table> (overflow-x-auto fix)', () => {
        // Arrange — feature-comparison table variant DOM structure
        document.body.innerHTML = `
            <div data-block-index="0" data-block-type="feature-comparison">
                <section>
                    <div class="container">
                        <div class="overflow-x-auto" id="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th id="th-cell"><span>Feature</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td id="td-cell">
                                            <span id="td-span" class="inline-flex">
                                                <svg><path d="M5 10l3.5 3.5L15 7"/></svg>
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>
        `
        render(<PreviewScripts />)
        const tableWrapper = document.getElementById('table-wrapper')!

        // Act — click on the table-cell padding area (target = td, walk-up reaches div.overflow-x-auto)
        const tdCell = document.getElementById('td-cell')!
        tdCell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        // Assert — the overflow-x-auto div must NOT become contenteditable
        expect(tableWrapper.getAttribute('contenteditable')).toBeNull()
    })

    describe('replaceDropHintCSS', () => {
        it('should replace drop hint text in CSS', () => {
            const css = `.insert-marker::after { content: 'Drop to add block'; /*drop-hint*/ }`
            const result = replaceDropHintCSS(css, 'Lepaskan untuk tambah blok')

            expect(result).toContain("content: 'Lepaskan untuk tambah blok'")
            expect(result).toContain('/*drop-hint*/')
            expect(result).not.toContain('Drop to add block')
        })

        it('should escape single quotes in replacement text', () => {
            const css = `.insert-marker::after { content: 'Drop to add block'; /*drop-hint*/ }`
            const result = replaceDropHintCSS(css, "Drop it's here")

            expect(result).toContain("content: 'Drop it\\'s here'")
        })

        it('should return CSS unchanged when marker is missing', () => {
            const css = `.insert-marker::after { content: 'no marker here'; }`
            const result = replaceDropHintCSS(css, 'Test')

            expect(result).toBe(css)
        })
    })
})
