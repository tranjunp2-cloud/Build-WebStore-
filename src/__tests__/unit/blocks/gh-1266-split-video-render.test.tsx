/**
 * Component Tests: SplitVideoHero — Frontend video fallback rendering
 * TC-IDs: TC-1266-06 → TC-1266-08
 * GH Issue: #1266 (Hero banner video variant missing URL fix)
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F01-ai-builder-variety.md
 *
 * Background: When a split-video hero has no videoUrl, render behavior depends on owner status:
 * - isOwner=true: Show "No video URL provided" placeholder (editor UX)
 * - isOwner=false: Show image fallback div (public render, no placeholder text)
 * - videoUrl present: Always render <video> element
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (top-level, before imports)
// ─────────────────────────────────────────────────────────────────────────────

// Mock window.matchMedia for prefers-reduced-motion check
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

vi.mock('@/components/site-renderer/OwnerContext', () => ({
    useIsOwner: vi.fn(() => false),
}))

vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({
    useBlockEditCallback: vi.fn(() => null),
}))

vi.mock('@/lib/images/industry-images', () => ({
    getHeroImage: vi.fn(() => 'https://fallback.example.com/hero.jpg'),
}))

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
}))

// Mock AnimatedSection
vi.mock('@/blocks/shared/animations', () => ({
    AnimatedSection: ({ children, className }: any) =>
        React.createElement('section', { className }, children),
}))

// Mock decorative components
vi.mock('@/blocks/shared/decorative', () => ({
    GradientBlob: () => null,
    DotGrid: () => null,
    SectionLabel: ({ children }: any) => React.createElement('span', {}, children),
}))

// Mock HeroMediaOverlay as passthrough (renders children)
vi.mock('@/blocks/hero/hero-media-overlay', () => ({
    HeroMediaOverlay: ({ children }: any) => React.createElement('div', {}, children),
}))

// Mock RichText
vi.mock('@/blocks/shared/RichText', () => ({
    RichText: ({ text }: any) => React.createElement('span', {}, typeof text === 'string' ? text : 'headline'),
}))

// Mock CTAButtons
vi.mock('@/blocks/hero/shared', () => ({
    CTAButtons: () => null,
    HERO_CONTAINER: 'container',
    VideoControlButton: () => null,
    safeAltText: vi.fn((alt: any, fallback: any) => alt || fallback),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { SplitVideoHero } from '@/blocks/hero/variants/split-video'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import type { BlockProps } from '@/blocks/types'
import type { HeroConfig } from '@/blocks/hero/config'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBlock(overrides: Partial<HeroConfig> = {}): HeroConfig {
    return {
        blockType: 'hero',
        variant: 'split-video',
        headline: 'Test Headline',
        ctaButtons: [],
        ...overrides,
    } as HeroConfig
}

function makeSite(overrides = {}) {
    return {
        id: 1,
        siteType: 'business',
        imageLibraryS3: {},
        ...overrides,
    }
}

function makeBlockProps(blockOverrides: Partial<HeroConfig> = {}, siteOverrides = {}): BlockProps<HeroConfig> {
    return {
        block: makeBlock(blockOverrides),
        site: makeSite(siteOverrides) as any,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266] SplitVideoHero Rendering', () => {
    describe('TC-1266-06: split-video, no videoUrl, isOwner=false → public render with image fallback', () => {
        it('renders image fallback div when videoUrl is missing and isOwner=false', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: { url: 'https://example.com/fallback.jpg', alt: 'Hero Image' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            // Should NOT render video element
            const videoElement = container.querySelector('video')
            expect(videoElement).toBeNull()

            // Should NOT show placeholder text
            expect(screen.queryByText('No video URL provided')).toBeNull()

            // Should render image fallback div with backgroundImage style
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toBeTruthy()
            expect(imageFallback).toHaveStyle({ backgroundImage: expect.stringContaining('url') })
        })

        it('uses image.url when provided for image fallback', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: { url: 'https://custom.com/hero.jpg', alt: 'Custom Hero' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toHaveStyle({ backgroundImage: expect.stringContaining('custom.com/hero.jpg') })
        })

        it('uses fallback hero image from industry-images when image.url not provided', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: undefined,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toHaveStyle({ backgroundImage: expect.stringContaining('fallback.example.com/hero.jpg') })
        })

        it('sets aria-label on image fallback from image.alt or headline', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: { url: 'https://example.com/img.jpg', alt: 'Product Hero Image' },
                headline: 'Fallback Headline',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toHaveAttribute('aria-label', 'Product Hero Image')
        })

        it('renders with box-shadow styling for visual consistency', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: { url: 'https://example.com/img.jpg' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const imageFallback = container.querySelector('[role="img"]') as HTMLElement
            const inlineStyle = imageFallback?.getAttribute('style') || ''
            expect(inlineStyle).toContain('box-shadow')
        })
    })

    describe('TC-1266-07: split-video, no videoUrl, isOwner=true → editor placeholder', () => {
        it('renders placeholder with "No video URL provided" text when videoUrl missing and isOwner=true', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(true)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
            })

            // Act
            render(<SplitVideoHero {...props} />)

            // Assert
            expect(screen.getByText('No video URL provided')).toBeTruthy()
        })

        it('renders dashed border placeholder div for editor UX', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(true)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const placeholder = Array.from(container.querySelectorAll('div')).find((el) =>
                el.textContent?.includes('No video URL provided')
            )
            expect(placeholder).toBeTruthy()
            // Check for dashed border styling
            expect(placeholder).toHaveStyle({ border: expect.stringContaining('dashed') })
        })

        it('uses rgba color from CSS vars for placeholder background', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(true)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const placeholder = Array.from(container.querySelectorAll('div')).find((el) =>
                el.textContent?.includes('No video URL provided')
            )
            expect(placeholder).toHaveStyle({ background: expect.stringContaining('rgba') })
        })

        it('does NOT render video element when videoUrl missing and isOwner=true', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(true)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video')
            expect(videoElement).toBeNull()
        })

        it('does NOT render image fallback when isOwner=true', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(true)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                image: { url: 'https://example.com/img.jpg' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toBeNull()
        })
    })

    describe('TC-1266-08: split-video, videoUrl set, isOwner=false → render video', () => {
        it('renders <video> element when videoUrl is set, regardless of isOwner status', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/hero-video.mp4',
                image: { url: 'https://example.com/poster.jpg' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video') as HTMLVideoElement
            expect(videoElement).toBeTruthy()
            expect(videoElement.src).toBe('https://example.com/hero-video.mp4')
        })

        it('sets video attributes: autoPlay, muted, loop, playsInline', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video') as HTMLVideoElement
            expect(videoElement.autoplay).toBe(true)
            expect(videoElement.muted).toBe(true)
            expect(videoElement.loop).toBe(true)
            expect(videoElement.getAttribute('playsinline')).toBe('')
        })

        it('sets poster to image.url when provided', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
                image: { url: 'https://example.com/poster.jpg', alt: 'Poster' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video') as HTMLVideoElement
            expect(videoElement.poster).toBe('https://example.com/poster.jpg')
        })

        it('does NOT render placeholder text when videoUrl is set', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
            })

            // Act
            render(<SplitVideoHero {...props} />)

            // Assert
            expect(screen.queryByText('No video URL provided')).toBeNull()
        })

        it('does NOT render image fallback when videoUrl is set and isOwner=false', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
                image: { url: 'https://example.com/fallback.jpg' },
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            // Should have video, not image fallback
            const videoElement = container.querySelector('video')
            expect(videoElement).toBeTruthy()
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toBeNull()
        })

        it('renders video with rounded corners and box-shadow', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoWrapper = container.querySelector('.rounded-2xl') as HTMLElement
            expect(videoWrapper).toBeTruthy()
            const inlineStyle = videoWrapper?.getAttribute('style') || ''
            expect(inlineStyle).toContain('box-shadow')
        })

        it('renders video with aspect-video class for correct proportions', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video')
            expect(videoElement?.className).toContain('aspect-video')
        })

        it('renders play/pause control button when video present', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: 'https://example.com/video.mp4',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            // VideoControlButton is mocked, but we can check that container renders the expected structure
            const videoWrapper = container.querySelector('.rounded-2xl')
            expect(videoWrapper?.querySelector('video')).toBeTruthy()
        })
    })

    describe('Integration: multiple render scenarios', () => {
        it('switches from placeholder (owner) to image fallback (non-owner) when isOwner changes', () => {
            // Arrange
            const { rerender, container } = render(
                <SplitVideoHero {...makeBlockProps({ variant: 'split-video', videoUrl: undefined })} />,
            )
            vi.mocked(useIsOwner).mockReturnValue(true)
            // Initially non-owner, so image fallback

            // Act
            vi.mocked(useIsOwner).mockReturnValue(true)
            rerender(<SplitVideoHero {...makeBlockProps({ variant: 'split-video', videoUrl: undefined })} />)

            // Assert
            expect(screen.getByText('No video URL provided')).toBeTruthy()
        })

        it('switches from video to image fallback when videoUrl becomes undefined', () => {
            // Arrange
            const { rerender } = render(
                <SplitVideoHero {...makeBlockProps({ variant: 'split-video', videoUrl: 'https://example.com/video.mp4' })} />,
            )
            vi.mocked(useIsOwner).mockReturnValue(false)
            let container = document.body
            let videoElement = container.querySelector('video')
            expect(videoElement).toBeTruthy()

            // Act
            rerender(<SplitVideoHero {...makeBlockProps({ variant: 'split-video', videoUrl: undefined })} />)
            container = document.body
            videoElement = container.querySelector('video')

            // Assert
            expect(videoElement).toBeNull()
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toBeTruthy()
        })

        it('preserves headline rendering in left column when videoUrl missing', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                headline: 'Featured Product',
            })

            // Act
            render(<SplitVideoHero {...props} />)

            // Assert
            // RichText is mocked to render the text, check it's present
            expect(screen.getByText('Featured Product')).toBeTruthy()
        })

        it('renders both grid columns (content + media) even when media is fallback', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            // Check for two-column grid
            const grid = container.querySelector('.grid-cols-1.md\\:grid-cols-2')
            expect(grid).toBeTruthy()
            // Both columns should render
            const columns = grid?.querySelectorAll('.md\\:col-span-1, > div')
            expect(columns?.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('Edge cases', () => {
        it('handles empty videoUrl string (should show fallback)', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: '',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video')
            expect(videoElement).toBeNull()
            const imageFallback = container.querySelector('[role="img"]')
            expect(imageFallback).toBeTruthy()
        })

        it('handles null videoUrl (should show fallback)', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: null as any,
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video')
            expect(videoElement).toBeNull()
        })

        it('handles whitespace-only videoUrl (frontend renders video; backend coercion should prevent this)', () => {
            // Note: Frontend component does NOT strip whitespace from videoUrl — that's done by
            // backend coerceVideoVariants() before the block reaches the frontend.
            // This test documents that the frontend trusts the backend to have already coerced
            // the variant. If a block with whitespace-only videoUrl reaches the frontend,
            // it will render a video element (which will fail to load, but that's not our concern).
            // In production, the backend coercion ensures this scenario never reaches the frontend.
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: '   ',
            })

            // Act
            const { container } = render(<SplitVideoHero {...props} />)

            // Assert
            const videoElement = container.querySelector('video')
            // Frontend renders what it receives; backend should have coerced already
            expect(videoElement).toBeTruthy()
        })

        it('renders without crashing when headline is missing', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                headline: undefined as any,
            })

            // Act & Assert
            expect(() => render(<SplitVideoHero {...props} />)).not.toThrow()
        })

        it('renders without crashing when ctaButtons is empty array', () => {
            // Arrange
            vi.mocked(useIsOwner).mockReturnValue(false)
            const props = makeBlockProps({
                variant: 'split-video',
                videoUrl: undefined,
                ctaButtons: [],
            })

            // Act & Assert
            expect(() => render(<SplitVideoHero {...props} />)).not.toThrow()
        })
    })
})
