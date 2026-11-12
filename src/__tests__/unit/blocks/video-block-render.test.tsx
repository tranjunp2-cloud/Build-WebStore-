/**
 * Component Tests: VideoBlock render + Change Video overlay (GH-2062)
 * TC-IDs: TC-F01-VID-007, TC-F01-VID-008, TC-F01-VID-009
 * QA doc: docs/qa/F01-2062-video-block-change-video.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/components/site-renderer/OwnerContext', () => ({ useIsOwner: vi.fn(() => false) }))
vi.mock('@/components/site-renderer/BuilderPreviewContext', () => ({ useIsBuilderPreview: vi.fn(() => false) }))
vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({ useBlockEditCallback: vi.fn(() => null) }))
vi.mock('@/hooks/use-upload-progress', () => ({ useUploadProgress: vi.fn(() => ({ upload: vi.fn(), progress: 0, isUploading: false })) }))
vi.mock('@/hooks/use-direct-upload', () => ({ useDirectUpload: vi.fn(() => ({ upload: vi.fn(), progress: 0, isUploading: false })) }))
vi.mock('@/lib/media/compress-image', () => ({ compressImage: vi.fn(async (f: File) => f) }))
vi.mock('../../../blocks/shared/animations', () => ({
    AnimatedSection: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

import { VideoBlock } from '@/blocks/video'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

const ID = 'dQw4w9WgXcQ'
const theme = {} as never
type Block = React.ComponentProps<typeof VideoBlock>['block']
const makeBlock = (over: Partial<Block>): Block => ({ blockType: 'video', variant: 'embed', videoUrl: '', ...over } as Block)

describe('VideoBlock', () => {
    beforeEach(() => {
        vi.mocked(useIsOwner).mockReturnValue(false)
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
    })

    it('TC-F01-VID-007: embed renders normalized iframe; invalid URL → placeholder, no iframe', () => {
        const { container, rerender } = render(<VideoBlock block={makeBlock({ videoUrl: `https://youtu.be/${ID}?si=x` })} theme={theme} />)
        expect(container.querySelector('iframe')?.getAttribute('src')).toBe(`https://www.youtube.com/embed/${ID}`)

        rerender(<VideoBlock block={makeBlock({ videoUrl: 'javascript:alert(1)' })} theme={theme} />)
        expect(container.querySelector('iframe')).toBeNull()
        expect(screen.getByText('Video unavailable')).toBeTruthy()

        rerender(<VideoBlock block={makeBlock({ videoUrl: '' })} theme={theme} />)
        expect(container.querySelector('iframe')).toBeNull()
    })

    it('TC-F01-VID-008: background uses clean playlist ID; mp4 renders muted looping <video>', () => {
        const { container, rerender } = render(<VideoBlock block={makeBlock({ variant: 'background', videoUrl: `https://youtu.be/${ID}?si=x` })} theme={theme} />)
        const src = container.querySelector('iframe')?.getAttribute('src') ?? ''
        expect(src).toContain(`playlist=${ID}`)
        expect(src).not.toContain('si=')

        rerender(<VideoBlock block={makeBlock({ variant: 'background', videoUrl: 'https://cdn.example.com/clip.mp4' })} theme={theme} />)
        const video = container.querySelector('video') as HTMLVideoElement
        expect(video.getAttribute('src')).toBe('https://cdn.example.com/clip.mp4')
        expect(video.muted).toBe(true)
        expect(video.loop).toBe(true)
        expect(container.querySelector('iframe')).toBeNull()
    })

    it.each(['embed', 'background'] as const)('TC-F01-VID-009: owner sees "Change Video" on %s; non-owner does not', (variant) => {
        const block = makeBlock({ variant, videoUrl: `https://youtu.be/${ID}` })
        const { unmount } = render(<VideoBlock block={block} theme={theme} />)
        expect(screen.queryByText(/Change Video/i)).toBeNull()
        unmount()

        vi.mocked(useIsOwner).mockReturnValue(true)
        vi.mocked(useBlockEditCallback).mockReturnValue({ blockIndex: 0, onFieldChange: vi.fn() })
        render(<VideoBlock block={block} theme={theme} />)
        expect(screen.getByText(/Change Video/i)).toBeTruthy()
        expect(screen.queryByText(/Change Image/i)).toBeNull()
    })
})
