import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviewFrame } from '@/components/editor/PreviewFrame'

describe('PreviewFrame', () => {
    // ── Loading state ────────────────────────────────────────────────────

    it('renders loading skeleton when isLoading is true', () => {
        // Arrange & Act
        render(<PreviewFrame siteId="site-1" iframeKey={1} isLoading={true} />)

        // Assert
        expect(screen.getByText('Loading site...')).toBeInTheDocument()
        expect(screen.queryByTitle('Site Preview')).not.toBeInTheDocument()
    })

    // ── Iframe rendering ─────────────────────────────────────────────────

    it('renders iframe with correct src when not loading', () => {
        // Arrange & Act
        render(<PreviewFrame siteId="site-1" iframeKey={42} isLoading={false} />)

        // Assert
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe).toBeInTheDocument()
        expect(iframe.src).toContain('/api/preview/site-1?v=42')
    })

    it('renders iframe with different siteId', () => {
        // Arrange & Act
        render(<PreviewFrame siteId="my-site-abc" iframeKey={5} isLoading={false} />)

        // Assert
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe.src).toContain('/api/preview/my-site-abc?v=5')
    })

    it('updates iframe when iframeKey changes', () => {
        // Arrange
        const { rerender } = render(
            <PreviewFrame siteId="site-1" iframeKey={1} isLoading={false} />
        )

        // Act
        rerender(<PreviewFrame siteId="site-1" iframeKey={2} isLoading={false} />)

        // Assert
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe.src).toContain('/api/preview/site-1?v=2')
    })

    it('switches from loading to iframe when isLoading changes', () => {
        // Arrange
        const { rerender } = render(
            <PreviewFrame siteId="site-1" iframeKey={1} isLoading={true} />
        )
        expect(screen.getByText('Loading site...')).toBeInTheDocument()

        // Act
        rerender(<PreviewFrame siteId="site-1" iframeKey={1} isLoading={false} />)

        // Assert
        expect(screen.queryByText('Loading site...')).not.toBeInTheDocument()
        expect(screen.getByTitle('Site Preview')).toBeInTheDocument()
    })

    it('iframe has no border', () => {
        // Arrange & Act
        render(<PreviewFrame siteId="site-1" iframeKey={1} isLoading={false} />)

        // Assert
        const iframe = screen.getByTitle('Site Preview')
        expect(iframe.className).toContain('border-0')
    })
})
