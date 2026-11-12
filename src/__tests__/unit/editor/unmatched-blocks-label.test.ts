/**
 * TC-AICHAT-020 — issue #2218 (UX note): the template-swap toast names left-out sections in words, not block types.
 * Real: unmatched-blocks-label.ts + the en / ms locale block names.
 */

import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { unmatchedBlocksLabel } from '@/lib/editor/unmatched-blocks-label'

const ISSUE_TYPES = ['portfolio-grid', 'carousel', 'blog-list', 'custom-html']

describe('template swap toast — section names [TC-AICHAT-020]', () => {
    it('TC-AICHAT-020: the issue\'s four types read as the Components panel names (en)', () => {
        expect(unmatchedBlocksLabel(ISSUE_TYPES, en.editor.blockLibrary.blocks)).toBe('Portfolio grid, Carousel, Blog list, Rich text')
    })

    it('TC-AICHAT-020: Malay names come from the Malay locale', () => {
        const label = unmatchedBlocksLabel(ISSUE_TYPES, ms.editor.blockLibrary.blocks)

        expect(label).toContain('Senarai blog')
        expect(label).not.toMatch(/portfolio-grid|blog-list|custom-html/)
    })

    it('TC-AICHAT-020: an unknown type still reads as words, and repeats are counted', () => {
        expect(unmatchedBlocksLabel(['pricing_table_v2', 'carousel', 'carousel'], en.editor.blockLibrary.blocks)).toBe('Pricing table v2, Carousel ×2')
    })
})

describe('template swap toast — applied message is translated [TC-AICHAT-020]', () => {
    it('TC-AICHAT-020: en and ms both carry the applied line with the template name', () => {
        expect(en.editor.template.appliedToast.replace('{name}', 'Sports')).toBe('Template "Sports" applied. Press Ctrl+Z to undo.')
        expect(ms.editor.template.appliedToast.replace('{name}', 'Sports')).toBe('Templat "Sports" telah digunakan. Tekan Ctrl+Z untuk buat asal.')
    })
})
