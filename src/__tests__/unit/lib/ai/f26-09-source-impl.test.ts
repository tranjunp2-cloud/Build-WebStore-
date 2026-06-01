/**
 * F26-09: Source Implementation Tests — lang-detect, block-i18n, block-strings-translator
 * TC-IDs: TC-F26-09-01 → TC-F26-09-06
 *
 * Covers:
 *   TC-09-01: detectLanguage BM prompt → contentLang='ms', blockLang='ms'
 *   TC-09-02: detectLanguage EN prompt → contentLang='en'
 *   TC-09-03: hasDedicatedStrings 'ms' → true; 'zh' → true; 'xx' → false
 *   TC-09-04: getBlockStrings('ms') returns BM strings (not English)
 *   TC-09-05: runtimeBlockStringsCache MISS/HIT via injectBlockStrings
 *   TC-09-06: detectLanguage empty/whitespace → contentLang='en', no throw
 *
 * Note: TC-09-07 (AddSectionContext.locale) is covered by add-section-locale.test.ts
 * which tests createAddSectionBlock + normalizeAddSectionBlock locale propagation.
 *
 * Out of scope:
 *   - GPT micro-call in block-strings-translator (requires real OpenAI, integration test)
 *   - prefetchBlockStrings fire-and-forget (async side-effect; not testable without OpenAI mock)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { detectLanguage } from '@/lib/ai/lang-detect'
import {
    getBlockStrings,
    hasDedicatedStrings,
    injectBlockStrings,
    type BlockStrings,
} from '@/lib/ai/block-i18n'

// ── TC-F26-09-01: BM prompt → contentLang='ms', blockLang='ms' ───────────────

describe('[TC-F26-09-01] detectLanguage: BM prompt → ms', () => {
    it('TC-F26-09-01: "Buat website kedai kopi kami" → contentLang=ms, blockLang=ms', () => {
        // Arrange
        const prompt = 'Buat website kedai kopi kami'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('ms')
        expect(result.blockLang).toBe('ms')
    })

    it('TC-F26-09-01: gpLang contains Malay or Bahasa for BM prompt', () => {
        // Arrange
        const prompt = 'Buat website kedai kopi kami'

        // Act
        const result = detectLanguage(prompt)

        // Assert — gpLang must describe Malay language
        expect(result.gpLang.toLowerCase()).toMatch(/malay|bahasa/)
    })

    it('TC-F26-09-01: high-precision noun "kedai" alone is sufficient for ms detection', () => {
        // Arrange — single unambiguous Malay business noun
        const prompt = 'kedai'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('ms')
        expect(result.blockLang).toBe('ms')
    })

    it('TC-F26-09-01: "restoran" alone triggers ms detection', () => {
        // Arrange
        const prompt = 'restoran kami yang terbaik'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('ms')
        expect(result.blockLang).toBe('ms')
    })

    it('TC-F26-09-01: 2+ Malay function words trigger ms detection', () => {
        // Arrange — function words: "dan" (and), "untuk" (for)
        const prompt = 'website dan produk untuk pelanggan'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('ms')
        expect(result.blockLang).toBe('ms')
    })
})

// ── TC-F26-09-02: EN prompt → contentLang='en' ────────────────────────────────

describe('[TC-F26-09-02] detectLanguage: EN prompt → en', () => {
    it('TC-F26-09-02: "Build a website for my coffee shop" → contentLang=en', () => {
        // Arrange
        const prompt = 'Build a website for my coffee shop'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('en')
    })

    it('TC-F26-09-02: English prompt does not fall into vi/ms heuristic path', () => {
        // Arrange
        const prompt = 'Create a professional website for my bakery business'

        // Act
        const result = detectLanguage(prompt)

        // Assert
        expect(result.contentLang).toBe('en')
        expect(result.blockLang).toBe('en')
    })

    it('TC-F26-09-02: returns DetectedLanguage shape (all fields present)', () => {
        // Arrange
        const prompt = 'Build a website for my coffee shop'

        // Act
        const result = detectLanguage(prompt)

        // Assert — verify shape
        expect(typeof result.contentLang).toBe('string')
        expect(typeof result.gpLang).toBe('string')
        expect(typeof result.blockLang).toBe('string')
    })
})

// ── TC-F26-09-06: Empty/whitespace input → 'en' fallback, no crash ────────────

describe('[TC-F26-09-06] detectLanguage: empty/whitespace → en fallback', () => {
    it('TC-F26-09-06: empty string → contentLang=en, no throw', () => {
        // Arrange
        const prompt = ''

        // Act & Assert
        expect(() => detectLanguage(prompt)).not.toThrow()
        const result = detectLanguage(prompt)
        expect(result.contentLang).toBe('en')
    })

    it('TC-F26-09-06: whitespace-only string → contentLang=en, no throw', () => {
        // Arrange
        const prompt = '   '

        // Act & Assert
        expect(() => detectLanguage(prompt)).not.toThrow()
        const result = detectLanguage(prompt)
        expect(result.contentLang).toBe('en')
    })

    it('TC-F26-09-06: empty string → gpLang is English equivalent', () => {
        // Act
        const result = detectLanguage('')

        // Assert
        expect(result.gpLang.toLowerCase()).toContain('english')
    })

    it('TC-F26-09-06: empty string → blockLang=en', () => {
        // Act
        const result = detectLanguage('')

        // Assert
        expect(result.blockLang).toBe('en')
    })
})

// ── TC-F26-09-03: hasDedicatedStrings ─────────────────────────────────────────

describe('[TC-F26-09-03] hasDedicatedStrings: ms → true; zh → true; unknown → false', () => {
    it('TC-F26-09-03: hasDedicatedStrings("ms") === true (in 8-lang static seed)', () => {
        // Act & Assert
        expect(hasDedicatedStrings('ms')).toBe(true)
    })

    it('TC-F26-09-03: hasDedicatedStrings("zh") === true (zh in static seed)', () => {
        // Act & Assert
        expect(hasDedicatedStrings('zh')).toBe(true)
    })

    it('TC-F26-09-03: hasDedicatedStrings("en") === true', () => {
        // Act & Assert
        expect(hasDedicatedStrings('en')).toBe(true)
    })

    it('TC-F26-09-03: hasDedicatedStrings("vi") === true', () => {
        // Act & Assert
        expect(hasDedicatedStrings('vi')).toBe(true)
    })

    it('TC-F26-09-03: hasDedicatedStrings("ja") === true', () => {
        // Act & Assert
        expect(hasDedicatedStrings('ja')).toBe(true)
    })

    it('TC-F26-09-03: hasDedicatedStrings("xx") === false (unknown lang → GPT path)', () => {
        // Act & Assert
        expect(hasDedicatedStrings('xx')).toBe(false)
    })

    it('TC-F26-09-03: hasDedicatedStrings("fr") === false (French not in seed)', () => {
        // French is not in the 8-lang static seed
        // Act & Assert
        expect(hasDedicatedStrings('fr')).toBe(false)
    })

    it('TC-F26-09-03: hasDedicatedStrings(undefined) === false', () => {
        // Act & Assert
        expect(hasDedicatedStrings(undefined)).toBe(false)
    })
})

// ── TC-F26-09-04: getBlockStrings('ms') returns BM strings ───────────────────

describe('[TC-F26-09-04] getBlockStrings("ms"): BM strings for all 6 core categories', () => {
    it('TC-F26-09-04: faq.headline is not the EN string', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert
        expect(strings.faq.headline).not.toBe('Frequently Asked Questions')
        expect(strings.faq.headline.length).toBeGreaterThan(0)
    })

    it('TC-F26-09-04: navigation.home is not "Home" for ms locale', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert
        expect(strings.navigation.home).not.toBe('Home')
        expect(strings.navigation.home.length).toBeGreaterThan(0)
    })

    it('TC-F26-09-04: navigation.contact is not "Contact" for ms locale (BM string)', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert
        expect(strings.navigation.contact).not.toBe('Contact')
    })

    it('TC-F26-09-04: contact.headline is not "Get in Touch" for ms locale', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert
        expect(strings.contact.headline).not.toBe('Get in Touch')
        expect(strings.contact.headline.length).toBeGreaterThan(0)
    })

    it('TC-F26-09-04: footer.allRightsReserved is not the EN string for ms locale', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert
        expect(strings.footer.allRightsReserved).not.toBe('All rights reserved.')
        expect(strings.footer.allRightsReserved.length).toBeGreaterThan(0)
    })

    it('TC-F26-09-04: all string fields are non-empty for ms locale', () => {
        // Act
        const strings = getBlockStrings('ms')

        // Assert — spot-check key scalar string fields
        const scalarFields = [
            strings.navigation.home,
            strings.navigation.about,
            strings.navigation.services,
            strings.navigation.contact,
            strings.navigation.getStarted,
            strings.faq.headline,
            strings.contact.headline,
            strings.contact.subheadline,
            strings.contact.nameLabel,
            strings.contact.emailLabel,
            strings.footer.allRightsReserved,
            strings.footer.explore,
            strings.stats.headline,
            strings.team.headline,
            strings.team.subheadline,
        ]
        scalarFields.forEach((field) => {
            expect(typeof field).toBe('string')
            expect(field.length).toBeGreaterThan(0)
        })
    })

    it('TC-F26-09-04: function fields return non-empty strings for ms locale', () => {
        // Act
        const strings = getBlockStrings('ms')
        const biz = 'Kedai Kopi'

        // Assert — function fields callable + non-empty
        expect(strings.faq.headlineWithBiz(biz).length).toBeGreaterThan(0)
        expect(strings.cta.headlineReady(biz).length).toBeGreaterThan(0)
        expect(strings.cta.headlineDiscover(biz).length).toBeGreaterThan(0)
        expect(strings.features.headlineWhyChoose(biz).length).toBeGreaterThan(0)
    })

    it('TC-F26-09-04: getBlockStrings without arg returns EN fallback', () => {
        // Act
        const strings = getBlockStrings()

        // Assert — falls back to English
        expect(strings.faq.headline).toBe('Frequently Asked Questions')
        expect(strings.navigation.home).toBe('Home')
    })

    it('TC-F26-09-04: getBlockStrings with unsupported locale "fr" falls back to EN', () => {
        // Act
        const strings = getBlockStrings('fr')

        // Assert — French not in static seed → English fallback
        expect(strings.faq.headline).toBe('Frequently Asked Questions')
    })
})

// ── TC-F26-09-05: runtimeBlockStringsCache MISS/HIT via injectBlockStrings ─────

describe('[TC-F26-09-05] block-i18n runtime cache: MISS then HIT', () => {
    // Use a unique fake lang per test to avoid cross-test cache pollution
    // (the cache is module-level, not reset between tests)
    const FAKE_LANG = `__test_lang_${Date.now()}`

    it('TC-F26-09-05: cache MISS — hasDedicatedStrings returns false before inject', () => {
        // Arrange — unique lang not injected yet
        const lang = `${FAKE_LANG}_miss`

        // Act
        const result = hasDedicatedStrings(lang)

        // Assert
        expect(result).toBe(false)
    })

    it('TC-F26-09-05: cache HIT — hasDedicatedStrings returns true after injectBlockStrings', () => {
        // Arrange
        const lang = `${FAKE_LANG}_hit`
        const fakeStrings = getBlockStrings('en') // use EN strings as the injected data

        // Act — inject (simulating what prefetchBlockStrings does after GPT responds)
        injectBlockStrings(lang, fakeStrings)
        const result = hasDedicatedStrings(lang)

        // Assert
        expect(result).toBe(true)
    })

    it('TC-F26-09-05: cache HIT — getBlockStrings returns injected data, not EN fallback', () => {
        // Arrange
        const lang = `${FAKE_LANG}_getstrings`
        const customStrings: BlockStrings = {
            ...getBlockStrings('ms'),
            faq: {
                headline: 'INJECTED_HEADLINE',
                headlineWithBiz: (biz) => `INJECTED_${biz}`,
            },
        }

        // Act
        injectBlockStrings(lang, customStrings)
        const retrieved = getBlockStrings(lang)

        // Assert
        expect(retrieved.faq.headline).toBe('INJECTED_HEADLINE')
        expect(retrieved.faq.headline).not.toBe('Frequently Asked Questions')
    })

    it('TC-F26-09-05: cache MISS before inject — getBlockStrings returns EN fallback', () => {
        // Arrange — lang never injected
        const lang = `${FAKE_LANG}_miss_fallback`

        // Act
        const strings = getBlockStrings(lang)

        // Assert — falls back to EN
        expect(strings.faq.headline).toBe('Frequently Asked Questions')
    })

    it('TC-F26-09-05: injecting for one lang does not affect another lang', () => {
        // Arrange
        const langA = `${FAKE_LANG}_isolation_a`
        const langB = `${FAKE_LANG}_isolation_b`

        injectBlockStrings(langA, getBlockStrings('ms'))

        // Assert — langB still a cache MISS
        expect(hasDedicatedStrings(langB)).toBe(false)
    })
})
