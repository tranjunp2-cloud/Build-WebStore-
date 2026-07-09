/**
 * Unit Tests: updateValueAtPath — immutable deep-set for editor block data
 * TC-IDs: TC-GH1381-UVP-001 → TC-GH1381-UVP-008
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F05-1381-gallery-change-image.md
 *
 * GH-1381 QC re-test failure (issue comment 2026-07-03): replacing a gallery image
 * on a FALLBACK slot (block.images empty/shorter than the rendered slot) threw inside
 * the BLOCK_FIELD_CHANGED handler because updateValueAtPath could not write through
 * missing path segments — success toast fired but nothing was applied or saved.
 * The fix creates missing containers (array for numeric next segment, object
 * otherwise) and pads array gaps with {} items.
 */

import { describe, it, expect } from 'vitest'
import { updateValueAtPath } from '@/lib/editor/update-value-at-path'

const newImage = { id: 42, url: 'https://cdn/new.jpg', alt: 'new' }

describe('GH-1381: updateValueAtPath existing-path behavior (regression)', () => {
    // TC-GH1381-UVP-001 — original behavior preserved for paths that exist
    it('TC-GH1381-UVP-001: sets a nested value on an existing path', () => {
        const block = { images: [{ image: { id: 1, url: 'old' }, caption: 'c' }] }
        const next = updateValueAtPath(block, ['images', 0, 'image'], newImage)
        expect((next.images as Array<Record<string, unknown>>)[0]!.image).toEqual(newImage)
        expect((next.images as Array<Record<string, unknown>>)[0]!.caption).toBe('c')
    })

    // TC-GH1381-UVP-002 — immutability: source untouched
    it('TC-GH1381-UVP-002: does not mutate the source object', () => {
        const block = { images: [{ image: { id: 1, url: 'old' } }] }
        updateValueAtPath(block, ['images', 0, 'image'], newImage)
        expect((block.images[0]!.image as { id: number }).id).toBe(1)
    })

    // TC-GH1381-UVP-003 — top-level field set
    it('TC-GH1381-UVP-003: sets a top-level field', () => {
        const next = updateValueAtPath({ headline: 'a' }, ['headline'], 'b')
        expect(next.headline).toBe('b')
    })
})

describe('GH-1381: updateValueAtPath creates missing containers (QC re-test fix)', () => {
    // TC-GH1381-UVP-004 — THE QC bug: gallery with images:[] + fallback slot replace
    it('TC-GH1381-UVP-004: images=[] + write to images.0.image → creates the item', () => {
        const block = { blockType: 'gallery', images: [] as unknown[] }
        const next = updateValueAtPath(block, ['images', 0, 'image'], newImage)
        const images = next.images as Array<Record<string, unknown>>
        expect(images).toHaveLength(1)
        expect(images[0]!.image).toEqual(newImage)
    })

    // TC-GH1381-UVP-005 — missing array field entirely (generated site, all-fallback gallery)
    it('TC-GH1381-UVP-005: no images field + write to images.2.image → creates array + pads', () => {
        const block = { blockType: 'gallery' }
        const next = updateValueAtPath(block, ['images', 2, 'image'], newImage)
        const images = next.images as Array<Record<string, unknown>>
        expect(images).toHaveLength(3)
        expect(images[2]!.image).toEqual(newImage)
        // Gap slots are {} items (renderer falls back per-slot), not sparse holes/null
        expect(images[0]).toEqual({})
        expect(images[1]).toEqual({})
    })

    // TC-GH1381-UVP-006 — array shorter than target index, existing items preserved
    it('TC-GH1381-UVP-006: images has 1 item + write to images.3.image → pads, keeps item 0', () => {
        const block = { images: [{ image: { id: 1, url: 'keep' }, caption: 'first' }] }
        const next = updateValueAtPath(block, ['images', 3, 'image'], newImage)
        const images = next.images as Array<Record<string, unknown>>
        expect(images).toHaveLength(4)
        expect((images[0]!.image as { url: string }).url).toBe('keep')
        expect(images[3]!.image).toEqual(newImage)
    })

    // TC-GH1381-UVP-007 — missing object segment (string next key → object container)
    it('TC-GH1381-UVP-007: missing group segment → creates object container', () => {
        const block = { blockType: 'before-after' }
        const next = updateValueAtPath(block, ['beforeImage', 'url'], 'https://cdn/b.jpg')
        expect((next.beforeImage as Record<string, unknown>).url).toBe('https://cdn/b.jpg')
    })

    // TC-GH1381-UVP-008 — null segment replaced by container (slot padded as {image:null})
    it('TC-GH1381-UVP-008: null intermediate value → replaced with container', () => {
        const block = { images: [{ image: null, caption: 'c' }] }
        const next = updateValueAtPath(block, ['images', 0, 'image'], newImage)
        const images = next.images as Array<Record<string, unknown>>
        expect(images[0]!.image).toEqual(newImage)
        expect(images[0]!.caption).toBe('c')
    })
})
