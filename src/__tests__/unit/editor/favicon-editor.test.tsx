/**
 * Unit Tests: FaviconEditor — format, size, and dimension validation
 * TC-IDs: TC-F05-FAV-01 → TC-F05-FAV-12
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F05-favicon-upload.md
 * GH-1320: favicon upload validation in global settings
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Top-level mocks (before imports) ──────────────────────────────────────

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                faviconEditor: {
                    success: 'Favicon updated',
                    error: 'Failed to upload favicon',
                    uploading: 'Uploading...',
                    clickToUpload: 'Click to upload',
                    altFavicon: 'Site Favicon',
                    remove: 'Remove',
                    replace: 'Replace',
                    invalidFormat: 'Only .ico, .png, .jpg, and .webp files are accepted',
                    tooLarge: 'File must be 500KB or smaller',
                    tooLargeWarning: 'Favicon is larger than 100KB — this may slow down browser tab loading',
                    tooSmall: 'Favicon must be at least 16×16px',
                    tooBig: 'Favicon must be 512×512px or smaller',
                    notSquare: 'A square favicon (1:1) is recommended — non-square images may appear distorted',
                },
            },
        },
        locale: 'en',
    }),
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('@/hooks/use-upload-progress', () => ({
    useUploadProgress: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────
import { FaviconEditor } from '@/components/editor/FaviconEditor'
import { toast } from 'sonner'
import { useUploadProgress } from '@/hooks/use-upload-progress'

// ── Image dimension mock ──────────────────────────────────────────────────
// Mutated per test to control what checkFaviconDimensions() resolves to
const mockDimensions = { width: 200, height: 200 }

// ── Upload mock ────────────────────────────────────────────────────────────
// Configured per-test via mockUpload.mockResolvedValue(...)
let mockUpload: Mock

// ── Helpers ───────────────────────────────────────────────────────────────

function makeFile(type: string, name: string, sizeBytes = 50 * 1024): File {
    return new File([new Uint8Array(sizeBytes)], name, { type })
}

function getFileInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[type="file"]') as HTMLInputElement
}

function triggerUpload(input: HTMLInputElement, file: File): void {
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    mockDimensions.width = 200
    mockDimensions.height = 200

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock Image constructor so checkFaviconDimensions resolves with mockDimensions
    vi.stubGlobal(
        'Image',
        class MockImage {
            width = 0
            height = 0
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            set src(_val: string) {
                this.width = mockDimensions.width
                this.height = mockDimensions.height
                setTimeout(() => this.onload?.(), 0)
            }
        },
    )

    // Set up useUploadProgress mock — upload fn configured per-test
    mockUpload = vi.fn()
    vi.mocked(useUploadProgress).mockReturnValue({
        upload: mockUpload,
        progress: 0,
        isUploading: false,
        reset: vi.fn(),
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TC-F05-FAV-01: ICO file accepted; dimension check skipped', () => {
    it('uploads ICO without running dimension validation', async () => {
        mockUpload.mockResolvedValue({ id: 1, url: 'https://cdn/favicon.ico' })
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/x-icon', 'favicon.ico', 50 * 1024))

        await waitFor(() => {
            expect(onFaviconChange).toHaveBeenCalledWith('https://cdn/favicon.ico')
        })
        expect(toast.success).toHaveBeenCalledWith('Favicon updated')
        expect(toast.error).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-04: PNG over 500KB → hard size reject', () => {
    it('shows tooLarge error and does not call upload', async () => {
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'favicon.png', 800 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('File must be 500KB or smaller')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-05: PNG 80KB, 200×200 → clean success (no warnings)', () => {
    it('uploads with neither size nor dimension warning', async () => {
        mockUpload.mockResolvedValue({ id: 2, url: 'https://cdn/favicon.png' })
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'favicon.png', 80 * 1024))

        await waitFor(() => {
            expect(onFaviconChange).toHaveBeenCalledWith('https://cdn/favicon.png')
        })
        expect(toast.warning).not.toHaveBeenCalled()
        expect(toast.error).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-06: PNG 150KB, 200×200 → soft size warning, upload proceeds', () => {
    it('shows tooLargeWarning then completes upload', async () => {
        mockUpload.mockResolvedValue({ id: 3, url: 'https://cdn/favicon.png' })
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'favicon.png', 150 * 1024))

        await waitFor(() => {
            expect(toast.warning).toHaveBeenCalledWith(
                'Favicon is larger than 100KB — this may slow down browser tab loading',
            )
        })
        await waitFor(() => {
            expect(onFaviconChange).toHaveBeenCalledWith('https://cdn/favicon.png')
        })
    })
})

describe('TC-F05-FAV-07: PNG with 8×8 dimensions → tooSmall reject', () => {
    it('shows tooSmall error and does not upload', async () => {
        mockDimensions.width = 8
        mockDimensions.height = 8
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'tiny.png', 10 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Favicon must be at least 16×16px')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-08: PNG with 1024×1024 dimensions → tooBig reject', () => {
    it('shows tooBig error and does not upload', async () => {
        mockDimensions.width = 1024
        mockDimensions.height = 1024
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'large.png', 80 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Favicon must be 512×512px or smaller')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-09: PNG 100×200 (non-square) → notSquare warning, upload proceeds', () => {
    it('shows notSquare warning then completes upload', async () => {
        mockDimensions.width = 100
        mockDimensions.height = 200
        mockUpload.mockResolvedValue({ id: 4, url: 'https://cdn/favicon.png' })
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/png', 'tall.png', 80 * 1024))

        await waitFor(() => {
            expect(toast.warning).toHaveBeenCalledWith(
                'A square favicon (1:1) is recommended — non-square images may appear distorted',
            )
        })
        await waitFor(() => {
            expect(onFaviconChange).toHaveBeenCalledWith('https://cdn/favicon.png')
        })
    })
})

describe('TC-F05-FAV-10: Text file disguised as PNG (text/plain) → format reject', () => {
    it('shows invalidFormat error and does not upload', async () => {
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('text/plain', 'favicon.png', 5 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Only .ico, .png, .jpg, and .webp files are accepted')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-11: GIF file → format reject', () => {
    it('shows invalidFormat error and does not upload', async () => {
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/gif', 'animated.gif', 50 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Only .ico, .png, .jpg, and .webp files are accepted')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})

describe('TC-F05-FAV-12: BMP file → format reject', () => {
    it('shows invalidFormat error and does not upload', async () => {
        const onFaviconChange = vi.fn()
        const { container } = render(<FaviconEditor currentFavicon={null} onFaviconChange={onFaviconChange} />)

        triggerUpload(getFileInput(container), makeFile('image/bmp', 'favicon.bmp', 50 * 1024))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Only .ico, .png, .jpg, and .webp files are accepted')
        })
        expect(mockUpload).not.toHaveBeenCalled()
        expect(onFaviconChange).not.toHaveBeenCalled()
    })
})
