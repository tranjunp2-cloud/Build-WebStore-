import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { PreviewFrame } from '@/components/editor/PreviewFrame'

// Mutable store state so individual tests can swap performSave with a controllable
// (deferred) promise to assert behaviour while a save is still in flight (GH-1367 Bug 3).
const mockStoreState: {
    blocks: unknown[]
    updateBlock: ReturnType<typeof vi.fn>
    performSave: ReturnType<typeof vi.fn>
    setIsInlineEditing: ReturnType<typeof vi.fn>
    theme: null
} = {
    blocks: [],
    updateBlock: vi.fn(),
    performSave: vi.fn(() => Promise.resolve()),
    setIsInlineEditing: vi.fn(),
    theme: null,
}

vi.mock('@/store/editorStore', () => {
    const useEditorStore = vi.fn(() => mockStoreState) as unknown as {
        (): typeof mockStoreState
        getState: () => { autoSaveTimer: null }
        setState: ReturnType<typeof vi.fn>
    }
    useEditorStore.getState = () => ({ autoSaveTimer: null })
    useEditorStore.setState = vi.fn()
    return { useEditorStore }
})

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                toolbar: { sitePreview: 'Site Preview', dragToReorder: 'Drag to reorder section', drag: 'Drag' },
                preview: { altUploadedImage: 'Uploaded image', editWithAI: 'Edit with AI', mapImageError: 'Could not map image to block field', imageReplaceSuccess: 'Image replaced successfully', imageReplaceFailed: 'Failed to replace image', inlineEditFailed: 'Inline edit failed', aiContextLocked: 'AI Generation context locked to: {blockType}' },
                richText: { bold: 'Bold', italic: 'Italic', underline: 'Underline', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right', justify: 'Justify' },
                blockLibrary: { dropToAdd: 'Drop to add block' },
            },
        },
        locale: 'en',
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

type PreviewFrameProps = React.ComponentProps<typeof PreviewFrame>

