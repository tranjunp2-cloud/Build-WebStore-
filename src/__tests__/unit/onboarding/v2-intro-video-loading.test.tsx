// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@/i18n'
import { V2IntroVideo } from '@/components/dashboard/V2IntroVideo'
import { V2_INTRO_MEDIA, bufferedFraction, canPreloadVideo } from '@/components/dashboard/v2-intro-media'

const renderPlayer = () =>
    render(
        <I18nProvider defaultLocale="en">
            <V2IntroVideo />
        </I18nProvider>,
    )

const video = (c: HTMLElement) => c.querySelector('video') as HTMLVideoElement
const setConnection = (value: unknown) =>
    Object.defineProperty(navigator, 'connection', { value, configurable: true })
const ranges = (list: Array<[number, number]>) =>
    ({ length: list.length, start: (i: number) => list[i][0], end: (i: number) => list[i][1] }) as TimeRanges

describe('[TC-F06.24] V2 intro video — loading strategy', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        // jsdom has no media playback
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
        setConnection(undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        setConnection(undefined)
    })

    it('TC-F06.24: lists AV1 WebM first and H.264 MP4 second, hashed file names', () => {
        // Arrange + Act
        const { container } = renderPlayer()

        // Assert
        const sources = [...video(container).querySelectorAll('source')]
        expect(sources.map(s => s.getAttribute('src'))).toEqual([V2_INTRO_MEDIA.webm, V2_INTRO_MEDIA.mp4])
        expect(sources[0].getAttribute('type')).toMatch(/^video\/webm/)
        expect(V2_INTRO_MEDIA.mp4).toMatch(/^\/videos\/v2-intro\.[0-9a-f]{8}\.mp4$/)
        expect(V2_INTRO_MEDIA.webm).toMatch(/^\/videos\/v2-intro\.[0-9a-f]{8}\.webm$/)
    })

    it('TC-F06.24: opens with preload=metadata, then buffers (auto) once the browser is idle', () => {
        // Arrange
        const { container } = renderPlayer()
        expect(video(container)).toHaveAttribute('preload', 'metadata')

        // Act
        act(() => { vi.advanceTimersByTime(1500) })

        // Assert
        expect(video(container)).toHaveAttribute('preload', 'auto')
    })

    it.each([
        ['Save-Data', { saveData: true, effectiveType: '4g' }],
        ['2G', { effectiveType: '2g' }],
        ['slow 2G', { effectiveType: 'slow-2g' }],
    ])('TC-F06.24: %s keeps preload=metadata until the user reaches for Play', (_label, connection) => {
        // Arrange
        setConnection(connection)
        const { container } = renderPlayer()

        // Act — idle passes, hover is not enough on a constrained link
        act(() => { vi.advanceTimersByTime(3000) })
        fireEvent.pointerEnter(screen.getByRole('button', { name: 'Play video' }))

        // Assert
        expect(video(container)).toHaveAttribute('preload', 'metadata')

        // Act — pressing Play is a clear intent
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Play video' }))

        // Assert
        expect(video(container)).toHaveAttribute('preload', 'auto')
    })

    it('TC-F06.24: hovering or focusing Play starts buffering on a normal connection', () => {
        // Arrange
        const { container } = renderPlayer()

        // Act
        fireEvent.focus(screen.getByRole('button', { name: 'Play video' }))

        // Assert
        expect(video(container)).toHaveAttribute('preload', 'auto')
    })

    it('TC-F06.24: canPreloadVideo honours Save-Data and 2G only', () => {
        expect(canPreloadVideo(null)).toBe(true)
        expect(canPreloadVideo({ effectiveType: '4g' })).toBe(true)
        expect(canPreloadVideo({ effectiveType: '3g' })).toBe(true)
        expect(canPreloadVideo({ saveData: true })).toBe(false)
        expect(canPreloadVideo({ effectiveType: '2g' })).toBe(false)
        expect(canPreloadVideo({ effectiveType: 'slow-2g' })).toBe(false)
    })
})

describe('[TC-F06.25] V2 intro video — loading states', () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-F06.25: shimmer covers the 16:9 frame until the poster has loaded', () => {
        // Arrange
        const { container } = renderPlayer()
        const poster = container.querySelector('picture img') as HTMLImageElement
        expect(screen.getByTestId('v2-intro-shimmer')).toBeInTheDocument()
        expect(container.querySelector('picture source')).toHaveAttribute('srcset', V2_INTRO_MEDIA.posterWebp)

        // Act
        fireEvent.load(poster)

        // Assert
        expect(screen.queryByTestId('v2-intro-shimmer')).not.toBeInTheDocument()
        expect(container.firstElementChild).toHaveClass('aspect-video')
    })

    it('TC-F06.25: Play without data shows the loading spinner; it hides on playing', () => {
        // Arrange — jsdom readyState is HAVE_NOTHING
        const { container } = renderPlayer()

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Play video' }))

        // Assert
        expect(screen.getByRole('status')).toHaveTextContent('Loading video…')

        // Act
        fireEvent.playing(video(container))

        // Assert
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('TC-F06.25: waiting/stalled during playback shows the spinner; canplay hides it', () => {
        // Arrange
        const { container } = renderPlayer()
        fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
        fireEvent.playing(video(container))

        // Act + Assert
        fireEvent.waiting(video(container))
        expect(screen.getByRole('status')).toBeInTheDocument()
        fireEvent.canPlay(video(container))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        fireEvent.stalled(video(container))
        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('TC-F06.25: background buffering before Play never shows the spinner', () => {
        // Arrange
        const { container } = renderPlayer()

        // Act
        fireEvent.waiting(video(container))
        fireEvent.stalled(video(container))

        // Assert
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('TC-F06.25: the seek bar shows the buffered range', () => {
        // Arrange
        const { container } = renderPlayer()
        const v = video(container)
        Object.defineProperty(v, 'duration', { value: 100, configurable: true })
        Object.defineProperty(v, 'buffered', { value: ranges([[0, 40]]), configurable: true })

        // Act
        fireEvent.progress(v)

        // Assert
        expect(screen.getByTestId('v2-intro-buffered')).toHaveStyle({ width: '40%' })
    })

    it('TC-F06.25: bufferedFraction follows the range that holds the playhead', () => {
        expect(bufferedFraction({ buffered: ranges([[0, 30], [60, 90]]), currentTime: 10, duration: 100 })).toBe(0.3)
        expect(bufferedFraction({ buffered: ranges([[0, 30], [60, 90]]), currentTime: 70, duration: 100 })).toBe(0.9)
        expect(bufferedFraction({ buffered: ranges([[0, 30]]), currentTime: 50, duration: 100 })).toBe(0)
        expect(bufferedFraction({ buffered: ranges([]), currentTime: 0, duration: NaN })).toBe(0)
    })

    it('TC-F06.16: "Video coming soon" only after every source failed; no spinner', () => {
        // Arrange
        const { container } = renderPlayer()
        fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
        expect(screen.queryByText('Video coming soon')).not.toBeInTheDocument()

        // Act — the MP4 is the last source
        fireEvent.error(container.querySelectorAll('video source')[1])

        // Assert
        expect(screen.getByText('Video coming soon')).toBeVisible()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})
