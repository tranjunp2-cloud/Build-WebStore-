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

import { describe, it, expect } from 'vitest'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'
import { PAGES_SCHEMA } from '@/lib/ai/pages-schema'
import { enforcePageVariety } from '@/lib/ai/page-variety'

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

    describe('TC-1266-07: generate-site multi-page path — result.pages[].blocks coerced', () => {
        it('coerces blocks in each page bucket as done in generate-site multi-page loop', () => {
            // Arrange — simulate result.pages[] as returned by the AI generator
            const pages: Array<{ blocks: BlockLike[] }> = [
                { blocks: [{ blockType: 'navigation', variant: 'default' }, { blockType: 'hero', variant: 'split-video' }] },
                { blocks: [{ blockType: 'hero', variant: 'video' }, { blockType: 'footer', variant: 'default' }] },
            ]

            // Act — same loop that generate-site/route.ts now applies (GH-1266 multi-page fix)
            for (const page of pages) {
                coerceVideoVariants(page.blocks)
            }

            // Assert
            expect(pages[0]!.blocks[1]!.variant).toBe('split-left')  // split-video → split-left
            expect(pages[1]!.blocks[0]!.variant).toBe('fullscreen')  // video → fullscreen
            expect(pages[0]!.blocks[0]!.variant).toBe('default')     // nav untouched
            expect(pages[1]!.blocks[1]!.variant).toBe('default')     // footer untouched
        })
    })

    describe('TC-1266-08: PAGES_SCHEMA excludes video hero variants (GH-1266 root prevention)', () => {
        it('does not include video in PAGES_SCHEMA.hero.values', () => {
            expect(PAGES_SCHEMA['hero']?.values).not.toContain('video')
        })
        it('does not include split-video in PAGES_SCHEMA.hero.values', () => {
            expect(PAGES_SCHEMA['hero']?.values).not.toContain('split-video')
        })
    })

    describe('TC-1266-09: page-variety variant cycle excludes video hero variants (GH-1266 root prevention)', () => {
        it('hero variant swap from enforcePageVariety never produces video or split-video', () => {
            // Arrange: two identical pages → 100% overlap → forces variant swap on hero block
            const makeLayout = () => [
                { blockType: 'navigation', variant: 'default' },
                { blockType: 'hero', variant: 'fullscreen' },
                { blockType: 'footer', variant: 'default' },
            ]
            const pages = [{ layout: makeLayout() }, { layout: makeLayout() }] as any[]

            // Act
            const result = enforcePageVariety(pages)

            // Assert: swapped hero variant is safe (not video/split-video)
            const swappedHero = result[1].layout.find((b: any) => b.blockType === 'hero')
            expect(swappedHero?.variant).not.toBe('video')
            expect(swappedHero?.variant).not.toBe('split-video')
        })
    })

    describe('TC-1266-06: apply-template context — split-video without videoUrl coerced', () => {
        it('coerces template blocks as used in apply-template route (no videoUrl → split-left)', () => {
            // Arrange — simulate template blocks loaded from DB in apply-template/route.ts
            const templateBlocks: BlockLike[] = [
                { blockType: 'navigation', variant: 'default' },
                { blockType: 'hero', variant: 'split-video' }, // no videoUrl
                { blockType: 'features', variant: 'grid-3' },
            ]

            // Act — same call that apply-template/route.ts makes (GH-1266)
            coerceVideoVariants(templateBlocks)

            // Assert
            expect(templateBlocks[1]!.variant).toBe('split-left') // hero coerced
            expect(templateBlocks[0]!.variant).toBe('default')    // nav untouched
            expect(templateBlocks[2]!.variant).toBe('grid-3')     // features untouched
        })
    })
})
