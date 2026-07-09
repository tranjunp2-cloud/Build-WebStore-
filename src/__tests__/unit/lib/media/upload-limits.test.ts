/**
 * Unit Tests: upload-limits — per-type media upload size guard
 * TC-IDs: TC-F30-HMO-011
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F30-hero-media-overlay.md
 * GH-1284: reject oversized uploads before they buffer into memory / hit the 120s timeout.
 */

import { describe, it, expect } from 'vitest'
import {
    UPLOAD_LIMITS,
    checkUploadSize,
    uploadKindFromMime,
    uploadLimitLabel,
} from '@/lib/media/upload-limits'

describe('TC-F30-HMO-011: upload size limits', () => {
    it('maps mime types to the correct kind', () => {
        expect(uploadKindFromMime('image/png')).toBe('image')
        expect(uploadKindFromMime('video/webm')).toBe('video')
        expect(uploadKindFromMime('video/mp4')).toBe('video')
        expect(uploadKindFromMime('application/pdf')).toBe('pdf')
        expect(uploadKindFromMime('application/zip')).toBeNull()
    })

    it('accepts files at or below the per-type limit', () => {
        expect(checkUploadSize('video/webm', UPLOAD_LIMITS.video)).toBeNull()
        expect(checkUploadSize('video/mp4', UPLOAD_LIMITS.video - 1)).toBeNull()
        expect(checkUploadSize('image/png', UPLOAD_LIMITS.image)).toBeNull()
    })

    it('rejects files above the per-type limit with a size message', () => {
        const err = checkUploadSize('video/webm', UPLOAD_LIMITS.video + 1)
        expect(err).toContain('too large')
        expect(err).toContain('100MB')
    })

    it('applies the image limit independently of the video limit', () => {
        // A 20MB file: over the 10MB image limit, under the 100MB video limit.
        const twentyMb = 20 * 1024 * 1024
        expect(checkUploadSize('image/jpeg', twentyMb)).toContain('too large')
        expect(checkUploadSize('video/mp4', twentyMb)).toBeNull()
    })

    it('does not size-gate unknown mime types (handled by the mimeTypes gate)', () => {
        expect(checkUploadSize('application/zip', 999 * 1024 * 1024)).toBeNull()
    })

    it('formats a human-readable limit label', () => {
        expect(uploadLimitLabel('video')).toBe('100MB')
        expect(uploadLimitLabel('image')).toBe('10MB')
    })
})
