/**
 * Unit Tests: parseVideoUrl — GH-2062 video block Change Video
 * TC-IDs: TC-F01-VID-001 → TC-F01-VID-006
 * QA doc: docs/qa/F01-2062-video-block-change-video.md
 */
import { describe, it, expect } from 'vitest'
import { parseVideoUrl, buildBackgroundEmbedUrl } from '@/lib/video/parse-video-url'

const ID = 'dQw4w9WgXcQ'
const EMBED = `https://www.youtube.com/embed/${ID}`

describe('parseVideoUrl', () => {
    it('TC-F01-VID-001: watch?v=ID → youtube embed', () => {
        expect(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}`)).toEqual({ kind: 'youtube', id: ID, embedUrl: EMBED })
    })

    it('TC-F01-VID-002: &t=30s and m.youtube.com give a clean ID', () => {
        expect(parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&t=30s`)?.embedUrl).toBe(EMBED)
        expect(parseVideoUrl(`https://m.youtube.com/watch?v=${ID}`)?.embedUrl).toBe(EMBED)
    })

    it('TC-F01-VID-003: youtu.be/ID?si=… and shorts/ID', () => {
        expect(parseVideoUrl(`https://youtu.be/${ID}?si=abc123`)?.embedUrl).toBe(EMBED)
        expect(parseVideoUrl(`https://www.youtube.com/shorts/${ID}`)?.embedUrl).toBe(EMBED)
        expect(parseVideoUrl(`  ${EMBED}  `)?.embedUrl).toBe(EMBED)
    })

    it('TC-F01-VID-004: Vimeo links', () => {
        expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({ kind: 'vimeo', id: '123456789', embedUrl: 'https://player.vimeo.com/video/123456789' })
        expect(parseVideoUrl('https://player.vimeo.com/video/123')?.embedUrl).toBe('https://player.vimeo.com/video/123')
    })

    it('TC-F01-VID-004: keeps the privacy hash of unlisted Vimeo videos', () => {
        expect(parseVideoUrl('https://vimeo.com/123456789/abcdef1234')?.embedUrl).toBe('https://player.vimeo.com/video/123456789?h=abcdef1234')
        expect(parseVideoUrl('https://player.vimeo.com/video/123?h=abcdef1234')?.embedUrl).toBe('https://player.vimeo.com/video/123?h=abcdef1234')
        const bg = parseVideoUrl('https://vimeo.com/123/abcdef1234')
        if (!bg || bg.kind !== 'vimeo') throw new Error('expected vimeo')
        expect(buildBackgroundEmbedUrl(bg)).toBe('https://player.vimeo.com/video/123?h=abcdef1234&autoplay=1&muted=1&loop=1&background=1')
    })

    it.each([
        ['javascript scheme', 'javascript:alert(1)'],
        ['data scheme', 'data:text/html,<script>alert(1)</script>'],
        ['http youtube', `http://www.youtube.com/watch?v=${ID}`],
        ['unknown host', 'https://evil.example.com/embed/abc'],
        ['lookalike host', `https://youtube.com.evil.io/watch?v=${ID}`],
        ['empty', ''],
        ['whitespace', '   '],
        ['short ID', 'https://www.youtube.com/watch?v=abc'],
        ['no video id', 'https://www.youtube.com/'],
        ['non-numeric vimeo', 'https://vimeo.com/channels'],
        ['protocol-relative path', '//evil.example.com/x.mp4'],
        ['non-string', undefined],
    ])('TC-F01-VID-005: rejects %s', (_label, input) => {
        expect(parseVideoUrl(input)).toBeNull()
    })

    it('TC-F01-VID-006: accepts mp4/webm files (with query) and internal paths', () => {
        expect(parseVideoUrl('https://cdn.example.com/u1-clip-uuid.mp4?x=1')).toMatchObject({ kind: 'file' })
        expect(parseVideoUrl('https://cdn.example.com/a/clip.WEBM')).toMatchObject({ kind: 'file' })
        expect(parseVideoUrl('/api/media/file/clip.mp4')).toEqual({ kind: 'file', embedUrl: '/api/media/file/clip.mp4' })
        expect(parseVideoUrl('https://cdn.example.com/clip.mov')).toBeNull()
        expect(parseVideoUrl('/api/media/file/clip.png')).toBeNull()
    })

    it('TC-F01-VID-008: background embed URL uses a clean playlist ID', () => {
        const parsed = parseVideoUrl(`https://youtu.be/${ID}?si=abc`)
        if (!parsed || parsed.kind === 'file') throw new Error('expected iframe provider')
        const url = buildBackgroundEmbedUrl(parsed)
        expect(url).toContain(`playlist=${ID}`)
        expect(url).not.toContain('si=')
        expect(url).toContain('autoplay=1')
    })
})
