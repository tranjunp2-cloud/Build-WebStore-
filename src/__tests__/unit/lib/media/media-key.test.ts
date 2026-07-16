/**
 * Unit Tests: buildMediaKey — server-minted, collision-safe S3 key for direct
 * video upload (GH-1284). Key must be flat, sanitized, and never trust the
 * client's path or extension.
 * TC-IDs: TC-F30-HMO-013
 * QA doc: docs/qa/F30-hero-media-overlay.md
 */
import { describe, it, expect } from 'vitest'
import { buildMediaKey } from '@/lib/media/media-key'

describe('TC-F30-HMO-013: buildMediaKey sanitizes and scopes the S3 key', () => {
    it('strips directory components (path traversal) from the filename', () => {
        const key = buildMediaKey({ userId: 7, filename: '../../etc/passwd.mp4', mime: 'video/mp4' })
        expect(key).not.toContain('/')
        expect(key).not.toContain('..')
        expect(key.startsWith('u7-')).toBe(true)
        expect(key.endsWith('.mp4')).toBe(true)
    })

    it('takes the extension from the mime, not the original filename', () => {
        const key = buildMediaKey({ userId: 1, filename: 'clip.exe', mime: 'video/webm' })
        expect(key.endsWith('.webm')).toBe(true)
        expect(key).not.toContain('.exe')
    })

    it('lowercases and collapses unsafe chars in the base name', () => {
        const key = buildMediaKey({ userId: 1, filename: 'My Cool Video!!! (final).mp4', mime: 'video/mp4' })
        expect(key).toMatch(/^u1-my-cool-video-final-[0-9a-f-]{36}\.mp4$/)
    })

    it('prefixes with a sanitized userId so keys are traceable and scoped', () => {
        const key = buildMediaKey({ userId: 'abc-123', filename: 'v.mp4', mime: 'video/mp4' })
        expect(key.startsWith('uabc123-')).toBe(true)
    })

    it('generates a unique key each call (uuid suffix) even for identical input', () => {
        const a = buildMediaKey({ userId: 1, filename: 'v.mp4', mime: 'video/mp4' })
        const b = buildMediaKey({ userId: 1, filename: 'v.mp4', mime: 'video/mp4' })
        expect(a).not.toEqual(b)
    })

    it('falls back to "video" when the base name sanitizes to empty', () => {
        const key = buildMediaKey({ userId: 1, filename: '!!!.mp4', mime: 'video/mp4' })
        expect(key).toMatch(/^u1-video-[0-9a-f-]{36}\.mp4$/)
    })

    it('throws on unsupported mime', () => {
        expect(() => buildMediaKey({ userId: 1, filename: 'v.mov', mime: 'video/quicktime' })).toThrow()
    })
})
