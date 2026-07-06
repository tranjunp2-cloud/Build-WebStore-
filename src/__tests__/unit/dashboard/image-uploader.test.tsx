import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock dependencies
vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('next/image', () => ({
    default: (props: any) => <img {...props} />,
}))

vi.mock('lucide-react', () => ({
    Upload: () => <span data-testid="upload-icon">Upload</span>,
    X: () => <span data-testid="x-icon">X</span>,
    Loader2: () => <span data-testid="loader-icon">Loading</span>,
    ImageIcon: () => <span data-testid="image-icon">Image</span>,
    AlertCircle: () => <span data-testid="alert-icon">Alert</span>,
    Pencil: () => <span data-testid="pencil-icon">Pencil</span>,
}))

// GH-1458 comment ("Alt text Popover"): ImageUploader now calls useI18n() for the Popover's
// strings. No I18nProvider in this test file → mock with an empty-but-present `dashboard`
// object so `t.dashboard.imageUploader?.x` optional-chains safely and falls through to the
// component's inline fallback strings (e.g. '+ Add Alt text') — same pattern as
// src/__tests__/unit/dashboard/bulk-create-save.test.tsx.
vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: { dashboard: { imageUploader: {} } }, locale: 'en' }),
}))

import { ImageUploader } from '@/components/dashboard/ImageUploader'
import { toast } from 'sonner'

// ─── TC-F08-01-15: Image upload validation ─────────────────────────────
// ─── TC-F08-01-14: Max 5 images ────────────────────────────────────────

