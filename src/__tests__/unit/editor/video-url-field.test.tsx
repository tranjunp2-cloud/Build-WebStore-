/**
 * Component Tests: VideoUrlField — Block Settings Video URL input (GH-2062)
 * TC-IDs: TC-F01-VID-010
 * QA doc: docs/qa/F01-2062-video-block-change-video.md
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { VideoUrlField } from '@/components/editor/video-url-field'

const setup = (value = 'https://youtu.be/dQw4w9WgXcQ') => {
    const onChange = vi.fn()
    render(<VideoUrlField value={value} label="Video URL" placeholder="Paste" invalidMessage="Enter a valid link" onChange={onChange} />)
    return { onChange, input: screen.getByLabelText('Video URL') as HTMLInputElement }
}

describe('VideoUrlField', () => {
    it('TC-F01-VID-010: shows current link; valid link on blur calls onChange with trimmed value', () => {
        const { onChange, input } = setup()
        expect(input.value).toBe('https://youtu.be/dQw4w9WgXcQ')
        fireEvent.change(input, { target: { value: '  https://www.youtube.com/watch?v=abcdefghijk&t=30s ' } })
        fireEvent.blur(input)
        expect(onChange).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abcdefghijk&t=30s')
        expect(screen.queryByRole('alert')).toBeNull()
    })

    it('TC-F01-VID-010: invalid link shows inline error and never calls onChange; fixing it clears the error', () => {
        const { onChange, input } = setup()
        fireEvent.change(input, { target: { value: 'not a video link' } })
        fireEvent.blur(input)
        expect(screen.getByRole('alert').textContent).toBe('Enter a valid link')
        expect(onChange).not.toHaveBeenCalled()

        fireEvent.change(input, { target: { value: 'https://vimeo.com/123456' } })
        fireEvent.blur(input)
        expect(screen.queryByRole('alert')).toBeNull()
        expect(onChange).toHaveBeenCalledWith('https://vimeo.com/123456')
    })

    it('TC-F01-VID-010: prop change then blur without edit shows new value and does not call onChange', () => {
        const onChange = vi.fn()
        const props = { label: 'Video URL', placeholder: 'Paste', invalidMessage: 'Enter a valid link', onChange }
        const { rerender } = render(<VideoUrlField {...props} value="https://youtu.be/dQw4w9WgXcQ" />)
        const input = screen.getByLabelText('Video URL') as HTMLInputElement
        rerender(<VideoUrlField {...props} value="https://cdn.example.com/u1-clip.mp4" />)
        expect(input.value).toBe('https://cdn.example.com/u1-clip.mp4')
        fireEvent.focus(input)
        fireEvent.blur(input)
        expect(onChange).not.toHaveBeenCalled()
    })

    it('TC-F01-VID-010: blank value is invalid (videoUrl is required in Pages.ts): shows error, never calls onChange', () => {
        const { onChange, input } = setup()
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.blur(input)
        expect(screen.getByRole('alert')).toBeTruthy()
        expect(onChange).not.toHaveBeenCalled()
    })
})
