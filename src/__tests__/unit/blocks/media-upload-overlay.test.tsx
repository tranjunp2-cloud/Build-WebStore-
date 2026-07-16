/**
 * Unit Tests: MediaUploadOverlay — unified shared overlay component for image/video uploads
 * TC-IDs: TC-GH1381-UO-001 → TC-GH1381-UO-022
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F05-1381-gallery-change-image.md
 * GH-1381: Extracted from HeroMediaOverlay, now used across 10+ blocks (gallery, carousel, team, etc.)
 * valueShape: 'media' (object {id,url,alt}) vs 'url-group' (Payload group {url,alt} without id)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks (top-level, before imports) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
vi.mock('@/components/site-renderer/OwnerContext', () => ({
    useIsOwner: vi.fn(() => false),
}))

vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({
    useBlockEditCallback: vi.fn(() => null),
}))

vi.mock('@/hooks/use-upload-progress', () => ({
    useUploadProgress: vi.fn(),
}))

vi.mock('@/hooks/use-direct-upload', () => ({
    useDirectUpload: vi.fn(),
}))

vi.mock('@/lib/media/compress-image', () => ({
    compressImage: vi.fn(async (file: File) => file),
}))

// Toast is delivered via window.parent.postMessage from the preview iframe —
// spy on postMessage instead of mocking sonner directly.
const postMessageSpy = vi.fn()
Object.defineProperty(window, 'parent', { value: { postMessage: postMessageSpy }, writable: true })

// ── Imports (after mocks) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { useDirectUpload } from '@/hooks/use-direct-upload'

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const mockOnFieldChange = vi.fn()
const mockCallback = { blockIndex: 0, onFieldChange: mockOnFieldChange }

function makeFile(type: string, name = 'test.jpg'): File {
    return new File(['bytes'], name, { type })
}

// GH-1381: simulate the parent editor's apply/persist ACK (BLOCK_FIELD_CHANGE_RESULT)
// that gates the overlay's success/error toast.
function dispatchFieldChangeAck(blockIndex: number, field: string, ok: boolean, error?: string) {
    window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'BLOCK_FIELD_CHANGE_RESULT', blockIndex, field, ok, ...(error ? { error } : {}) },
    }))
}

let mockUpload: Mock
let mockDirectUpload: Mock

beforeEach(() => {
    vi.clearAllMocks()
    mockUpload = vi.fn()
    mockDirectUpload = vi.fn()
    vi.mocked(useUploadProgress).mockReturnValue({
        upload: mockUpload,
        progress: 0,
        isUploading: false,
        reset: vi.fn(),
    })
    vi.mocked(useDirectUpload).mockReturnValue({
        upload: mockDirectUpload,
        progress: 0,
        isUploading: false,
        reset: vi.fn(),
    })
})

// ── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('TC-GH1381-UO-001: non-owner passthrough', () => {
    it('renders children without overlay wrapper when isOwner=false', () => {
        vi.mocked(useIsOwner).mockReturnValue(false)
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
        const { container } = render(
            <MediaUploadOverlay field="image">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </MediaUploadOverlay>
        )
        expect(screen.getByTestId('child')).toBeTruthy()
        expect(container.querySelector('[data-media-overlay]')).toBeNull()
    })
})

describe('TC-GH1381-UO-002: owner but no callback passthrough', () => {
    it('renders children without overlay wrapper when callback is null', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
        const { container } = render(
            <MediaUploadOverlay field="image">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </MediaUploadOverlay>
        )
        expect(screen.getByTestId('child')).toBeTruthy()
        expect(container.querySelector('[data-media-overlay]')).toBeNull()
    })
})

describe('TC-GH1381-UO-003: owner + callback renders overlay', () => {
    it('renders wrapper div with data-media-overlay and Change Image button', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </MediaUploadOverlay>
        )
        expect(container.querySelector('[data-media-overlay]')).toBeTruthy()
        expect(screen.getByText('Change Image')).toBeTruthy()
    })
})

describe('TC-GH1381-UO-004: default positionClass is relative', () => {
    it('wrapper div contains "relative" when no positionClass passed', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image">
                <div />
            </MediaUploadOverlay>
        )
        const wrapper = container.querySelector('[data-media-overlay]') as HTMLElement
        expect(wrapper.className).toContain('relative')
    })
})

describe('TC-GH1381-UO-005: positionClass override', () => {
    it('wrapper uses custom positionClass instead of relative', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image" positionClass="absolute inset-0">
                <div />
            </MediaUploadOverlay>
        )
        const wrapper = container.querySelector('[data-media-overlay]') as HTMLElement
        expect(wrapper.className).toContain('absolute')
        expect(wrapper.className).toContain('inset-0')
    })
})

describe('TC-GH1381-UO-006: valueShape=media image upload sends {id,url,alt} to field root', () => {
    it('strips .url suffix and sends object payload for media relation', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 101, url: 'https://cdn/img.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="image.url" altText="Test alt" valueShape="media">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalledWith('image', { id: 101, url: 'https://cdn/img.jpg', alt: 'Test alt' })
        })
        // GH-1381: success toast now waits for the parent's apply/persist ACK
        expect(postMessageSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SHOW_TOAST' }),
            expect.any(String),
        )
        dispatchFieldChangeAck(0, 'image', true)
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'success', message: 'Image updated' },
                expect.any(String),
            )
        })
    })
})

describe('TC-GH1381-UO-020: parent NACK → error toast with reason', () => {
    it('shows error toast with parent-provided reason when ACK is ok=false', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 103, url: 'https://cdn/img.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="images.3.image" altText="Slot 4" valueShape="media">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalledWith('images.3.image', expect.objectContaining({ id: 103 }))
        })
        dispatchFieldChangeAck(0, 'images.3.image', false, 'Could not save the change — please try again')
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'error', message: 'Could not save the change — please try again' },
                expect.any(String),
            )
        })
        expect(postMessageSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SHOW_TOAST', variant: 'success' }),
            expect.any(String),
        )
    })
})

describe('TC-GH1381-UO-022: tap toggles the control (GH-1191 touch support)', () => {
    it('click on the wrapper shows the control, second click hides it, control clicks are ignored', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image" altText="alt">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </MediaUploadOverlay>
        )
        const wrapper = container.querySelector('[data-media-overlay]') as HTMLElement
        const controlLayer = wrapper.querySelector('[data-editor-control]') as HTMLElement
        expect(controlLayer.className).toContain('opacity-0')

        // Tap 1 (touch devices fire click without mouseenter) → control shows
        fireEvent.click(screen.getByTestId('child'))
        expect(controlLayer.className).toContain('opacity-100')

        // Click on the control itself (e.g. Change Image button) must NOT toggle it away
        fireEvent.click(screen.getByText('Change Image'))
        expect(controlLayer.className).toContain('opacity-100')

        // Tap 2 on the media → control hides again
        fireEvent.click(screen.getByTestId('child'))
        expect(controlLayer.className).toContain('opacity-0')
    })
})

describe('TC-GH1381-UO-021: ACK for a different field/block is ignored', () => {
    it('does not toast on mismatched BLOCK_FIELD_CHANGE_RESULT, toasts on the matching one', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 104, url: 'https://cdn/img.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="image" altText="alt" valueShape="media">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalled()
        })
        // Mismatched field and mismatched blockIndex — both ignored
        dispatchFieldChangeAck(0, 'backgroundImage', false, 'wrong field')
        dispatchFieldChangeAck(7, 'image', false, 'wrong block')
        expect(postMessageSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SHOW_TOAST' }),
            expect.any(String),
        )
        dispatchFieldChangeAck(0, 'image', true)
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'success', message: 'Image updated' },
                expect.any(String),
            )
        })
    })
})

describe('TC-GH1381-UO-007: valueShape=url-group image upload sends string to {field}.url', () => {
    it('sets only the .url subfield (as string) preserving siblings (alt/label)', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 102, url: 'https://cdn/before.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="beforeImage" altText="Before img" valueShape="url-group">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/png')] } })
        await waitFor(() => {
            // Only .url subfield is set as string (NOT an object, so alt/label not overwritten)
            expect(mockOnFieldChange).toHaveBeenCalledWith('beforeImage.url', 'https://cdn/before.jpg')
        })
    })
})

describe('TC-GH1381-UO-008: valueShape=url-group with .url already in field path', () => {
    it('does not double .url suffix', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 103, url: 'https://cdn/after.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="afterImage.url" altText="After img" valueShape="url-group">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/webp')] } })
        await waitFor(() => {
            // Already has .url, so call with field as-is (not afterImage.url.url)
            expect(mockOnFieldChange).toHaveBeenCalledWith('afterImage.url', 'https://cdn/after.jpg')
        })
    })
})

describe('TC-GH1381-UO-009: invalid image file type rejected', () => {
    it('calls toast.error and skips upload for PDF', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('application/pdf', 'doc.pdf')] } })
        expect(postMessageSpy).toHaveBeenCalledWith(
            { type: 'SHOW_TOAST', variant: 'error', message: 'Only JPG, PNG, and WebP images are supported' },
            expect.any(String),
        )
        expect(mockOnFieldChange).not.toHaveBeenCalled()
    })
})

describe('TC-GH1381-UO-010: invalid video file type rejected', () => {
    it('calls toast.error and skips upload for AVI video', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image" showVideoButton={true} videoField="videoUrl">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="video/mp4,video/webm"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('video/x-msvideo', 'old.avi')] } })
        expect(postMessageSpy).toHaveBeenCalledWith(
            { type: 'SHOW_TOAST', variant: 'error', message: 'Only MP4 and WebM videos are supported' },
            expect.any(String),
        )
        expect(mockOnFieldChange).not.toHaveBeenCalled()
    })
})

describe('TC-GH1381-UO-011: video upload waits for parent persistence', () => {
    it('updates the video only after a successful field-change ACK', async () => {
        // Arrange
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockDirectUpload.mockResolvedValue({ id: 201, url: 'https://cdn/video.mp4' })
        const onVideoUploaded = vi.fn()
        const { container } = render(
            <MediaUploadOverlay field="image" showVideoButton={true} videoField="videoUrl" onVideoUploaded={onVideoUploaded}>
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="video/mp4,video/webm"]') as HTMLInputElement

        // Act
        fireEvent.change(input, { target: { files: [makeFile('video/mp4')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalledWith('videoUrl', 'https://cdn/video.mp4')
        })
        expect(onVideoUploaded).not.toHaveBeenCalled()
        dispatchFieldChangeAck(0, 'videoUrl', true)

        // Assert
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'success', message: 'Video updated' },
                expect.any(String),
            )
        })
        expect(onVideoUploaded).toHaveBeenCalledWith('https://cdn/video.mp4')
    })

    it('shows an error and does not update the preview when the parent rejects the save', async () => {
        // Arrange
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockDirectUpload.mockResolvedValue({ id: 202, url: 'https://cdn/video.mp4' })
        const onVideoUploaded = vi.fn()
        const { container } = render(
            <MediaUploadOverlay field="image" showVideoButton={true} videoField="videoUrl" onVideoUploaded={onVideoUploaded}>
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="video/mp4,video/webm"]') as HTMLInputElement

        // Act
        fireEvent.change(input, { target: { files: [makeFile('video/mp4')] } })
        await waitFor(() => expect(mockOnFieldChange).toHaveBeenCalled())
        dispatchFieldChangeAck(0, 'videoUrl', false, 'Could not save the change')

        // Assert
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'error', message: 'Could not save the change' },
                expect.any(String),
            )
        })
        expect(onVideoUploaded).not.toHaveBeenCalled()
    })
})

describe('TC-GH1381-UO-012: showImageButton=false hides image upload', () => {
    it('renders only Change Video when showImageButton=false', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        render(
            <MediaUploadOverlay field="image" showImageButton={false} showVideoButton={true} videoField="videoUrl">
                <div />
            </MediaUploadOverlay>
        )
        expect(screen.queryByText('Change Image')).toBeNull()
        expect(screen.getByText('Change Video')).toBeTruthy()
    })
})

describe('TC-GH1381-UO-013: showVideoButton=false hides video upload', () => {
    it('renders only Change Image when showVideoButton=false', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        render(
            <MediaUploadOverlay field="image" showImageButton={true} showVideoButton={false}>
                <div />
            </MediaUploadOverlay>
        )
        expect(screen.getByText('Change Image')).toBeTruthy()
        expect(screen.queryByText('Change Video')).toBeNull()
    })
})

describe('TC-GH1381-UO-014: image upload callback fires onImageUploaded', () => {
    it('calls onImageUploaded after successful image upload', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 104, url: 'https://cdn/new-img.jpg' })
        const onImageUploaded = vi.fn()
        const { container } = render(
            <MediaUploadOverlay field="image" onImageUploaded={onImageUploaded}>
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(onImageUploaded).toHaveBeenCalledWith('https://cdn/new-img.jpg')
        })
    })
})

describe('TC-GH1381-UO-015: nested array field path (e.g., images.2.image)', () => {
    it('valueShape=media sends {id,url,alt} to full nested path', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 205, url: 'https://cdn/gallery-img.jpg' })
        const { container } = render(
            <MediaUploadOverlay field="images.2.image" altText="Gallery item" valueShape="media">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalledWith('images.2.image', { id: 205, url: 'https://cdn/gallery-img.jpg', alt: 'Gallery item' })
        })
    })
})

describe('TC-GH1381-UO-016: buttonPosition=top-center centers control', () => {
    it('control renders centered when buttonPosition="top-center"', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image" buttonPosition="top-center">
                <div />
            </MediaUploadOverlay>
        )
        const control = container.querySelector('[data-editor-control]') as HTMLElement
        expect(control.className).toContain('justify-center')
    })
})

describe('TC-GH1381-UO-017: buttonPosition=top-right positions right', () => {
    it('control renders right-aligned when buttonPosition="top-right" (default)', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <MediaUploadOverlay field="image" buttonPosition="top-right">
                <div />
            </MediaUploadOverlay>
        )
        const control = container.querySelector('[data-editor-control]') as HTMLElement
        expect(control.className).toContain('justify-end')
    })
})

describe('TC-GH1381-UO-018: upload progress updates when uploading', () => {
    it('shows progress bar and "Processing..." text during upload', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        vi.mocked(useUploadProgress).mockReturnValue({
            upload: vi.fn(),
            progress: 75,
            isUploading: true,
            reset: vi.fn(),
        })
        const { container } = render(
            <MediaUploadOverlay field="image">
                <div />
            </MediaUploadOverlay>
        )
        expect(screen.getByText('Uploading... 75%')).toBeTruthy()
        const progressBar = container.querySelector('[style*="width"]') as HTMLElement
        expect(progressBar).toBeTruthy()
    })
})

describe('TC-GH1381-UO-019: upload error shown via toast', () => {
    it('calls toast.error and shows failed upload message', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockRejectedValue(new Error('Network error'))
        const { container } = render(
            <MediaUploadOverlay field="image">
                <div />
            </MediaUploadOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                { type: 'SHOW_TOAST', variant: 'error', message: 'Network error' },
                expect.any(String),
            )
        })
    })
})
