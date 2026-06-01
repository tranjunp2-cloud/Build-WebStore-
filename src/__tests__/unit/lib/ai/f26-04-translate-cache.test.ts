/**
 * F26-04: AI translate fallback — cache layer unit tests
 * TC-IDs: F26-04-01 → F26-04-06
 *
 * Covers cache behavior for translation results:
 *   TC-04-01: getCachedTranslation returns null when not cached
 *   TC-04-02: setCachedTranslation + getCachedTranslation round-trip
 *   TC-04-03: hasCachedTranslation returns false before set, true after
 *   TC-04-04: Different block types cached independently
 *   TC-04-05: clearTranslationCache resets all entries
 *   TC-04-06: Cache key includes both blockType AND locale
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
	getCachedTranslation,
	setCachedTranslation,
	hasCachedTranslation,
	clearTranslationCache,
} from '@/lib/ai/translate-cache'

describe('F26-04: Translation Cache Module', () => {
	// Cleanup before each test to ensure isolation
	beforeEach(() => {
		clearTranslationCache()
	})

	// ── TC-F26-04-01: getCachedTranslation returns null when not cached ──────

	describe('TC-F26-04-01: getCachedTranslation returns null when not cached', () => {
		it('returns null for uncached hero_ms', () => {
			// Act
			const result = getCachedTranslation('hero', 'ms')

			// Assert
			expect(result).toBeNull()
		})

		it('returns null for any uncached blockType + locale combo', () => {
			// Act & Assert
			expect(getCachedTranslation('faq', 'ms')).toBeNull()
			expect(getCachedTranslation('features', 'zh')).toBeNull()
			expect(getCachedTranslation('contact', 'th')).toBeNull()
		})

		it('returns null for uncached even after other entries cached', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Selamat Datang' })

			// Act
			const result = getCachedTranslation('faq', 'ms')

			// Assert
			expect(result).toBeNull()
		})
	})

	// ── TC-F26-04-02: setCachedTranslation + getCachedTranslation round-trip ─

	describe('TC-F26-04-02: setCachedTranslation + getCachedTranslation round-trip', () => {
		it('stores and retrieves simple object', () => {
			// Arrange
			const content = { headline: 'Selamat Datang' }

			// Act
			setCachedTranslation('hero', 'ms', content)
			const result = getCachedTranslation('hero', 'ms')

			// Assert
			expect(result).toEqual(content)
		})

		it('stores and retrieves nested object structure', () => {
			// Arrange
			const content = {
				headline: 'Pertanyaan Umum',
				items: [
					{
						question: 'Apa itu?',
						answer: 'Ini adalah produk kami',
					},
				],
			}

			// Act
			setCachedTranslation('faq', 'ms', content)
			const result = getCachedTranslation('faq', 'ms')

			// Assert
			expect(result).toEqual(content)
			expect((result as any).items[0].question).toBe('Apa itu?')
		})

		it('stores and retrieves content with various data types', () => {
			// Arrange
			const content = {
				headline: 'Title',
				count: 42,
				enabled: true,
				items: null,
				metadata: { deep: { nested: 'value' } },
			}

			// Act
			setCachedTranslation('pricing', 'zh', content)
			const result = getCachedTranslation('pricing', 'zh')

			// Assert
			expect(result).toEqual(content)
			expect((result as any).count).toBe(42)
			expect((result as any).enabled).toBe(true)
			expect((result as any).items).toBeNull()
		})

		it('overwrites previous value when setCachedTranslation called twice', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { headline: 'Old' })
			setCachedTranslation('hero', 'ms', { headline: 'New' })
			const result = getCachedTranslation('hero', 'ms')

			// Assert
			expect(result).toEqual({ headline: 'New' })
		})
	})

	// ── TC-F26-04-03: hasCachedTranslation returns false before set, true after ─

	describe('TC-F26-04-03: hasCachedTranslation returns false before set, true after', () => {
		it('returns false for uncached entry', () => {
			// Act
			const result = hasCachedTranslation('hero', 'ms')

			// Assert
			expect(result).toBe(false)
		})

		it('returns true after setCachedTranslation', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Selamat Datang' })

			// Act
			const result = hasCachedTranslation('hero', 'ms')

			// Assert
			expect(result).toBe(true)
		})

		it('returns false again after clearTranslationCache', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Selamat Datang' })
			expect(hasCachedTranslation('hero', 'ms')).toBe(true)

			// Act
			clearTranslationCache()

			// Assert
			expect(hasCachedTranslation('hero', 'ms')).toBe(false)
		})

		it('returns true independent of content value (empty object still cached)', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', {})

			// Act & Assert
			expect(hasCachedTranslation('hero', 'ms')).toBe(true)
		})
	})

	// ── TC-F26-04-04: Different block types cached independently ────────────

	describe('TC-F26-04-04: Different block types cached independently', () => {
		it('faq_ms and hero_ms are distinct cache entries', () => {
			// Arrange
			const faqContent = { headline: 'Pertanyaan Umum' }
			const heroContent = { headline: 'Selamat Datang' }

			// Act
			setCachedTranslation('faq', 'ms', faqContent)
			setCachedTranslation('hero', 'ms', heroContent)

			// Assert
			expect(getCachedTranslation('faq', 'ms')).toEqual(faqContent)
			expect(getCachedTranslation('hero', 'ms')).toEqual(heroContent)
			expect(getCachedTranslation('faq', 'ms')).not.toEqual(heroContent)
		})

		it('multiple block types can coexist independently', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { name: 'hero-ms' })
			setCachedTranslation('faq', 'ms', { name: 'faq-ms' })
			setCachedTranslation('features', 'ms', { name: 'features-ms' })

			// Assert
			expect((getCachedTranslation('hero', 'ms') as any).name).toBe('hero-ms')
			expect((getCachedTranslation('faq', 'ms') as any).name).toBe('faq-ms')
			expect((getCachedTranslation('features', 'ms') as any).name).toBe('features-ms')
		})

		it('clearing one block type does not affect others (if selective clear existed)', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Hero' })
			setCachedTranslation('faq', 'ms', { headline: 'FAQ' })

			// Assert before clear
			expect(hasCachedTranslation('hero', 'ms')).toBe(true)
			expect(hasCachedTranslation('faq', 'ms')).toBe(true)

			// Act — clear all (current behavior)
			clearTranslationCache()

			// Assert after clear — both are now empty
			expect(hasCachedTranslation('hero', 'ms')).toBe(false)
			expect(hasCachedTranslation('faq', 'ms')).toBe(false)
		})
	})

	// ── TC-F26-04-05: clearTranslationCache resets all entries ──────────────

	describe('TC-F26-04-05: clearTranslationCache resets all entries', () => {
		it('clears single entry', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Hero' })
			expect(hasCachedTranslation('hero', 'ms')).toBe(true)

			// Act
			clearTranslationCache()

			// Assert
			expect(hasCachedTranslation('hero', 'ms')).toBe(false)
		})

		it('clears multiple entries at once', () => {
			// Arrange
			setCachedTranslation('hero', 'ms', { headline: 'Hero' })
			setCachedTranslation('faq', 'ms', { headline: 'FAQ' })
			setCachedTranslation('features', 'zh', { headline: 'Features' })

			// Act
			clearTranslationCache()

			// Assert
			expect(hasCachedTranslation('hero', 'ms')).toBe(false)
			expect(hasCachedTranslation('faq', 'ms')).toBe(false)
			expect(hasCachedTranslation('features', 'zh')).toBe(false)
		})

		it('allows fresh entries after clear', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { headline: 'Old' })
			clearTranslationCache()
			setCachedTranslation('hero', 'ms', { headline: 'New' })

			// Assert
			expect(getCachedTranslation('hero', 'ms')).toEqual({ headline: 'New' })
		})

		it('clear on empty cache does not throw', () => {
			// Act & Assert
			expect(() => clearTranslationCache()).not.toThrow()
		})
	})

	// ── TC-F26-04-06: Cache key includes both blockType AND locale ──────────

	describe('TC-F26-04-06: Cache key includes both blockType AND locale', () => {
		it('faq_ms and faq_en are distinct entries', () => {
			// Arrange
			const msBom = { headline: 'Pertanyaan Umum' }
			const enFaq = { headline: 'Frequently Asked Questions' }

			// Act
			setCachedTranslation('faq', 'ms', msBom)
			setCachedTranslation('faq', 'en', enFaq)

			// Assert
			expect(getCachedTranslation('faq', 'ms')).toEqual(msBom)
			expect(getCachedTranslation('faq', 'en')).toEqual(enFaq)
			expect(getCachedTranslation('faq', 'ms')).not.toEqual(enFaq)
		})

		it('same block type different locales cached independently', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { name: 'hero-ms' })
			setCachedTranslation('hero', 'zh', { name: 'hero-zh' })
			setCachedTranslation('hero', 'th', { name: 'hero-th' })

			// Assert
			expect((getCachedTranslation('hero', 'ms') as any).name).toBe('hero-ms')
			expect((getCachedTranslation('hero', 'zh') as any).name).toBe('hero-zh')
			expect((getCachedTranslation('hero', 'th') as any).name).toBe('hero-th')
		})

		it('same locale different block types cached independently', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { type: 'hero' })
			setCachedTranslation('faq', 'ms', { type: 'faq' })
			setCachedTranslation('contact', 'ms', { type: 'contact' })

			// Assert
			expect((getCachedTranslation('hero', 'ms') as any).type).toBe('hero')
			expect((getCachedTranslation('faq', 'ms') as any).type).toBe('faq')
			expect((getCachedTranslation('contact', 'ms') as any).type).toBe('contact')
		})

		it('distinguishes hero_ms from hero_msX (case-sensitive, exact match)', () => {
			// Arrange & Act
			setCachedTranslation('hero', 'ms', { locale: 'ms' })

			// Assert — slight variations should NOT hit the cache
			expect(getCachedTranslation('hero', 'ms')).toEqual({ locale: 'ms' })
			expect(getCachedTranslation('hero', 'MS')).toBeNull() // Different case
			expect(getCachedTranslation('HERO', 'ms')).toBeNull() // Different case
		})
	})
})
