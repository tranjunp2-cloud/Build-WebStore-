import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { PreviewFrame } from '@/components/editor/PreviewFrame'

vi.mock('@/store/editorStore', () => ({
    useEditorStore: vi.fn().mockReturnValue({
        blocks: [],
        updateBlock: vi.fn(),
        performSave: vi.fn(),
        theme: null,
    })
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                toolbar: { sitePreview: 'Site Preview', dragToReorder: 'Drag to reorder section', drag: 'Drag' },
                preview: { altUploadedImage: 'Uploaded image', editWithAI: 'Edit with AI', mapImageError: 'Could not map image to block field', imageReplaceSuccess: 'Image replaced successfully', imageReplaceFailed: 'Failed to replace image', inlineEditFailed: 'Inline edit failed', aiContextLocked: 'AI Generation context locked to: {blockType}' },
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
})
