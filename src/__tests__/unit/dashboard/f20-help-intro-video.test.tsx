// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { I18nProvider } from '@/i18n'
import { V2IntroVideo } from '@/components/dashboard/V2IntroVideo'
import { HelpIntroHero } from '@/components/help/HelpIntroHero'
import { V2_INTRO_MEDIA } from '@/components/dashboard/v2-intro-media'
import {
    V2_INTRO_PROGRESS_KEY,
    readIntroProgress,
    resumePoint,
} from '@/components/dashboard/v2-intro-progress'

const renderInline = () =>
    render(
        <I18nProvider defaultLocale="en">
            <V2IntroVideo variant="inline" />
        </I18nProvider>,
    )

const video = (c: HTMLElement) => c.querySelector('video') as HTMLVideoElement
const frame = () => screen.getByRole('button', { name: /Web Store overview tour/ })
const setDuration = (v: HTMLVideoElement, d: number) =>
    Object.defineProperty(v, 'duration', { value: d, configurable: true })

let ioCallback: IntersectionObserverCallback | null = null

describe('[US-F20-05] Help Center intro video (inline player)', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
            Object.defineProperty(this, 'paused', { value: false, configurable: true })
            this.dispatchEvent(new Event('play'))
            return Promise.resolve()
        })
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
            Object.defineProperty(this, 'paused', { value: true, configurable: true })
            this.dispatchEvent(new Event('pause'))
        })
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
        ioCallback = null
        vi.stubGlobal('IntersectionObserver', class {
            constructor(cb: IntersectionObserverCallback) { ioCallback = cb }
            observe() {}
            disconnect() {}
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('TC-F20-05-05: Welcome block renders copy + the onboarding video sources (no second player/media)', () => {
        // Arrange + Act
        const { container } = render(
            <I18nProvider defaultLocale="en">
                <HelpIntroHero />
            </I18nProvider>,
        )

        // Assert
        expect(screen.getByRole('heading', { name: 'Welcome to Web Store!' })).toBeInTheDocument()
        expect(screen.getByText('Watch the 2-minute video to quickly learn how to:')).toBeInTheDocument()
        expect(screen.getAllByRole('listitem')).toHaveLength(3)
        const sources = [...video(container).querySelectorAll('source')].map(s => s.getAttribute('src'))
        expect(sources).toEqual(V2_INTRO_MEDIA.sources.map(s => s.src))
    })

    it('TC-F20-05-05: lead line follows the real duration ("1-minute" singular)', () => {
        // Arrange
        const { container } = render(
            <I18nProvider defaultLocale="en">
                <HelpIntroHero />
            </I18nProvider>,
        )
        const v = video(container)

        // Act
        setDuration(v, 62)
        fireEvent.loadedMetadata(v)

        // Assert
        expect(screen.getByText('Watch the 1-minute video to quickly learn how to:')).toBeInTheDocument()
        expect(screen.getByText('1:02 min')).toBeInTheDocument()
    })

    it('TC-F20-05-06: idle shows cover with pulse + tag chip and hides the control bar', () => {
        // Arrange + Act
        renderInline()

        // Assert
        expect(screen.getByTestId('v2-intro-cover')).toBeInTheDocument()
        expect(screen.getByTestId('v2-intro-pulse')).toBeInTheDocument()
        expect(screen.getByText('Overview tour')).toBeInTheDocument()
        expect(screen.getByTestId('v2-intro-controls')).toHaveClass('opacity-0')
        expect(frame()).toHaveAttribute('aria-label', 'Play video: Web Store overview tour')
    })

    it('TC-F20-05-07: Space plays, K pauses, M mutes, arrows seek 5s on the focused frame', () => {
        // Arrange
        const { container } = renderInline()
        const v = video(container)
        setDuration(v, 160)
        fireEvent.loadedMetadata(v)
        // The frame's label changes with state — keep the element
        const f = frame()

        // Act + Assert
        fireEvent.keyDown(f, { key: ' ' })
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('v2-intro-cover')).not.toBeInTheDocument()

        fireEvent.keyDown(f, { key: 'k' })
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)

        fireEvent.keyDown(f, { key: 'm' })
        expect(v.muted).toBe(true)

        v.currentTime = 20
        fireEvent.keyDown(f, { key: 'ArrowRight' })
        expect(v.currentTime).toBe(25)
    })

    it('TC-F20-05-08: pausing mid-way saves progress; next visit offers Resume with a progress line', () => {
        // Arrange
        const first = renderInline()
        const v = video(first.container)
        setDuration(v, 160)
        fireEvent.loadedMetadata(v)
        fireEvent.click(frame())
        v.currentTime = 40

        // Act
        act(() => { v.pause() })
        first.unmount()
        const second = renderInline()
        const v2 = video(second.container)
        setDuration(v2, 160)
        fireEvent.loadedMetadata(v2)

        // Assert
        expect(readIntroProgress()).toEqual({ t: 40, done: false })
        expect(v2.currentTime).toBe(40)
        expect(screen.getByRole('button', { name: /^Resume video: Web Store overview tour/ })).toBeInTheDocument()
        expect(screen.getByTestId('v2-intro-resume-line')).toHaveStyle({ width: '25%' })
        expect(screen.queryByTestId('v2-intro-pulse')).not.toBeInTheDocument()
    })

    it('TC-F20-05-08: finished video is remembered as watched — Replay, no pulse', () => {
        // Arrange
        localStorage.setItem(V2_INTRO_PROGRESS_KEY, JSON.stringify({ t: 0, done: true }))

        // Act
        renderInline()

        // Assert
        expect(screen.getByRole('button', { name: 'Replay: Web Store overview tour' })).toBeInTheDocument()
        expect(screen.queryByTestId('v2-intro-pulse')).not.toBeInTheDocument()
    })

    it('TC-F20-05-08: resume point ignores the first 3s, the last second and finished videos', () => {
        expect(resumePoint({ t: 2, done: false }, 160)).toBe(0)
        expect(resumePoint({ t: 159.5, done: false }, 160)).toBe(0)
        expect(resumePoint({ t: 50, done: true }, 160)).toBe(0)
        expect(resumePoint({ t: 50, done: false }, 160)).toBe(50)
    })

    it('TC-F20-05-08: corrupted storage falls back to a fresh start', () => {
        localStorage.setItem(V2_INTRO_PROGRESS_KEY, '{not json')
        expect(readIntroProgress()).toEqual({ t: 0, done: false })
    })

    it('TC-F20-05-09: pauses once less than 25% of the frame is visible', () => {
        // Arrange
        const { container } = renderInline()
        const v = video(container)
        fireEvent.click(frame())

        // Act
        act(() => {
            ioCallback?.([{ intersectionRatio: 0.2 } as IntersectionObserverEntry], {} as IntersectionObserver)
        })

        // Assert
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
        expect(v.paused).toBe(true)
    })

    it('TC-F20-05-10: load error shows the message and Try again reloads the video', () => {
        // Arrange
        const { container } = renderInline()
        const v = video(container)

        // Act
        fireEvent.error(v)

        // Assert
        expect(screen.getByText('Couldn’t load the video.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Couldn’t load the video.')).not.toBeInTheDocument()
    })

    it('TC-F20-05-04: the popup (dialog) variant keeps its bar visible while idle and is not a frame button', () => {
        // Arrange + Act
        render(
            <I18nProvider defaultLocale="en">
                <V2IntroVideo />
            </I18nProvider>,
        )

        // Assert
        expect(screen.queryByTestId('v2-intro-cover')).not.toBeInTheDocument()
        expect(screen.getByTestId('v2-intro-controls')).toHaveClass('opacity-100')
        expect(screen.queryByRole('button', { name: /Web Store overview tour/ })).not.toBeInTheDocument()
    })
})
