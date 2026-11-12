/**
 * TC-AICHAT-019 — issue #2218: the AI change card names fields in words, never the raw key or list path.
 * Real: site-blocks.ts fieldWords.
 */

import { describe, expect, it } from 'vitest'
import { fieldWords } from '@/lib/ai-platform/site/site-blocks'

describe('fieldWords — a field key as the merchant reads it [TC-AICHAT-019]', () => {
    it('TC-AICHAT-019: uses plain words for keys whose split-up name would still be technical', () => {
        // Arrange
        const keys = ['ctaButtons', 'label', 'url', 'primaryColor']

        // Act
        const words = keys.map(fieldWords)

        // Assert
        expect(words).toEqual(['Buttons', 'Text', 'Link', 'Primary color'])
    })

    it('TC-AICHAT-019: splits any other camelCase / snake_case key into a sentence-case phrase', () => {
        expect(fieldWords('backgroundImage')).toBe('Background image')
        expect(fieldWords('show_category_filter')).toBe('Show category filter')
        expect(fieldWords('headline')).toBe('Headline')
    })
})