describe('PreviewFrame', () => {
    const defaultProps: PreviewFrameProps = {
        siteId: 'site-123',
        pageId: null,
        iframeKey: 1,
        isLoading: false,
        viewport: 'desktop',
        selectedBlock: null,
    }

    it('renders loading skeleton when isLoading is true', () => {
        render(<PreviewFrame {...defaultProps} isLoading={true} />)
        expect(screen.getByText('Loading site...')).toBeInTheDocument()
        expect(screen.queryByTitle('Site Preview')).not.toBeInTheDocument()
    })

    it('renders iframe with correct src when not loading', () => {
        render(<PreviewFrame {...defaultProps} />)
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe).toBeInTheDocument()
        expect(iframe.getAttribute('src')).toContain('/preview/site-123?v=1')
    })

    it('switches from loading to iframe when isLoading changes', () => {
        const { rerender } = render(
            <PreviewFrame {...defaultProps} isLoading={true} />
        )
        expect(screen.getByText('Loading site...')).toBeInTheDocument()

        rerender(<PreviewFrame {...defaultProps} isLoading={false} />)
        expect(screen.queryByText('Loading site...')).not.toBeInTheDocument()
        expect(screen.getByTitle('Site Preview')).toBeInTheDocument()
    })

    it('iframe has no border class', () => {
        render(<PreviewFrame {...defaultProps} />)
        const iframe = screen.getByTitle('Site Preview')
        expect(iframe.className).toContain('border-0')
    })

    it('appends pageId to src if provided', () => {
        render(<PreviewFrame {...defaultProps} pageId="page-456" />)
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe.getAttribute('src')).toContain('pageId=page-456')
    })

    it('TC-F12-113-03: routes a manual save request from the iframe to the editor shell', async () => {
        // Arrange
        const onManualSave = vi.fn(() => Promise.resolve(true))
        render(<PreviewFrame {...defaultProps} onManualSave={onManualSave} />)

        // Act
        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'MANUAL_SAVE_REQUEST', source: 'footer' },
                origin: window.location.origin,
            }))
        })

        // Assert
        await waitFor(() => {
            expect(onManualSave).toHaveBeenCalledWith('footer')
        })
    })

    // TC-F05-07-06: Click Header → viền highlight xuất hiện, Panel Settings chuyển sang Navigation Links
    it('TC-F05-07-06: shows selection overlay when global block (navigation) is clicked', async () => {
        const onBlockSelect = vi.fn()
        render(<PreviewFrame {...defaultProps} onBlockSelect={onBlockSelect} />)

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                data: {
                    type: 'BLOCK_CONTAINER_CLICKED',
                    blockIndex: -1,
                    layout: { top: 100, left: 0, width: 1440, height: 80, blockIndex: -1, blockType: 'navigation' },
                },
                origin: window.location.origin,
            }))
        })

        await waitFor(() => {
            expect(onBlockSelect).toHaveBeenCalledWith(-1, 'navigation')
        })
        // Selection overlay label should be visible
        expect(screen.getByText('navigation')).toBeInTheDocument()
    })

    // TC-F05-07-06: Click canvas clears global block selection overlay
    it('TC-F05-07-06: clears global block selection overlay on canvas click', async () => {
        render(<PreviewFrame {...defaultProps} />)

        // First select a global block
        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                data: {
                    type: 'BLOCK_CONTAINER_CLICKED',
                    blockIndex: -1,
                    layout: { top: 0, left: 0, width: 1440, height: 80, blockIndex: -1, blockType: 'footer' },
                },
                origin: window.location.origin,
            }))
        })
        await waitFor(() => expect(screen.getByText('footer')).toBeInTheDocument())

        // Then click canvas
        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'PREVIEW_CANVAS_CLICKED' },
                origin: window.location.origin,
            }))
        })
        await waitFor(() => expect(screen.queryByText('footer')).not.toBeInTheDocument())
    })

    // ── GH-1367 Bug 3: text toolbar must hide instantly on stop, decoupled from save ──────────
    describe('[TC-EDIT-10..12] text toolbar hides instantly, save runs in background (GH-1367 Bug 3)', () => {
        const startEditing = (container: HTMLElement) => {
            act(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: {
                        type: 'TEXT_EDITING_STARTED',
                        blockIndex: 0,
                        blockType: 'hero',
                        rect: { top: 100, left: 50, width: 200, height: 40 },
                        originalText: 'Hello',
                        scrollY: 0,
                    },
                    origin: window.location.origin,
                }))
            })
            return container.querySelector('[data-wysiwyg-toolbar]')
        }

        const stopEditing = () => {
            act(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: { type: 'TEXT_EDITING_STOPPED' },
                    origin: window.location.origin,
                }))
            })
        }

        beforeEach(() => {
            vi.useFakeTimers()
            mockStoreState.performSave = vi.fn(() => Promise.resolve())
            mockStoreState.setIsInlineEditing = vi.fn()
        })

        afterEach(() => {
            vi.runOnlyPendingTimers()
            vi.useRealTimers()
        })

        // TC-EDIT-10: Edit text → stop → toolbar hidden ≤150ms even though save promise is still pending.
        it('TC-EDIT-10 (GH-1367): text toolbar hides within 150ms without waiting for save to resolve', () => {
            // Arrange — save never resolves during the assertion window
            let resolveSave: (() => void) | undefined
            mockStoreState.performSave = vi.fn(() => new Promise<void>((r) => { resolveSave = () => r() }))
            const { container } = render(<PreviewFrame {...defaultProps} />)

            // Act — start editing → toolbar visible
            expect(startEditing(container)).not.toBeNull()

            // Stop editing, advance only the 150ms debounce (save still pending)
            stopEditing()
            act(() => { vi.advanceTimersByTime(150) })

            // Assert — toolbar gone immediately; save was invoked but not yet resolved
            expect(container.querySelector('[data-wysiwyg-toolbar]')).toBeNull()
            expect(mockStoreState.performSave).toHaveBeenCalled()
            expect(resolveSave).toBeTypeOf('function') // promise still in flight
        })

        // TC-EDIT-11: switching to another text before the stop debounce fires must cancel the
        // pending stop — toolbar stays up (re-targets the new text), no flicker, no premature save.
        it('TC-EDIT-11 (GH-1367): re-starting edit cancels the pending stop — no flicker, no early save', () => {
            const { container } = render(<PreviewFrame {...defaultProps} />)
            startEditing(container) // text A

            // Click away → schedules the 150ms stop
            stopEditing()
            // ...but immediately land on another text before the debounce fires
            act(() => { vi.advanceTimersByTime(50) })
            startEditing(container) // text B (cancels pending stop via clearTimeout)
            act(() => { vi.advanceTimersByTime(150) })

            // Toolbar still present (now targeting text B) and the stale stop never saved
            expect(container.querySelector('[data-wysiwyg-toolbar]')).not.toBeNull()
            expect(mockStoreState.performSave).not.toHaveBeenCalled()
        })

        // TC-EDIT-12: clicking a toolbar button keeps editing alive — stop must be ignored when
        // focus is inside the toolbar (uses the data-wysiwyg-toolbar focus guard, not a 3s delay).
        it('TC-EDIT-12 (GH-1367): stop is ignored while a toolbar control holds focus', () => {
            const { container } = render(<PreviewFrame {...defaultProps} />)
            startEditing(container)

            // Move focus into the toolbar (simulates clicking B/I/U)
            const control = container.querySelector('[data-wysiwyg-toolbar] button') as HTMLElement | null
            expect(control).not.toBeNull() // guard: fail loudly if the toolbar stops rendering controls
            act(() => { control!.focus() })

            stopEditing()
            act(() => { vi.advanceTimersByTime(150) })

            // Toolbar stays because focus is inside it (focus guard, not a 3s delay)
            expect(container.querySelector('[data-wysiwyg-toolbar]')).not.toBeNull()
        })

        // TC-EDIT-14 (M1): a background save that resolves AFTER the user re-targets another text
        // must not clobber the new session — its .finally() is invalidated by the session token,
        // so autosave is NOT re-enabled mid-edit of the new text.
        it('TC-EDIT-14 (GH-1367 M1): stale save .finally() does not re-enable autosave for the new session', async () => {
            let resolveSaveA: (() => void) | undefined
            mockStoreState.performSave = vi.fn(() => new Promise<void>((r) => { resolveSaveA = () => r() }))
            const { container } = render(<PreviewFrame {...defaultProps} />)

            // Session A: edit → stop → save A starts and stays in flight
            startEditing(container)
            stopEditing()
            act(() => { vi.advanceTimersByTime(150) })
            expect(mockStoreState.performSave).toHaveBeenCalledTimes(1) // save A in flight

            // Session B: user re-targets another text before save A resolves (bumps the token)
            startEditing(container)
            expect(container.querySelector('[data-wysiwyg-toolbar]')).not.toBeNull() // editing B

            // Save A resolves late → its .finally() must be a no-op for session B
            await act(async () => { resolveSaveA?.(); await Promise.resolve() })

            // Autosave must NOT have been disabled (false) by the stale flush — only enabled (true)
            // calls from the two STARTED sessions are allowed.
            expect(mockStoreState.setIsInlineEditing).not.toHaveBeenCalledWith(false)
            expect(container.querySelector('[data-wysiwyg-toolbar]')).not.toBeNull() // B still editing
        })

        // TC-EDIT-15 (A1): a navigation/key change while a save is still flushing must release the
        // isFlushingEdit freeze via the reset effect — otherwise the preview iframe stays stuck on
        // the old key and never reloads. Guards against the token-guarded .finally() leaking the freeze.
        it('TC-EDIT-15 (GH-1367 A1): reset effect releases the flush freeze so the iframe is not stuck frozen', () => {
            let resolveSave: (() => void) | undefined
            mockStoreState.performSave = vi.fn(() => new Promise<void>((r) => { resolveSave = () => r() }))
            const { container, rerender } = render(<PreviewFrame {...defaultProps} iframeKey={1} />)
            const getSrc = () => (container.querySelector('iframe') as HTMLIFrameElement).getAttribute('src')

            // Edit → stop → save in flight: iframe frozen at v=1 while isFlushingEdit is true
            startEditing(container)
            stopEditing()
            act(() => { vi.advanceTimersByTime(150) })
            expect(getSrc()).toContain('v=1')

            // A key change (e.g. autosave refresh / navigation) must unfreeze even though the save
            // promise is still pending — the reset effect clears isFlushingEdit.
            rerender(<PreviewFrame {...defaultProps} iframeKey={2} />)
            expect(getSrc()).toContain('v=2')

            resolveSave?.()
        })
    })
})
