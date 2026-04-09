import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviewFrame } from '@/components/editor/PreviewFrame'

vi.mock('@/store/editorStore', () => ({
    useEditorStore: vi.fn().mockReturnValue({
        blocks: [],
        updateBlock: vi.fn(),
    })
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
})
