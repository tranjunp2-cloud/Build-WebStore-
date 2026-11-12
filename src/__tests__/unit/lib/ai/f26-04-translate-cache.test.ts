/**
 * F26-04: AI translate fallback — cache layer unit tests
 * TC-IDs: TC-F26-04-01 → TC-F26-04-06, TC-AICP-24
 *
 * Covers cache behavior for translation results:
 *   TC-04-01: getCachedTranslation returns null when not cached
 *   TC-04-02: setCachedTranslation + getCachedTranslation round-trip
 *   TC-04-03: hasCachedTranslation returns false before set, true after
 *   TC-04-04: Different source content cached independently
 *   TC-04-05: clearTranslationCache resets all entries
 *   TC-04-06: Cache key includes locale
 *   TC-AICP-24: key is server-derived (scope + prompt version + content hash), bounded LRU
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
	clearTranslationCache,
	getCachedTranslation,
	hasCachedTranslation,
	setCachedTranslation,
	TRANSLATE_CACHE_MAX_ENTRIES,
	translationCacheKey,
	translationCacheSize,
} from '@/lib/ai/translate-cache'

const HERO = { headline: 'Welcome', subheadline: 'Your Business' }

function key(overrides: Partial<Parameters<typeof translationCacheKey>[0]> = {}) {
	return translationCacheKey({ scope: 'org:org_1', promptVersion: 'p@1', locale: 'ms', content: HERO, ...overrides })
}

describe('F26-04: Translation Cache Module', () => {
	beforeEach(() => {
		clearTranslationCache()
	})

	describe('TC-F26-04-01: getCachedTranslation returns null when not cached', () => {
		it('returns null for an uncached key, even after other entries are cached', () => {
			// Arrange
			setCachedTranslation(key({ content: { headline: 'FAQ' } }), { headline: 'Soalan' })

			// Act
			const result = getCachedTranslation(key())

			// Assert
			expect(result).toBeNull()
		})
	})

	describe('TC-F26-04-02: setCachedTranslation + getCachedTranslation round-trip', () => {
		it('stores and retrieves nested content with mixed value types', () => {
			// Arrange
			const translated = { headline: 'Tajuk', count: 42, enabled: true, items: [{ q: 'Apa itu?' }], none: null }

			// Act
			setCachedTranslation(key(), translated)

			// Assert
			expect(getCachedTranslation(key())).toEqual(translated)
		})

		it('overwrites the previous value for the same key', () => {
			setCachedTranslation(key(), { headline: 'Old' })
			setCachedTranslation(key(), { headline: 'New' })
			expect(getCachedTranslation(key())).toEqual({ headline: 'New' })
			expect(translationCacheSize()).toBe(1)
		})
	})

	describe('TC-F26-04-03: hasCachedTranslation returns false before set, true after', () => {
		it('tracks presence, including an empty translation', () => {
			expect(hasCachedTranslation(key())).toBe(false)
			setCachedTranslation(key(), {})
			expect(hasCachedTranslation(key())).toBe(true)
		})
	})

	describe('TC-F26-04-04 / TC-AICP-24: key follows the source content', () => {
		it('an edited block misses the cache instead of serving the stale translation', () => {
			// Arrange
			setCachedTranslation(key(), { headline: 'Selamat Datang' })

			// Act
			const edited = getCachedTranslation(key({ content: { ...HERO, headline: 'Welcome back' } }))

			// Assert
			expect(edited).toBeNull()
		})

		it('same content in a different key order hits the same entry', () => {
			setCachedTranslation(key(), { headline: 'Selamat Datang' })
			expect(getCachedTranslation(key({ content: { subheadline: 'Your Business', headline: 'Welcome' } }))).toEqual({
				headline: 'Selamat Datang',
			})
		})

		it('keys never contain the raw content', () => {
			expect(key()).not.toContain('Welcome')
		})
	})

	describe('TC-F26-04-05: clearTranslationCache resets all entries', () => {
		it('clears every entry and allows fresh ones', () => {
			setCachedTranslation(key(), { headline: 'A' })
			setCachedTranslation(key({ locale: 'en' }), { headline: 'B' })

			clearTranslationCache()

			expect(translationCacheSize()).toBe(0)
			setCachedTranslation(key(), { headline: 'New' })
			expect(getCachedTranslation(key())).toEqual({ headline: 'New' })
		})
	})

	describe('TC-F26-04-06: cache key includes locale', () => {
		it('same content, different locales are distinct entries', () => {
			setCachedTranslation(key({ locale: 'ms' }), { headline: 'Selamat Datang' })
			setCachedTranslation(key({ locale: 'en' }), { headline: 'Welcome' })
			expect(getCachedTranslation(key({ locale: 'ms' }))).toEqual({ headline: 'Selamat Datang' })
			expect(getCachedTranslation(key({ locale: 'en' }))).toEqual({ headline: 'Welcome' })
			expect(getCachedTranslation(key({ locale: 'MS' }))).toBeNull()
		})
	})

	describe('TC-AICP-24: tenant isolation, prompt version and bound', () => {
		it('another workspace never reads this workspace’s entry for the same content', () => {
			setCachedTranslation(key({ scope: 'org:org_1' }), { headline: 'Selamat Datang' })
			expect(getCachedTranslation(key({ scope: 'org:org_2' }))).toBeNull()
			expect(getCachedTranslation(key({ scope: 'user:7' }))).toBeNull()
		})

		it('a new prompt version starts fresh', () => {
			setCachedTranslation(key({ promptVersion: 'p@1' }), { headline: 'Selamat Datang' })
			expect(getCachedTranslation(key({ promptVersion: 'p@2' }))).toBeNull()
		})

		it('evicts the least recently used entry past the cap', () => {
			// Arrange — fill to the cap, then touch the first entry so it is most recent
			for (let i = 0; i < TRANSLATE_CACHE_MAX_ENTRIES; i++) {
				setCachedTranslation(key({ content: { headline: `h${i}` } }), { headline: `t${i}` })
			}
			getCachedTranslation(key({ content: { headline: 'h0' } }))

			// Act
			setCachedTranslation(key({ content: { headline: 'overflow' } }), { headline: 'x' })

			// Assert
			expect(translationCacheSize()).toBe(TRANSLATE_CACHE_MAX_ENTRIES)
			expect(hasCachedTranslation(key({ content: { headline: 'h0' } }))).toBe(true)
			expect(hasCachedTranslation(key({ content: { headline: 'h1' } }))).toBe(false)
			expect(hasCachedTranslation(key({ content: { headline: 'overflow' } }))).toBe(true)
		})
	})
})