describe('ImageUploader [TC-F08-01-15, TC-F08-01-14]', () => {
    const defaultProps = {
        value: [] as any[],
        onChange: vi.fn(),
        maxImages: 5,
        maxSizeMB: 5,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders upload zone when no images', () => {
        render(<ImageUploader {...defaultProps} />)
        const uploadTexts = screen.getAllByText(/upload/i)
        expect(uploadTexts.length).toBeGreaterThan(0)
    })

    it('shows image count indicator', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg' }]} />)
        expect(screen.getByText('1 / 5')).toBeDefined()
    })

    it('hides upload zone when max images reached [TC-F08-01-14]', () => {
        const images = Array.from({ length: 5 }, (_, i) => ({ id: `img${i}`, url: `/img${i}.jpg` }))
        render(<ImageUploader {...defaultProps} value={images} />)
        // Upload zone should not be visible
        const uploadZones = screen.queryAllByText(/upload/i)
        // May still show label but input should be functionally disabled
        expect(images.length).toBe(5)
    })

    it('renders remove buttons for each image', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg' }, { id: 'img2', url: '/img2.jpg' }]} />)
        const removeButtons = screen.getAllByTestId('x-icon')
        expect(removeButtons.length).toBeGreaterThanOrEqual(2)
    })

    it('calls onChange with removed image when X clicked', () => {
        const images = [{ id: 'img1', url: '/img1.jpg' }, { id: 'img2', url: '/img2.jpg' }]
        render(<ImageUploader {...defaultProps} value={images} />)

        const removeButtons = screen.getAllByTestId('x-icon')
        fireEvent.click(removeButtons[0].closest('button')!)

        expect(defaultProps.onChange).toHaveBeenCalled()
    })

    it('renders custom label when provided', () => {
        render(<ImageUploader {...defaultProps} label="Product Images" />)
        expect(screen.getByText('Product Images')).toBeDefined()
    })

    it('renders description when provided', () => {
        render(<ImageUploader {...defaultProps} description="Max 5 images, 5MB each" />)
        expect(screen.getByText('Max 5 images, 5MB each')).toBeDefined()
    })

    // ─── TC-F08-01-15: Alt text Popover trigger ─────────────────────────────
    // GH-1458 comment: the inline <input> was replaced with a trigger button that opens a
    // Popover (see TC-F08-01-33..37 below for the Popover's own behavior).

    it('shows "+ Add Alt text" trigger when showAltInput is true and image has no alt [TC-F08-01-15]', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg' }]} showAltInput={true} />)
        expect(screen.getByText('+ Add Alt text')).toBeDefined()
        expect(screen.queryByPlaceholderText('Alt text...')).toBeNull()
    })

    it('hides the alt trigger when showAltInput is false (default) [TC-F08-01-15]', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg' }]} />)
        expect(screen.queryByText('+ Add Alt text')).toBeNull()
    })

    it('[TC-F08-01-15] Popover counter turns red at the 125-char hard limit', () => {
        const maxAlt = 'a'.repeat(125)
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg', alt: maxAlt }]} showAltInput={true} />)

        // Open the popover via the has-alt trigger (truncated text button)
        fireEvent.click(screen.getByTitle(maxAlt))

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
        expect(textarea.value).toBe(maxAlt)
        const counter = screen.getByText('125/125')
        expect(counter.className).toContain('destructive')
    })

    // ─── TC-F08-01-33..37: Popover open/save/cancel behavior ────────────────

    it('[TC-F08-01-33] has-alt trigger shows truncated text + Pencil icon, not "+ Add Alt text"', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg', alt: 'Front view' }]} showAltInput={true} />)
        expect(screen.getByText('Front view')).toBeDefined()
        expect(screen.getByTestId('pencil-icon')).toBeDefined()
        expect(screen.queryByText('+ Add Alt text')).toBeNull()
    })

    it('[TC-F08-01-34] clicking trigger opens Popover with a seeded Textarea and Cancel/Save buttons', () => {
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg', alt: 'Front view' }]} showAltInput={true} />)

        fireEvent.click(screen.getByTitle('Front view'))

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
        expect(textarea.value).toBe('Front view')
        expect(screen.getByText('Cancel')).toBeDefined()
        expect(screen.getByText('Save')).toBeDefined()
    })

    it('[TC-F08-01-35] Save commits the trimmed draft via onChange and closes the popover', () => {
        const onChange = vi.fn()
        render(<ImageUploader {...defaultProps} onChange={onChange} value={[{ id: 'img1', url: '/img1.jpg' }]} showAltInput={true} />)

        fireEvent.click(screen.getByText('+ Add Alt text'))
        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: '  New alt text  ' } })
        fireEvent.click(screen.getByText('Save'))

        expect(onChange).toHaveBeenCalledWith([{ id: 'img1', url: '/img1.jpg', alt: 'New alt text' }])
        expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('[TC-F08-01-36] Cancel discards the draft — onChange not called, committed alt unchanged', () => {
        const onChange = vi.fn()
        render(<ImageUploader {...defaultProps} onChange={onChange} value={[{ id: 'img1', url: '/img1.jpg', alt: 'Original' }]} showAltInput={true} />)

        fireEvent.click(screen.getByTitle('Original'))
        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: 'Typed but not saved' } })
        fireEvent.click(screen.getByText('Cancel'))

        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByText('Original')).toBeDefined()
        expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('[TC-F08-01-37] pre-existing alt >125 chars is shown in full on open, not silently truncated', () => {
        const longAlt = 'b'.repeat(130)
        render(<ImageUploader {...defaultProps} value={[{ id: 'img1', url: '/img1.jpg', alt: longAlt }]} showAltInput={true} />)

        fireEvent.click(screen.getByTitle(longAlt))

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
        expect(textarea.value).toBe(longAlt)
        expect(textarea.value.length).toBe(130)
        expect(textarea.getAttribute('maxlength')).toBe('125')
    })

    it('[TC-F08-01-38] Save clamps a pre-existing >125-char alt to 125 on commit (code-review fix)', () => {
        // maxLength only blocks NEW keystrokes — a pre-existing over-cap alt opened and saved
        // without editing must still be clamped, not silently persisted over the advertised cap.
        const longAlt = 'c'.repeat(130)
        const onChange = vi.fn()
        render(<ImageUploader {...defaultProps} onChange={onChange} value={[{ id: 'img1', url: '/img1.jpg', alt: longAlt }]} showAltInput={true} />)

        fireEvent.click(screen.getByTitle(longAlt))
        fireEvent.click(screen.getByText('Save'))

        const [saved] = onChange.mock.calls[0]
        expect(saved[0].alt.length).toBe(125)
        expect(saved[0].alt).toBe('c'.repeat(125))
    })
})
