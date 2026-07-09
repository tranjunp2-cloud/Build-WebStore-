/**
 * Unit Tests: HeroMediaOverlay — inline image/video edit overlay
 * TC-IDs: TC-F30-HMO-001 → TC-F30-HMO-009
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F30-hero-media-overlay.md
 * GH-1284: Updated mocks — component now uses useUploadProgress (XHR) instead of uploadMediaAction
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

vi.mock('@/lib/media/compress-image', () => ({
    compressImage: vi.fn(async (file: File) => file),
}))

// Toast is delivered via window.parent.postMessage from the preview iframe —
// spy on postMessage instead of mocking sonner directly.
const postMessageSpy = vi.fn()
Object.defineProperty(window, 'parent', { value: { postMessage: postMessageSpy }, writable: true })

// ── Imports (after mocks) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { HeroMediaOverlay } from '@/blocks/hero/hero-media-overlay'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'
import { useUploadProgress } from '@/hooks/use-upload-progress'

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const mockOnFieldChange = vi.fn()
const mockCallback = { blockIndex: 0, onFieldChange: mockOnFieldChange }

function makeFile(type: string, name = 'photo.jpg'): File {
    return new File(['bytes'], name, { type })
}

let mockUpload: Mock

beforeEach(() => {
    vi.clearAllMocks()
    mockUpload = vi.fn()
    vi.mocked(useUploadProgress).mockReturnValue({
        upload: mockUpload,
        progress: 0,
        isUploading: false,
        reset: vi.fn(),
    })
})

// ── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('TC-F30-HMO-001: non-owner passthrough', () => {
    it('renders children without overlay wrapper when isOwner=false', () => {
        vi.mocked(useIsOwner).mockReturnValue(false)
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
        const { container } = render(
            <HeroMediaOverlay field="image.url">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </HeroMediaOverlay>
        )
        expect(screen.getByTestId('child')).toBeTruthy()
        expect(container.querySelector('[class*="group/media-overlay"]')).toBeNull()
    })
})

describe('TC-F30-HMO-002: owner but no callback passthrough', () => {
    it('renders children without overlay wrapper when callback is null', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
        const { container } = render(
            <HeroMediaOverlay field="image.url">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </HeroMediaOverlay>
        )
        expect(screen.getByTestId('child')).toBeTruthy()
        expect(container.querySelector('[class*="group/media-overlay"]')).toBeNull()
    })
})

describe('TC-F30-HMO-003: owner + callback renders overlay', () => {
    it('renders wrapper div with group/media-overlay and Change Image button', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url">
                <img data-testid="child" src="/img.jpg" alt="test" />
            </HeroMediaOverlay>
        )
        expect(container.querySelector('[class*="group/media-overlay"]')).toBeTruthy()
        expect(screen.getByText('Change Image')).toBeTruthy()
    })
})

describe('TC-F30-HMO-004: positionClass defaults to relative', () => {
    it('wrapper div contains "relative" when no positionClass passed', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url">
                <div />
            </HeroMediaOverlay>
        )
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.className).toContain('relative')
        expect(wrapper.className).not.toContain('absolute')
    })
})

describe('TC-F30-HMO-005: positionClass override', () => {
    it('wrapper uses positionClass instead of relative', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url" positionClass="absolute inset-0">
                <div />
            </HeroMediaOverlay>
        )
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.className).toContain('absolute')
        expect(wrapper.className).toContain('inset-0')
        expect(wrapper.className).not.toContain('relative')
    })
})

describe('TC-F30-HMO-006: invalid file type rejected', () => {
    it('calls toast.error and skips upload for PDF', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url">
                <div />
            </HeroMediaOverlay>
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

describe('TC-F30-HMO-007: valid image upload triggers onFieldChange', () => {
    it('strips .url suffix, calls onFieldChange with hydrated object {id,url}, shows success toast', async () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        mockUpload.mockResolvedValue({ id: 101, url: 'https://cdn/img.jpg' })
        const { container } = render(
            <HeroMediaOverlay field="image.url" altText="Hero image">
                <div />
            </HeroMediaOverlay>
        )
        const input = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [makeFile('image/jpeg')] } })
        await waitFor(() => {
            expect(mockOnFieldChange).toHaveBeenCalledWith('image', { id: 101, url: 'https://cdn/img.jpg', alt: 'Hero image' })
        })
        expect(postMessageSpy).toHaveBeenCalledWith(
            { type: 'SHOW_TOAST', variant: 'success', message: 'Image updated' },
            expect.any(String),
        )
    })
})

describe('TC-F30-HMO-008: showVideoButton renders Change Video button', () => {
    it('shows both Change Image and Change Video when showVideoButton=true', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        render(
            <HeroMediaOverlay field="image.url" showVideoButton={true} videoField="videoUrl">
                <div />
            </HeroMediaOverlay>
        )
        expect(screen.getByText('Change Image')).toBeTruthy()
        expect(screen.getByText('Change Video')).toBeTruthy()
    })
})

describe('TC-F30-HMO-009: Change Video triggers video file input', () => {
    it('renders video file input accepting mp4/webm when showVideoButton=true', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url" showVideoButton={true} videoField="videoUrl">
                <div />
            </HeroMediaOverlay>
        )
        const videoInput = container.querySelector('input[accept="video/mp4,video/webm"]') as HTMLInputElement
        expect(videoInput).toBeTruthy()
        expect(videoInput.type).toBe('file')
    })
})

describe('TC-F30-HMO-010: showImageButton=false hides Change Image button', () => {
    it('shows only Change Video when showImageButton=false and showVideoButton=true (video hero)', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        render(
            <HeroMediaOverlay field="image.url" showImageButton={false} showVideoButton={true} videoField="videoUrl">
                <div />
            </HeroMediaOverlay>
        )
        expect(screen.queryByText('Change Image')).toBeNull()
        expect(screen.getByText('Change Video')).toBeTruthy()
    })
})

describe('TC-F30-HMO-012: oversized video rejected before upload (GH-1284)', () => {
    it('shows an error toast and does NOT call upload when the video exceeds the size limit', () => {
        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue(mockCallback)
        const { container } = render(
            <HeroMediaOverlay field="image.url" showVideoButton={true} videoField="videoUrl">
                <div />
            </HeroMediaOverlay>
        )
        const videoInput = container.querySelector('input[accept="video/mp4,video/webm"]') as HTMLInputElement
        // 101MB webm — one byte over the 100MB video limit.
        const bigVideo = makeFile('video/webm', 'huge.webm')
        Object.defineProperty(bigVideo, 'size', { value: 101 * 1024 * 1024 })

        fireEvent.change(videoInput, { target: { files: [bigVideo] } })

        expect(mockUpload).not.toHaveBeenCalled()
        expect(postMessageSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SHOW_TOAST', variant: 'error', message: expect.stringContaining('too large') }),
            expect.anything(),
        )
    })
})
