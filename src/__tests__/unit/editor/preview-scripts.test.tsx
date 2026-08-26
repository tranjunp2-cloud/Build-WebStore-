import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PreviewScripts, BuilderLinkScripts, replaceDropHintCSS } from '@/components/editor/PreviewScripts'

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

    it('TC-F12-113-02: sends an immediate manual-save request for Cmd/Ctrl+S in the canvas', () => {
        // Arrange
        render(<PreviewScripts />)
        const event = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        })

        // Act
        document.dispatchEvent(event)

        // Assert
        expect(event.defaultPrevented).toBe(true)
        expect(mockPostMessage).toHaveBeenCalledWith(
            { type: 'MANUAL_SAVE_REQUEST', source: 'iframe' },
            expect.any(String),
        )
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

    // ── TC-EDIT-01..05: Text Hit Detection via caretRangeFromPoint ──────────────────────────────
    // GH-1367 Bug 1: clickLandedOnTextNode guard prevents text-edit toolbar on background/padding clicks

    describe('[TC-EDIT-01..05] clickLandedOnTextNode — Text vs Background Detection (GH-1367)', () => {
        // jsdom does not implement HTMLElement.innerText (returns undefined). The real onTextClick
        // path reads target.innerText to reject empty elements, so without a polyfill every positive
        // text-hit case would early-return. Mirror real browsers by falling back to textContent.
        const hadInnerText = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'innerText')

        // Mock the browser caret APIs at test level
        beforeEach(() => {
            Object.defineProperty(HTMLElement.prototype, 'innerText', {
                get() {
                    return this.textContent
                },
                configurable: true,
            })
            // By default, mock caretRangeFromPoint to return a non-text hit (element node)
            // Individual tests override this as needed
            Object.defineProperty(document, 'caretRangeFromPoint', {
                value: vi.fn(() => ({
                    startContainer: { nodeType: Node.ELEMENT_NODE }, // Element node (not text)
                })),
                writable: true,
                configurable: true,
            })
        })

        afterEach(() => {
            // Clean up caret API mocks
            delete (document as any).caretRangeFromPoint
            delete (document as any).caretPositionFromPoint
            // Restore innerText to its original (absent) state to avoid leaking into other suites
            if (!hadInnerText) {
                delete (HTMLElement.prototype as any).innerText
            }
        })

        // TC-EDIT-01: Background click (padding area) → NO TEXT_EDITING_STARTED
        it('TC-EDIT-01 (GH-1367): background/padding click → NO TEXT_EDITING_STARTED message', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="0" data-block-type="hero" style="padding: 40px;">
                    <div style="background: lightblue; padding: 20px;">
                        <h1 style="margin: 0;">Hero Title</h1>
                    </div>
                </div>
            `
            mockPostMessage.mockClear()
            render(<PreviewScripts />)

            const blockEl = document.querySelector('[data-block-index="0"]')!
            const paddingArea = blockEl.querySelector('div')! // The light-blue padding wrapper

            // Mock caretRangeFromPoint to return element node (padding hit)
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.ELEMENT_NODE }, // Element, not text
            }))

            // Act — click on padding area (not on the H1 text)
            paddingArea.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 50,
                    clientY: 100,
                })
            )

            // Assert — TEXT_EDITING_STARTED should NOT be posted
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages).toHaveLength(0)
        })

        // TC-EDIT-02: Heading text click → TEXT_EDITING_STARTED
        it('TC-EDIT-02 (GH-1367): heading text click → TEXT_EDITING_STARTED posted', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="0" data-block-type="hero">
                    <h1 id="hero-heading">Hero Title</h1>
                </div>
            `
            mockPostMessage.mockClear()

            // Mock caretRangeFromPoint BEFORE rendering (so it's in effect for the listener)
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.TEXT_NODE }, // Text node
            }))

            render(<PreviewScripts />)

            const heading = document.getElementById('hero-heading')!

            // Act — click on heading text
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 50,
                clientY: 50,
            })
            heading.dispatchEvent(clickEvent)

            // Assert — TEXT_EDITING_STARTED should be posted
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages.length).toBeGreaterThan(0)
            expect(textEditingMessages[0][0]).toEqual(
                expect.objectContaining({
                    type: 'TEXT_EDITING_STARTED',
                    blockIndex: 0,
                })
            )
        })

        // TC-EDIT-03: Padding on heading (element wrapper) → NO TEXT_EDITING_STARTED
        it('TC-EDIT-03 (GH-1367): click on padding wrapper around heading → NO TEXT_EDITING_STARTED', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="0" data-block-type="hero">
                    <div style="padding: 20px;" id="padding-wrapper">
                        <h2>Section Title</h2>
                    </div>
                </div>
            `
            mockPostMessage.mockClear()
            render(<PreviewScripts />)

            const paddingWrapper = document.getElementById('padding-wrapper')!

            // Mock caretRangeFromPoint to return element node (padding area hit, not text)
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.ELEMENT_NODE }, // Element, not text
            }))

            // Act — click on the padding div (not the H2)
            paddingWrapper.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 30,
                    clientY: 30,
                })
            )

            // Assert — TEXT_EDITING_STARTED should NOT be posted
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages).toHaveLength(0)
        })

        // TC-EDIT-04: Empty Logo Cloud block (no text content) → NO TEXT_EDITING_STARTED
        it('TC-EDIT-04 (GH-1367): empty Logo Cloud block click → NO TEXT_EDITING_STARTED', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="2" data-block-type="logo-cloud">
                    <div style="padding: 40px; background: #f5f5f5;"></div>
                </div>
            `
            mockPostMessage.mockClear()
            render(<PreviewScripts />)

            const blockEl = document.querySelector('[data-block-index="2"]')!
            const emptyArea = blockEl.querySelector('div')!

            // Mock caretRangeFromPoint to return element node (empty background)
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.ELEMENT_NODE }, // Element (empty area)
            }))

            // Act — click on empty logo cloud area
            emptyArea.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 100,
                    clientY: 100,
                })
            )

            // Assert — TEXT_EDITING_STARTED should NOT be posted (no editable text element)
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages).toHaveLength(0)
        })

        // TC-EDIT-05: Newsletter background vs headline text
        it('TC-EDIT-05 (GH-1367): newsletter block — click bg → no edit, click headline → edit started', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="3" data-block-type="newsletter">
                    <div id="newsletter-bg" style="background: url(img.jpg); padding: 60px;">
                        <h3 id="newsletter-headline">Subscribe Today</h3>
                        <input type="email" placeholder="Email" />
                    </div>
                </div>
            `
            mockPostMessage.mockClear()
            render(<PreviewScripts />)

            const background = document.getElementById('newsletter-bg')!
            const headline = document.getElementById('newsletter-headline')!

            // ACT 1: Click on background (element node)
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.ELEMENT_NODE },
            }))
            background.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 200,
                    clientY: 200,
                })
            )

            // ASSERT 1: No TEXT_EDITING_STARTED on background click
            let textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages).toHaveLength(0)

            // ACT 2: Click on headline (text node)
            mockPostMessage.mockClear()
            ;(document as any).caretRangeFromPoint = vi.fn(() => ({
                startContainer: { nodeType: Node.TEXT_NODE },
            }))
            headline.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 200,
                    clientY: 180,
                })
            )

            // ASSERT 2: TEXT_EDITING_STARTED posted on headline click
            textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages.length).toBeGreaterThan(0)
        })

        // Firefox fallback: caretPositionFromPoint when caretRangeFromPoint unavailable
        it('TC-EDIT-02 variant: Firefox fallback caretPositionFromPoint → TEXT_EDITING_STARTED', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="0" data-block-type="hero">
                    <h2 id="firefox-heading">Firefox Text</h2>
                </div>
            `
            mockPostMessage.mockClear()

            // Remove caretRangeFromPoint, add Firefox's caretPositionFromPoint
            delete (document as any).caretRangeFromPoint
            ;(document as any).caretPositionFromPoint = vi.fn(() => ({
                offsetNode: { nodeType: Node.TEXT_NODE },
            }))

            render(<PreviewScripts />)

            const heading = document.getElementById('firefox-heading')!

            // Act — click on heading (Firefox path)
            heading.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 80,
                    clientY: 60,
                })
            )

            // Assert — TEXT_EDITING_STARTED posted via Firefox fallback
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages.length).toBeGreaterThan(0)
        })

        // Legacy fallback: no caret API → allow editing (returns true by default)
        it('legacy fallback: no caret API available → allow text editing', () => {
            // Arrange
            document.body.innerHTML = `
                <div data-block-index="0" data-block-type="hero">
                    <p id="legacy-text">Legacy Browser Text</p>
                </div>
            `
            mockPostMessage.mockClear()

            // Remove both caret APIs (simulating ultra-old browser)
            delete (document as any).caretRangeFromPoint
            delete (document as any).caretPositionFromPoint

            render(<PreviewScripts />)

            const text = document.getElementById('legacy-text')!

            // Act — click on text (no caret API available)
            text.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: 60,
                    clientY: 70,
                })
            )

            // Assert — TEXT_EDITING_STARTED posted (fallback allows editing)
            const textEditingMessages = mockPostMessage.mock.calls.filter(
                call => call[0]?.type === 'TEXT_EDITING_STARTED'
            )
            expect(textEditingMessages.length).toBeGreaterThan(0)
        })
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

