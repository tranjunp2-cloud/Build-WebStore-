/**
 * Tests for OgImageEditor component (src/components/editor/og-image-editor.tsx)
 * TC-IDs: TC-F05-12-15, TC-F05-12-16, TC-F05-12-17, TC-F05-12-18, TC-F05-12-19
 * GH-1263: Fix — send numeric media ID (not URL string) to Payload upload field
 * GH-1284: Updated mocks — component now uses useUploadProgress (XHR) instead of uploadMediaAction
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                ogImageEditor: {
                    invalidFormat: 'Only JPG, PNG, or WebP images are accepted',
                    success: 'Social image uploaded',
                    error: 'Failed to upload image',
                    replace: 'Replace',
                    remove: 'Remove',
                    uploading: 'Uploading...',
                    clickToUpload: 'Click to upload social image',
                    hint: 'Recommended size: 1200 × 630 px (JPG, PNG, or WebP)',
                    alt: 'Social share image',
                },
            },
        },
        locale: 'en',
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('sonner', () => ({
    toast: {
        loading: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/lib/utils/image', () => ({
    processImageFile: vi.fn(),
}))

vi.mock('@/hooks/use-upload-progress', () => ({
    useUploadProgress: vi.fn(),
}))

import { OgImageEditor } from '@/components/editor/og-image-editor'
import { toast } from 'sonner'
import { processImageFile } from '@/lib/utils/image'
import { useUploadProgress } from '@/hooks/use-upload-progress'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeImageFile(name = 'photo.jpg', type = 'image/jpeg'): File {
    return new File(['content'], name, { type })
}

function triggerFileInput(input: HTMLInputElement, file: File): void {
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
}

// ── Tests ──────────────────────────────────────────────────────────────────

let mockUpload: Mock

describe('OgImageEditor (TC-F05-12-15 to TC-F05-12-19 / GH-1263)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpload = vi.fn()
        vi.mocked(useUploadProgress).mockReturnValue({
            upload: mockUpload,
            progress: 0,
            isUploading: false,
            reset: vi.fn(),
        })
        ;(processImageFile as Mock).mockResolvedValue(makeImageFile())
    })

    describe('TC-F05-12-17: Rendering states', () => {
        it('shows upload dropzone when currentOgImage is null', () => {
            render(<OgImageEditor currentOgImage={null} onOgImageChange={vi.fn()} />)

            expect(screen.getByText('Click to upload social image')).toBeInTheDocument()
            expect(screen.queryByAltText('Social preview')).not.toBeInTheDocument()
        })

        it('shows image preview with Replace/Remove when currentOgImage is set', () => {
            render(<OgImageEditor currentOgImage="https://cdn.example.com/og.jpg" onOgImageChange={vi.fn()} />)

            const img = screen.getByAltText('Social preview') as HTMLImageElement
            expect(img.src).toBe('https://cdn.example.com/og.jpg')
            expect(screen.getByText('Replace')).toBeInTheDocument()
            expect(screen.getByText('Remove')).toBeInTheDocument()
            expect(screen.queryByText('Click to upload social image')).not.toBeInTheDocument()
        })
    })

    describe('TC-F05-12-15: Upload → callback receives numeric mediaId + URL (GH-1263 core fix)', () => {
        it('calls onOgImageChange with (number, string) after successful upload', async () => {
            const onOgImageChange = vi.fn()
            mockUpload.mockResolvedValue({ id: 42, url: 'https://cdn.example.com/og.jpg', alt: 'og' })

            render(<OgImageEditor currentOgImage={null} onOgImageChange={onOgImageChange} />)

            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            triggerFileInput(input, makeImageFile())

            await waitFor(() => {
                expect(onOgImageChange).toHaveBeenCalledTimes(1)
            })

            const [mediaId, url] = onOgImageChange.mock.calls[0]
            expect(typeof mediaId).toBe('number')
            expect(mediaId).toBe(42)
            expect(url).toBe('https://cdn.example.com/og.jpg')
        })

        it('shows success toast after upload', async () => {
            mockUpload.mockResolvedValue({ id: 7, url: 'https://cdn.example.com/og.jpg' })

            render(<OgImageEditor currentOgImage={null} onOgImageChange={vi.fn()} />)
            triggerFileInput(document.querySelector('input[type="file"]') as HTMLInputElement, makeImageFile())

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Social image uploaded')
            })
        })
    })

    describe('TC-F05-12-16: Remove button clears image', () => {
        it('calls onOgImageChange(null, null) when Remove is clicked', () => {
            const onOgImageChange = vi.fn()
            render(<OgImageEditor currentOgImage="https://cdn.example.com/og.jpg" onOgImageChange={onOgImageChange} />)

            fireEvent.click(screen.getByText('Remove'))

            expect(onOgImageChange).toHaveBeenCalledTimes(1)
            expect(onOgImageChange).toHaveBeenCalledWith(null, null)
        })
    })

    describe('TC-F05-12-18: Invalid file format rejected before upload', () => {
        it('shows format error toast and does not call upload for PDF', async () => {
            const onOgImageChange = vi.fn()
            render(<OgImageEditor currentOgImage={null} onOgImageChange={onOgImageChange} />)

            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            triggerFileInput(input, new File(['data'], 'doc.pdf', { type: 'application/pdf' }))

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Only JPG, PNG, or WebP images are accepted')
            })

            expect(mockUpload).not.toHaveBeenCalled()
            expect(onOgImageChange).not.toHaveBeenCalled()
        })
    })

    describe('TC-F05-12-19: Upload returns no ID → error, callback not called', () => {
        it('shows error toast and does not call onOgImageChange when uploaded.id is missing', async () => {
            const onOgImageChange = vi.fn()
            mockUpload.mockResolvedValue({ url: 'https://cdn.example.com/og.jpg' })

            render(<OgImageEditor currentOgImage={null} onOgImageChange={onOgImageChange} />)
            triggerFileInput(document.querySelector('input[type="file"]') as HTMLInputElement, makeImageFile())

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Failed to upload image')
            })

            expect(onOgImageChange).not.toHaveBeenCalled()
        })

        it('shows error toast and does not call onOgImageChange when upload returns null', async () => {
            const onOgImageChange = vi.fn()
            mockUpload.mockResolvedValue(null)

            render(<OgImageEditor currentOgImage={null} onOgImageChange={onOgImageChange} />)
            triggerFileInput(document.querySelector('input[type="file"]') as HTMLInputElement, makeImageFile())

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Failed to upload image')
            })

            expect(onOgImageChange).not.toHaveBeenCalled()
        })
    })
})
