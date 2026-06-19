/**
 * Unit Tests: coerceVideoVariants — Backend video variant fallback
 * TC-IDs: TC-1266-01 → TC-1266-05
 * GH Issue: #1266 (Hero banner video variant missing URL fix)
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F01-ai-builder-variety.md
 *
 * Background: When a hero block has a video variant (split-video, video) but no videoUrl,
 * coerceVideoVariants() mutates it in-place to a safe non-media variant to prevent
 * "No video URL provided" placeholder from leaking onto generated public homepages.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'

type BlockLike = { [key: string]: unknown }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBlock(overrides: BlockLike = {}): BlockLike {
    return {
        blockType: 'hero',
        variant: 'split-video',
        headline: 'Test Headline',
        ...overrides,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266] coerceVideoVariants', () => {
    describe('TC-1266-01: split-video + no videoUrl → split-left', () => {
        it('mutates hero split-video to split-left when videoUrl is missing', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })

        it('mutates hero split-video to split-left when videoUrl is empty string', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: '' })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })

        it('mutates hero split-video to split-left when videoUrl is null', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: null })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })
    })

    describe('TC-1266-02: video + no videoUrl → fullscreen', () => {
        it('mutates hero video to fullscreen when videoUrl is missing', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'video', videoUrl: undefined })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('fullscreen')
        })

        it('mutates hero video to fullscreen when videoUrl is empty string', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'video', videoUrl: '' })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('fullscreen')
        })

        it('mutates hero video to fullscreen when videoUrl is null', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'video', videoUrl: null })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('fullscreen')
        })
    })

    describe('TC-1266-03: split-video + videoUrl set → unchanged', () => {
        it('does not mutate hero split-video when videoUrl is a valid string', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: 'https://example.com/video.mp4' })]
            const originalVariant = blocks[0].variant

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe(originalVariant)
            expect(blocks[0].variant).toBe('split-video')
        })

        it('does not mutate hero video when videoUrl is a valid string', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'video', videoUrl: 'https://example.com/video.mp4' })]
            const originalVariant = blocks[0].variant

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe(originalVariant)
            expect(blocks[0].variant).toBe('video')
        })

        it('does not mutate hero split-left (non-video variant) even without videoUrl', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-left', videoUrl: undefined })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })
    })

    describe('TC-1266-04: videoUrl with whitespace only → treated as missing', () => {
        it('mutates hero split-video to split-left when videoUrl is whitespace-only', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: '   ' })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })

        it('mutates hero video to fullscreen when videoUrl is whitespace-only', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'video', videoUrl: '\t\n' })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('fullscreen')
        })

        it('does not mutate when videoUrl has meaningful content with whitespace', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: ' https://example.com/video.mp4 ' })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video')
        })
    })

    describe('TC-1266-05: non-hero block with video variant → untouched', () => {
        it('does not mutate non-hero block type with split-video even without videoUrl', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 'content', variant: 'split-video', videoUrl: undefined },
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video')
        })

        it('does not mutate feature block with video variant even without videoUrl', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 'feature', variant: 'video', videoUrl: undefined },
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('video')
        })

        it('does not mutate gallery block with split-video variant even without videoUrl', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 'gallery', variant: 'split-video', videoUrl: null },
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video')
        })
    })

    describe('Integration: multiple blocks mixed', () => {
        it('mutates only hero blocks with missing videoUrl, leaves others untouched', () => {
            // Arrange
            const blocks: BlockLike[] = [
                makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined }),
                makeBlock({ blockType: 'hero', variant: 'video', videoUrl: 'https://example.com/vid.mp4' }),
                { blockType: 'content', variant: 'split-video', videoUrl: undefined },
                makeBlock({ blockType: 'hero', variant: 'split-left', videoUrl: undefined }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left') // Hero split-video → split-left
            expect(blocks[1].variant).toBe('video') // Hero video with URL unchanged
            expect(blocks[2].variant).toBe('split-video') // Non-hero untouched
            expect(blocks[3].variant).toBe('split-left') // Hero split-left (non-video) unchanged
        })

        it('handles empty blocks array without error', () => {
            // Arrange
            const blocks: BlockLike[] = []

            // Act & Assert
            expect(() => coerceVideoVariants(blocks)).not.toThrow()
        })

        it('handles blocks with missing blockType field', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { variant: 'split-video', videoUrl: undefined },
                makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video') // No blockType, untouched
            expect(blocks[1].variant).toBe('split-left') // Hero, mutated
        })

        it('handles blocks with non-string blockType field', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 123, variant: 'split-video', videoUrl: undefined },
                makeBlock({ blockType: 'hero', variant: 'video', videoUrl: undefined }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video') // Non-string blockType, untouched
            expect(blocks[1].variant).toBe('fullscreen') // Hero, mutated
        })

        it('handles blocks with missing variant field', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 'hero', videoUrl: undefined },
                makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBeUndefined() // No variant, skipped
            expect(blocks[1].variant).toBe('split-left') // Has variant, mutated
        })

        it('handles blocks with non-string variant field', () => {
            // Arrange
            const blocks: BlockLike[] = [
                { blockType: 'hero', variant: 999, videoUrl: undefined },
                makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe(999) // Non-string variant, skipped
            expect(blocks[1].variant).toBe('split-left') // String variant, mutated
        })
    })

    describe('Edge cases', () => {
        it('handles videoUrl as non-string type (number)', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: 123 })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left') // Non-string URL treated as missing
        })

        it('handles videoUrl as boolean false', () => {
            // Arrange
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: false })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
        })

        it('handles very long videoUrl string', () => {
            // Arrange
            const longUrl = 'https://example.com/' + 'a'.repeat(10000)
            const blocks: BlockLike[] = [makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: longUrl })]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-video')
        })

        it('preserves other block properties when mutating variant', () => {
            // Arrange
            const blocks: BlockLike[] = [
                makeBlock({
                    blockType: 'hero',
                    variant: 'split-video',
                    videoUrl: undefined,
                    headline: 'My Headline',
                    subheadline: 'Subtext',
                    image: { url: 'https://example.com/img.jpg' },
                }),
            ]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blocks[0].variant).toBe('split-left')
            expect(blocks[0].headline).toBe('My Headline')
            expect(blocks[0].subheadline).toBe('Subtext')
            expect(blocks[0].image).toEqual({ url: 'https://example.com/img.jpg' })
        })

        it('mutation is in-place (modifies original array)', () => {
            // Arrange
            const block = makeBlock({ blockType: 'hero', variant: 'split-video', videoUrl: undefined })
            const blocks: BlockLike[] = [block]
            const blockRef = blocks[0]

            // Act
            coerceVideoVariants(blocks)

            // Assert
            expect(blockRef.variant).toBe('split-left') // Same reference modified
            expect(blockRef).toBe(blocks[0])
        })
    })
})
