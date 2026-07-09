/**
 * Unit Tests: structural block fields — site-wide fields must never be
 * shadowed by locale slots (hero "Change Video" variant-revert bug).
 * TC-IDs: TC-F26-10-01 → TC-F26-10-04
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F26-project-content-localization.md
 *
 * Bug: on a vi-generated site (Sites.locale can only be en/ms), picking the
 * hero "video" variant wrote it only into localeOverrides['vi']; the next
 * render from the flat block reverted the canvas to the old variant while the
 * settings tab kept showing "video".
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore, type BlockData } from '@/store/editorStore'
import {
    STRUCTURAL_BLOCK_FIELDS,
    splitStructuralChanges,
    stripStructuralFields,
} from '@/lib/editor/structural-block-fields'

const heroBlock: BlockData = { blockType: 'hero', id: 'blk-1', variant: 'split-right', headline: 'Xin chào' }

describe('TC-F26-10-01: splitStructuralChanges separates structural from content', () => {
    it('routes variant/backgroundColor to structural and text fields to content', () => {
        const { structural, content } = splitStructuralChanges({
            variant: 'video',
            backgroundColor: '#fff',
            headline: 'New title',
            videoUrl: 'https://cdn/x.webm',
        })
        expect(structural).toEqual({ variant: 'video', backgroundColor: '#fff' })
        expect(content).toEqual({ headline: 'New title', videoUrl: 'https://cdn/x.webm' })
    })

    it('stripStructuralFields removes every structural key and keeps the rest', () => {
        const patch = { variant: 'video', headline: 'x' }
        expect(stripStructuralFields(patch)).toEqual({ headline: 'x' })
        for (const key of STRUCTURAL_BLOCK_FIELDS) {
            expect(stripStructuralFields({ [key]: 'y' })).toEqual({})
        }
    })
})

describe('TC-F26-10-02: getDisplayBlock never lets a locale override shadow structural fields', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [heroBlock], {}, 'Test Site')
        useEditorStore.setState({ activeLocale: 'vi', generationLocale: 'vi', siteLocale: 'en' })
    })

    it('takes variant from the flat block even when a stale override carries one (pre-fix data)', () => {
        // Stale state from a pre-fix session: variant landed in the vi override only.
        useEditorStore.getState().setLocaleOverride('blk-1', 'vi', { variant: 'video', headline: 'Đã sửa' })

        const display = useEditorStore.getState().getDisplayBlock(useEditorStore.getState().blocks[0])

        expect(display.variant).toBe('split-right') // flat block wins for structural
        expect(display.headline).toBe('Đã sửa') // content override still applies
    })

    it('takes structural fields from the flat block over embedded _localeContent too', () => {
        const withEmbedded: BlockData = {
            ...heroBlock,
            id: undefined, // force the embedded branch (no override for blocks without id)
            _localeContent: { vi: { variant: 'video', headline: 'Nhúng' } },
        }
        const display = useEditorStore.getState().getDisplayBlock(withEmbedded)
        expect(display.variant).toBe('split-right')
        expect(display.headline).toBe('Nhúng')
    })
})

describe('TC-F26-10-03: clearLocaleOverrideField purges a key from every locale slot', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [heroBlock], {}, 'Test Site')
    })

    it('removes the field across locales and keeps other override content intact', () => {
        useEditorStore.getState().setLocaleOverride('blk-1', 'vi', { variant: 'video', headline: 'VN' })
        useEditorStore.getState().setLocaleOverride('blk-1', 'en', { variant: 'video', headline: 'EN' })

        useEditorStore.getState().clearLocaleOverrideField('blk-1', 'variant')

        const overrides = useEditorStore.getState().localeOverrides['blk-1']
        expect(overrides.vi).toEqual({ headline: 'VN' })
        expect(overrides.en).toEqual({ headline: 'EN' })
    })

    it('is a no-op for a block with no overrides', () => {
        expect(() => useEditorStore.getState().clearLocaleOverrideField('missing', 'variant')).not.toThrow()
    })
})

describe('TC-F26-10-04: regression — vi-native variant change survives a flat-block re-render', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [heroBlock], {}, 'Test Site')
        // vi-generated site: Sites.locale (en/ms slot) can never equal 'vi'
        useEditorStore.setState({ activeLocale: 'vi', generationLocale: 'vi', siteLocale: 'en' })
    })

    it('after the fixed routing (flat write + override purge), display shows the new variant', () => {
        const store = useEditorStore.getState()
        // Simulate the fixed handleBlockUpdate routing for a structural change:
        store.updateBlock(0, { variant: 'video' })
        store.clearLocaleOverrideField('blk-1', 'variant')

        // The renderer path reads flat blocks — variant must be there, not in a slot.
        expect(useEditorStore.getState().blocks[0].variant).toBe('video')

        const display = useEditorStore.getState().getDisplayBlock(useEditorStore.getState().blocks[0])
        expect(display.variant).toBe('video')
    })
})
