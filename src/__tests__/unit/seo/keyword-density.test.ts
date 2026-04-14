/**
 * Unit Tests — Keyword Density Utility (AC-15)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.KD-01 → Correct density for single keyword
 *   TC-F03.KD-02 → Correct density for multi-word keyword
 *   TC-F03.KD-03 → ok: true when density ≤ 2%
 *   TC-F03.KD-04 → ok: false when density > 2%
 *   TC-F03.KD-05 → Empty text returns empty array
 *   TC-F03.KD-06 → Empty keywords returns empty array
 */

import { describe, it, expect } from 'vitest'
import { checkKeywordDensity } from '@/lib/seo/keyword-density'

describe('checkKeywordDensity [TC-F03.KD-01..06]', () => {
    it('[TC-F03.KD-01] returns correct density for single keyword', () => {
        // Arrange — "malaysia" appears 2 times in 20 words → 2/20 = 10%
        const text = 'Buy the best products in malaysia today. Shop online in malaysia for great deals and prices available now and more items.'
        const keywords = ['malaysia']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].keyword).toBe('malaysia')
        expect(result[0].count).toBe(2)
        expect(result[0].density).toBeGreaterThan(0)
    })

    it('[TC-F03.KD-02] returns correct density for multi-word keyword', () => {
        // Arrange
        const text = 'buy online malaysia is great. you can buy online malaysia today with fast shipping.'
        const keywords = ['buy online malaysia']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0].keyword).toBe('buy online malaysia')
        expect(result[0].count).toBe(2)
    })

    it('[TC-F03.KD-03] ok: true when density ≤ 2%', () => {
        // Arrange — 1 occurrence in 100 words = 1% density
        const words = Array(99).fill('lorem').join(' ')
        const text = `malaysia ${words}`
        const keywords = ['malaysia']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert
        expect(result[0].ok).toBe(true)
        expect(result[0].density).toBeLessThanOrEqual(0.02)
    })

    it('[TC-F03.KD-04] ok: false when density > 2%', () => {
        // Arrange — "seo" appears 3 times in 10 words = 30% density
        const text = 'seo tips for seo experts doing seo work today now here please'
        const keywords = ['seo']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert
        expect(result[0].ok).toBe(false)
        expect(result[0].density).toBeGreaterThan(0.02)
    })

    it('[TC-F03.KD-05] empty text returns empty array', () => {
        // Act
        const result = checkKeywordDensity('', ['keyword'])

        // Assert
        expect(result).toEqual([])
    })

    it('[TC-F03.KD-06] empty keywords returns empty array', () => {
        // Act
        const result = checkKeywordDensity('some text here', [])

        // Assert
        expect(result).toEqual([])
    })

    it('[TC-F03.KD-02] does NOT substring-match multi-word keywords across word boundaries', () => {
        // Arrange — "buy online" should NOT match "buy online-shopping"
        const text = 'I buy online-shopping stuff today with fast delivery service available'
        const keywords = ['buy online']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert — "online-shopping" → cleaned to "onlineshopping", not matching "online"
        // The match should be 0 because "onlineshopping" !== "online"
        expect(result[0].count).toBe(0)
    })

    it('[TC-F03.KD-01] matches single keywords ignoring punctuation', () => {
        // Arrange — "malaysia" with period and comma should still match
        const text = 'Visit malaysia, the best. Visit malaysia. Come today now here please ok'
        const keywords = ['malaysia']

        // Act
        const result = checkKeywordDensity(text, keywords)

        // Assert
        expect(result[0].count).toBe(2)
    })

    it('[TC-F03.KD-03] zero-count keyword returns ok: true with 0 density', () => {
        // Arrange
        const text = 'this text does not contain the target word anywhere in it at all'

        // Act
        const result = checkKeywordDensity(text, ['missing'])

        // Assert
        expect(result[0].count).toBe(0)
        expect(result[0].density).toBe(0)
        expect(result[0].ok).toBe(true)
    })
})
