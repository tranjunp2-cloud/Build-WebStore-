import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock dependencies
vi.mock('@/lib/htmlBuilder', () => ({
    buildFullHTML: vi.fn().mockReturnValue('<html><body>Preview</body></html>'),
}))
vi.mock('@/lib/preview', () => ({
    detectCategory: vi.fn().mockReturnValue('business'),
}))

import { PreviewFrame } from '@/components/editor/PreviewFrame'
import { buildFullHTML } from '@/lib/htmlBuilder'

const mockBuildFullHTML = vi.mocked(buildFullHTML)

// ─── TC-F05.01: Editor preview frame ──────────────────────────────────

describe('PreviewFrame', () => {
    const defaultProps = {
        siteName: 'Test Site',
        blocks: [{ blockType: 'hero', headline: 'Welcome' }],
        theme: { primaryColor: '#3B82F6' },
        isLoading: false,
    }

    it('renders loading skeleton when isLoading is true', () => {
        render(<PreviewFrame {...defaultProps} isLoading={true} />)
        expect(screen.getByText('Loading site...')).toBeInTheDocument()
        expect(screen.queryByTitle('Site Preview')).not.toBeInTheDocument()
    })

    it('renders iframe with srcdoc when not loading', () => {
        render(<PreviewFrame {...defaultProps} />)
        const iframe = screen.getByTitle('Site Preview') as HTMLIFrameElement
        expect(iframe).toBeInTheDocument()
        expect(iframe.getAttribute('srcdoc')).toContain('Preview')
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

    it('calls buildFullHTML with blocks, theme, category, and siteName', () => {
        render(<PreviewFrame {...defaultProps} />)
        expect(mockBuildFullHTML).toHaveBeenCalledWith(
            defaultProps.blocks,
            defaultProps.theme,
            'business',
            { name: 'Test Site' },
        )
    })
})