// ── TC-GH1461-CUR: BuilderLinkScripts readonly-cursor injection (GH-1461) ──
// QA doc: docs/qa/F04-block-renderer.md §7
describe('[TC-GH1461-CUR] BuilderLinkScripts — readonly cursor injection', () => {
    const injectedCursorStyle = () =>
        Array.from(document.head.querySelectorAll('style')).find(
            (s) => s.textContent?.includes('cursor: default')
        )

    afterEach(() => {
        document.head.querySelectorAll('style').forEach((s) => s.remove())
    })

    it('TC-GH1461-CUR-01: injects html cursor:default style into document head on mount', () => {
        // Act
        const { unmount } = render(<BuilderLinkScripts />)

        // Assert — arrow cursor forced on the whole readonly preview document
        const style = injectedCursorStyle()
        expect(style).toBeDefined()
        expect(style?.textContent).toContain('html { cursor: default; }')

        unmount()
    })

    it('TC-GH1461-CUR-02: removes the injected cursor style on unmount', () => {
        // Arrange
        const { unmount } = render(<BuilderLinkScripts />)
        expect(injectedCursorStyle()).toBeDefined()

        // Act
        unmount()

        // Assert — no leftover style tag once the preview surface goes away
        expect(injectedCursorStyle()).toBeUndefined()
    })
})
