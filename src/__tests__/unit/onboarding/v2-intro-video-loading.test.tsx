// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@/i18n'
import { V2IntroVideo } from '@/components/dashboard/V2IntroVideo'
import { V2_INTRO_LARGE_SCREEN, V2_INTRO_MEDIA, bufferedFraction, canPreloadVideo } from '@/components/dashboard/v2-intro-media'

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

    it('TC-F06.24: 1080p for large screens first, 720p after it; H.264 MP4 with hashed names', () => {
        // Arrange + Act
        const { container } = renderPlayer()

        // Assert
        const sources = [...video(container).querySelectorAll('source')]
        expect(sources.map(s => [s.getAttribute('src'), s.getAttribute('media')])).toEqual([
            [expect.stringMatching(/^\/videos\/v2-intro-1080\.[0-9a-f]{8}\.mp4$/), V2_INTRO_LARGE_SCREEN],
            // No media on 720p: a browser that ignores `media` still lands on 1080p, never a soft 720p on desktop
            [expect.stringMatching(/^\/videos\/v2-intro-720\.[0-9a-f]{8}\.mp4$/), null],
        ])
        expect(sources.map(s => s.getAttribute('type'))).toEqual([
            'video/mp4; codecs="avc1.640028, mp4a.40.2"',
            'video/mp4; codecs="avc1.64001f, mp4a.40.2"',
        ])
        expect(V2_INTRO_LARGE_SCREEN).toBe('(min-width: 769px)')
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

        // Act — an earlier source failing is not the end: the browser moves on to the next one
        fireEvent.error(container.querySelectorAll('video source')[0])
        expect(screen.queryByText('Video coming soon')).not.toBeInTheDocument()
        // the 720p MP4 is the last source
        fireEvent.error([...container.querySelectorAll('video source')].at(-1)!)

        // Assert
        expect(screen.getByText('Video coming soon')).toBeVisible()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})

describe('[TC-F06.26] V2 intro video — controls stay off the subtitles', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    const controlBar = () => screen.getByTestId('v2-intro-controls')
    const playing = (c: HTMLElement) => {
        fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
        fireEvent.play(video(c))
    }

    it('TC-F06.26: while playing, the bar hides once the pointer rests on the video and comes back when it moves', () => {
        // Arrange
        const { container } = renderPlayer()
        playing(container)
        const player = container.firstElementChild as HTMLElement

        // Act — pointer moves over the video
        fireEvent.pointerMove(player)

        // Assert
        expect(controlBar()).toHaveClass('opacity-100')

        // Act — pointer rests
        act(() => { vi.advanceTimersByTime(2600) })

        // Assert
        expect(controlBar()).toHaveClass('opacity-0')

        // Act
        fireEvent.pointerMove(player)

        // Assert
        expect(controlBar()).toHaveClass('opacity-100')
    })

    it('TC-F06.26: the bar stays while the pointer or keyboard focus is on it, and always while paused', () => {
        // Arrange
        const { container } = renderPlayer()
        playing(container)
        const bar = controlBar()

        // Act — pointer on the bar
        fireEvent.pointerEnter(bar)
        fireEvent.pointerMove(bar)
        act(() => { vi.advanceTimersByTime(5000) })

        // Assert
        expect(bar).toHaveClass('opacity-100')

        // Act — pointer leaves, keyboard focus moves in
        fireEvent.pointerLeave(bar)
        act(() => { screen.getByRole('button', { name: 'Mute' }).focus() })
        act(() => { vi.advanceTimersByTime(5000) })

        // Assert
        expect(bar).toHaveClass('opacity-100')

        // Act — focus leaves, then playback pauses
        act(() => { screen.getByRole('button', { name: 'Mute' }).blur() })
        act(() => { vi.advanceTimersByTime(2600) })
        expect(bar).toHaveClass('opacity-0')
        fireEvent.pause(video(container))

        // Assert
        expect(bar).toHaveClass('opacity-100')
    })
})
